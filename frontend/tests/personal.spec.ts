import { test, expect } from "@playwright/test";

async function signIn(
  page: import("@playwright/test").Page,
  email = "student-a@example.test",
) {
  await page.goto("/");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("fictional-secret");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sair", exact: true }),
  ).toBeVisible();
}

test("history, two alternatives, hypothetical draft, save and recovery after login", async ({
  page,
}) => {
  await signIn(page);
  await expect(
    page.getByText("Histórico oficial", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Introdução à Programação", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Desfazer aprovação simulada" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Fechar detalhes", exact: true })
    .last()
    .click();
  await page.getByLabel("Nome da alternativa").fill("Alternativa A");
  await page.getByLabel("Semestre-alvo").fill("2026.2");
  await page.getByRole("button", { name: "Criar alternativa" }).click();
  await expect(
    page.getByText("Cenário hipotético", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Estruturas de Dados Orientadas a Objetos",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Simular aprovação", exact: true })
    .click();
  await expect(
    page.getByText("Alterações pendentes", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Plano salvo");
  await page.reload();
  await page
    .getByLabel("Alternativa salva")
    .selectOption({ label: "Alternativa A · 2026.2" });
  await expect(
    page.getByText("Aprovação simulada", { exact: true }).first(),
  ).toBeVisible();
  await page.getByLabel("Nome da alternativa").fill("Alternativa B");
  await page.getByLabel("Semestre-alvo").fill("2026.2");
  await page.getByRole("button", { name: "Criar alternativa" }).click();
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await signIn(page);
  await expect(
    page.getByLabel("Alternativa salva").locator("option"),
  ).toHaveCount(3);
  await page
    .getByLabel("Alternativa salva")
    .selectOption({ label: "Alternativa A · 2026.2" });
  await expect(
    page.getByText("Aprovação simulada", { exact: true }).first(),
  ).toBeVisible();
});

test("the official map directs pending courses to an alternative", async ({
  page,
}) => {
  await signIn(page);
  await page
    .getByRole("button", {
      name: "Matemática Discreta para Computação",
      exact: true,
    })
    .click();
  await page.getByRole("link", { name: "Criar ou abrir alternativa" }).click();
  await expect(page.getByLabel("Alternativa salva")).toBeInViewport();
  await page.getByLabel("Nome da alternativa").fill("Simulação de conclusão");
  await page.getByLabel("Semestre-alvo").fill("2026.2");
  await page.getByRole("button", { name: "Criar alternativa" }).click();
  await page
    .getByRole("button", {
      name: "Matemática Discreta para Computação",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Simular aprovação", exact: true })
    .click();
  await expect(
    page.getByText("Aprovação simulada", { exact: true }).first(),
  ).toBeVisible();
});

test("empty history, student isolation and mobile layout", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "student-b@example.test");
  await expect(
    page.getByText("Aguardando importação do histórico", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Alternativa salva").locator("option"),
  ).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("personal-mobile.png") });
});

test("save failure and conflict do not claim success or discard draft", async ({
  page,
}) => {
  await signIn(page);
  await page.getByLabel("Nome da alternativa").fill("Falha");
  await page.getByLabel("Semestre-alvo").fill("2026.2");
  await page.getByRole("button", { name: "Criar alternativa" }).click();
  await page.getByLabel("Nome do plano").fill("Rascunho local");
  await page.route("**/api/plans/*", async (route) => {
    if (route.request().method() === "PUT")
      await route.fulfill({
        status: 409,
        json: { detail: "O plano mudou. Recarregue antes de salvar." },
      });
    else await route.continue();
  });
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("O plano mudou");
  await expect(page.getByLabel("Nome do plano")).toHaveValue("Rascunho local");
  await expect(
    page.getByText("Alterações pendentes", { exact: true }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page.getByLabel("Nome do plano")).toBeVisible();
});

test("expired session clears personal content", async ({ page }) => {
  await signIn(page);
  await page.route("**/api/plans", (route) =>
    route.fulfill({
      status: 401,
      json: { detail: "Sessão expirada. Entre novamente." },
    }),
  );
  await page.getByLabel("Nome da alternativa").fill("Expirada");
  await page.getByLabel("Semestre-alvo").fill("2026.2");
  await page.getByRole("button", { name: "Criar alternativa" }).click();
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(
    page.getByText("Histórico oficial", { exact: true }),
  ).toHaveCount(0);
});
