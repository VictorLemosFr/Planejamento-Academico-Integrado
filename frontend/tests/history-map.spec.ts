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

const card = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const editor = (page: Page) =>
  page.getByRole("region", { name: "Situação no histórico" });
const cr = (page: Page) => page.locator('[data-kpi="cr"]');

test("attempts, failures and grades are recorded on the map before saving", async ({
  page,
}) => {
  await register(page, "history-map");
  await expect(card(page, "Introdução à Programação")).toContainText(
    "Informe a situação",
  );
  await card(page, "Introdução à Programação").click();
  await expect(editor(page)).toContainText(
    "disciplinas padrão são obrigatórias",
  );
  await expect(
    editor(page).getByRole("button", { name: "Marcar como não cursada" }),
  ).toHaveCount(0);

  await editor(page).getByRole("button", { name: "+ Reprovada" }).click();
  await editor(page).getByLabel("Nota final").fill("4");
  await editor(page).getByRole("button", { name: "+ Reprovada" }).click();
  await editor(page)
    .getByRole("group", { name: "Tentativa 2" })
    .getByRole("button", { name: "Por falta (0)" })
    .click();
  await expect(card(page, "Introdução à Programação")).toContainText(
    "2 reprovações · crítico",
  );
  await expect(editor(page)).toContainText("recusa de matrícula na 3ª");
  await editor(page).getByRole("button", { name: "+ Aprovada" }).click();
  await editor(page)
    .getByRole("group", { name: "Tentativa 3" })
    .getByLabel("Nota final")
    .fill("7");
  await expect(
    page.getByRole("region", { name: "Alterações no histórico" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Salvar histórico" }).click();
  await expect(
    page.locator('[role="status"]:not([id^="DndLiveRegion"])'),
  ).toContainText("Histórico salvo");
  // CR = (5·4 + 5·0 + 5·7) / 15 créditos
  await expect(cr(page)).toContainText("3,67");
  await expect(card(page, "Introdução à Programação")).toContainText("Nota 7");
  await expect(card(page, "Introdução à Programação")).toContainText(
    "2 reprovações",
  );
});

test("third failure refuses enrollment and blocks new attempts", async ({
  page,
}) => {
  await register(page, "history-refused", "4");
  await card(page, "Sistemas Digitais").click();
  for (const _ of [1, 2, 3])
    await editor(page).getByRole("button", { name: "+ Reprovada" }).click();
  await expect(card(page, "Sistemas Digitais")).toContainText(
    "3 reprovações · matrícula recusada",
  );
  await expect(editor(page)).toContainText("matrícula recusada");
  await expect(
    editor(page).getByRole("button", { name: "+ Aprovada" }),
  ).toHaveCount(0);
});

test("electives dragged into a past period become history records", async ({
  page,
}) => {
  // Origem (catálogo) e destino (1º período) visíveis ao mesmo tempo para o arraste.
  await page.setViewportSize({ width: 1440, height: 2400 });
  await register(page, "history-elective");
  const elective = card(page, "Contabilidade de Custos e Gerencial");
  const firstPeriod = page.getByRole("region", {
    name: "1º período",
    exact: true,
  });
  await drag(page, elective, firstPeriod);
  await expect(
    firstPeriod.getByRole("button", {
      name: "Contabilidade de Custos e Gerencial",
      exact: true,
    }),
  ).toHaveAttribute("data-status", "completed");
  await expect(
    editor(page)
      .getByRole("group", { name: "Tentativa 1" })
      .getByLabel("Semestre"),
  ).toHaveValue("2025.1");
  await editor(page).getByLabel("Nota final").fill("9");
  // Períodos futuros não aceitam registros do histórico.
  await expect(
    page
      .getByLabel("Mover Contabilidade de Custos e Gerencial para período", {
        exact: true,
      })
      .locator("option"),
  ).toHaveCount(4);
  await page.getByRole("button", { name: "Salvar histórico" }).click();
  await expect(
    page.locator('[role="status"]:not([id^="DndLiveRegion"])'),
  ).toContainText("Histórico salvo");
  await page.reload();
  await expect(
    firstPeriod.getByRole("button", {
      name: "Contabilidade de Custos e Gerencial",
      exact: true,
    }),
  ).toContainText("Nota 9");
});

test("simulated grades produce a simulated CR only in the simulation tab", async ({
  page,
}) => {
  await register(page, "history-simulated", "2");
  await card(page, "Introdução à Programação").click();
  await editor(page).getByRole("button", { name: "+ Aprovada" }).click();
  await editor(page).getByLabel("Nota final").fill("6");
  await page.getByRole("button", { name: "Salvar histórico" }).click();
  await expect(
    page.locator('[role="status"]:not([id^="DndLiveRegion"])'),
  ).toContainText("Histórico salvo");
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Simulação" })
    .click();
  await page.getByLabel("Nome da alternativa").fill("CR alto");
  await page.getByLabel("Semestre-alvo").fill("2025.2");
  await page.getByRole("button", { name: "Criar alternativa" }).click();
  await card(page, "Desenvolvimento de Software").click();
  await page
    .getByRole("button", { name: "Planejar para próximo semestre" })
    .click();
  await page.getByLabel("Nota simulada (entra no CR simulado)").fill("10");
  await page.getByLabel("Nota simulada (entra no CR simulado)").blur();
  // (5·6 + 6·10) / 11 créditos
  await expect(cr(page)).toContainText("8,18");
  await expect(cr(page)).toContainText("CR simulado");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.locator('[role="status"]:not([id^="DndLiveRegion"])'),
  ).toContainText("Plano salvo");
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Meu histórico" })
    .click();
  await expect(cr(page)).toContainText("6,0");
  await expect(cr(page)).not.toContainText("simulado");
});
