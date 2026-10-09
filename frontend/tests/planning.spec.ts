import { test, expect } from "@playwright/test";

test("planejar não desbloqueia dependentes; aprovação e restauração usam a API", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Planejamento Acadêmico Integrado" }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Integração e Evolução de Sistemas de Informação",
      exact: true,
    })
    .click();
  const panel = page.getByRole("complementary", {
    name: "Detalhes da disciplina",
  });
  await panel
    .getByRole("button", { name: "Planejar para próximo semestre" })
    .click();
  await expect(panel.getByText("Planejada", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Plano do semestre" }).click();
  await expect(
    page.getByRole("heading", { name: "Plano do próximo semestre" }),
  ).toBeVisible();
  await expect(page.getByTestId("planned-hours")).toHaveText("120h");
  await panel.getByRole("button", { name: "Simular aprovação" }).click();
  await expect(panel.getByText("Concluída", { exact: true })).toBeVisible();
  await expect(page.getByTestId("planned-hours")).toHaveText("0h");
  await page.getByRole("link", { name: "Mapa curricular" }).click();
  await page
    .getByRole("button", { name: "Arquitetura Empresarial", exact: true })
    .click();
  await expect(panel.getByText("Disponível", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Restaurar cenário" }).click();
  await page
    .getByRole("button", { name: "Arquitetura Empresarial", exact: true })
    .click();
  await expect(panel.getByText("Bloqueada", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("mapa-desktop.png") });
});

test("filtros, troca de cenário e detalhes funcionam em tela pequena", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByLabel("Cenário demonstrativo")
    .selectOption("desenvolvimento");
  await page
    .getByRole("button", { name: "Desenvolvimento de Software", exact: true })
    .click();
  const panel = page.getByRole("complementary", {
    name: "Detalhes da disciplina",
  });
  await expect(panel.getByText("Pendente", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Simular aprovação" }).click();
  await expect(panel.getByText("Concluída", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Fechar detalhes" }).click();
  await page.getByRole("button", { name: "Bloqueadas", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Desenvolvimento de Software",
      exact: true,
    }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("mapa-mobile.png") });
});

test("falha da API apresenta recuperação", async ({ page }) => {
  await page.route("**/api/scenarios", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Não foi possível");
  await page.unroute("**/api/scenarios");
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(
    page.getByRole("button", {
      name: "Integração e Evolução de Sistemas de Informação",
      exact: true,
    }),
  ).toBeVisible();
});
