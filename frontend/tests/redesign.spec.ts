import { expect, test, type Locator, type Page } from "@playwright/test";
import { drag } from "./drag";

async function register(page: Page, name: string, period = "3") {
  await page.goto("/");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.getByLabel("E-mail").fill(`${name}@example.test`);
  await page.getByLabel("Senha", { exact: true }).fill("fictional-secret");
  await page.getByLabel("Confirmar senha").fill("fictional-secret");
  await page.getByLabel("Matrícula").fill(`${name}-registration`);
  await page.getByLabel("Semestre de ingresso").fill("2025.1");
  await page.getByLabel("Período atual").fill(period);
  await page.getByLabel("Curso").selectOption("SI");
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(
    page.getByRole("heading", { name: "Histórico informado", exact: true }),
  ).toBeVisible();
}

const card = (scope: Page | Locator, name: string) =>
  scope.getByRole("button", { name, exact: true });

test("whole past period is approved at once and the KPI strip stays visible", async ({
  page,
}) => {
  await register(page, "redesign-period");
  const strip = page.getByRole("region", { name: "Resumo da trajetória" });
  await expect(strip).toContainText("Histórico real");
  await page
    .getByRole("button", { name: "Marcar 1º período como aprovado" })
    .click();
  const first = page.getByRole("region", { name: "1º período", exact: true });
  const statuses = await first
    .locator(".course-card")
    .evaluateAll((cards) => cards.map((c) => c.getAttribute("data-status")));
  expect(new Set(statuses)).toEqual(new Set(["completed"]));
  // Períodos futuros não oferecem a ação; o atual também não.
  await expect(
    page.getByRole("button", { name: "Marcar 3º período como aprovado" }),
  ).toHaveCount(0);
  await expect(strip).toContainText("Não salvo");
  await page.getByRole("button", { name: "Salvar histórico" }).click();
  await expect(
    page.locator('[role="status"]:not([id^="DndLiveRegion"])'),
  ).toContainText("Histórico salvo");
  await expect(
    page.getByRole("button", { name: "Marcar 1º período como aprovado" }),
  ).toHaveCount(0);

  await page.mouse.wheel(0, 1600);
  await expect(strip).toBeInViewport();
});

test("selection draws dependency arrows and the details have tabs", async ({
  page,
}) => {
  await register(page, "redesign-arrows");
  await card(page, "Introdução à Programação").click();
  const arrows = page.locator(".dependency-arrows path.arrow");
  await expect(arrows.first()).toBeVisible();
  expect(await page.locator(".arrow-dep").count()).toBeGreaterThan(0);
  // Disciplinas sem relação ficam esmaecidas.
  await expect(
    card(page, "Matemática Discreta para Computação"),
  ).toHaveAttribute("data-dimmed", "true");
  const details = page.getByRole("complementary", {
    name: "Detalhes da disciplina",
  });
  await expect(details.getByRole("tab", { name: "Histórico" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await details.getByRole("tab", { name: "Dependências" }).click();
  await expect(details).toContainText("Libera diretamente");
  await details
    .getByRole("button", { name: /Estruturas de Dados Orientadas a Objetos$/ })
    .click();
  await expect(
    card(page, "Estruturas de Dados Orientadas a Objetos"),
  ).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Fechar detalhes" }).last().click();
  const options = page.getByRole("group", { name: "Opções do mapa" });
  await options.getByRole("button", { name: "Caminho crítico" }).click();
  await expect(page.locator(".arrow-path").first()).toBeVisible();
  expect(
    await page.locator(".course-card[data-critical-path]").count(),
  ).toBeGreaterThan(2);
  await options.getByRole("button", { name: "Legenda" }).click();
  await expect(
    page.getByRole("list", { name: "Legenda do mapa" }),
  ).toContainText("Co-requisito");
  await options.getByRole("button", { name: "Compacto" }).click();
  await expect(page.locator(".curriculum-map")).toHaveClass(/is-compact/);
});

test("simulation looks like a draft and cards drag between periods", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1400 });
  await register(page, "redesign-drag", "2");
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Simulação" })
    .click();
  await expect(
    page.getByRole("region", { name: "Resumo da trajetória" }),
  ).toContainText("Simulação · rascunho");
  await expect(page.getByRole("note").first()).toContainText(
    "nada aqui altera seu histórico",
  );
  await page.getByLabel("Nome da alternativa").fill("Arrastar");
  await page.getByLabel("Semestre-alvo").fill("2025.2");
  await page.getByRole("button", { name: "Criar alternativa" }).click();
  await expect(
    page.getByRole("heading", { name: "Cenário hipotético", exact: true }),
  ).toBeVisible();
  const course = card(page, "Matemática Discreta para Computação");
  const fifth = page.getByRole("region", { name: "5º período", exact: true });
  await drag(page, course, fifth);
  await expect(
    card(fifth, "Matemática Discreta para Computação"),
  ).toBeVisible();
  await expect(page.getByText("Distribuição alterada")).toBeVisible();

  // O seletor no painel continua como alternativa acessível ao arraste.
  await card(page, "Matemática Discreta para Computação").click();
  await page
    .getByLabel("Mover Matemática Discreta para Computação para período")
    .selectOption("2");
  await expect(
    card(
      page.getByRole("region", { name: "2º período", exact: true }),
      "Matemática Discreta para Computação",
    ),
  ).toBeVisible();
});

test("dark theme is remembered across reloads", async ({ page }) => {
  await page.goto("/grades");
  const toggle = page.getByRole("button", { name: "Tema escuro" });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const background = await page.evaluate(
    () => getComputedStyle(document.documentElement).backgroundColor,
  );
  expect(background).toBe("rgb(14, 22, 34)");
});
