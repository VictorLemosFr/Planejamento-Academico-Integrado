import { expect, test, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { drag, goHistory } from "./drag";

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
    page.getByRole("heading", { name: "Visão geral", level: 1 }),
  ).toBeVisible();
}
const nav = (page: Page, name: string) =>
  page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name, exact: true })
    .click();
const card = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const notice = (page: Page) =>
  page.locator('[role="status"]:not([id^="DndLiveRegion"])').first();

async function approveFirstPeriod(page: Page) {
  await goHistory(page);
  await page
    .getByRole("button", { name: "Marcar 1º período como aprovado" })
    .click();
  await page.getByRole("button", { name: "Salvar histórico" }).click();
  await expect(notice(page)).toContainText("Histórico salvo");
}

test("overview answers how am I, how much is left and what to do next", async ({
  page,
}) => {
  await register(page, "overview-student");
  // Sem histórico, a Visão geral só pede o primeiro passo.
  await expect(
    page.getByRole("heading", { name: "Preencha seu histórico acadêmico" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Integralização" }),
  ).toHaveCount(0);
  await approveFirstPeriod(page);
  await nav(page, "Visão geral");
  // Com o 2º período ainda vazio, o aviso diz o que fazer.
  await expect(
    page
      .getByRole("note")
      .filter({ hasText: "Complete seu histórico acadêmico" }),
  ).toBeVisible();
  const progress = page.getByRole("region", { name: "Integralização" });
  await expect(progress).toContainText("%");
  await expect(progress).toContainText("Concluído");
  await expect(
    page.getByRole("region", { name: "Previsão de conclusão" }),
  ).toContainText("semestre");
  const path = page
    .locator("#path-title")
    .locator("xpath=ancestor::section[1]");
  expect(await path.locator("tbody tr").count()).toBeGreaterThan(0);
  const goal = page
    .locator("#cr-goal-title")
    .locator("xpath=ancestor::section[1]");
  await goal.getByLabel("CR desejado").fill("8");
  await goal.getByLabel("Carga neste semestre (h)").fill("300");
  await expect(goal.getByRole("status")).toContainText("média 8");
  await expect(
    page.getByRole("region", { name: "Coeficiente de rendimento" }),
  ).toBeVisible();
  // O texto sobre a matriz ficou no rodapé.
  await expect(page.locator("footer .institution-note")).toContainText("SIGAA");
});

test("sidebar collapses, quick search jumps to a course and a second click clears it", async ({
  page,
}) => {
  await register(page, "palette-student");
  await page.getByRole("button", { name: "Recolher menu" }).click();
  await expect(page.locator(".shell")).toHaveAttribute(
    "data-collapsed",
    "true",
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Expandir menu" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Expandir menu" }).click();

  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Busca rápida" });
  await palette.getByLabel("Buscar disciplina ou ação").fill("banco dados");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/historico/);
  const banco = card(page, "Banco de Dados");
  await expect(banco).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.locator(".dependency-arrows path.arrow").first(),
  ).toBeVisible();
  // Clicar de novo no card selecionado tira as setas.
  await banco.click();
  await expect(banco).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".dependency-arrows path.arrow")).toHaveCount(0);
});

test("any course drags anywhere: past periods become history, future ones a draft", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1400 });
  await register(page, "drag-anywhere");
  await goHistory(page);
  // Obrigatória do 3º período arrastada para o 2º: tentativa em 2025.2.
  const algorithms = card(page, "Algoritmos");
  const second = page.getByRole("region", { name: "2º período", exact: true });
  await drag(page, algorithms, second);
  await expect(
    second.getByRole("button", { name: "Algoritmos", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Situação no histórico" })
      .getByRole("group", { name: "Tentativa 1" })
      .getByLabel("Semestre"),
  ).toHaveValue("2025.2");
  await page.getByRole("button", { name: "Descartar alterações" }).click();

  // Período futuro no histórico leva para a Simulação e cria um rascunho.
  const fourth = page.getByRole("region", { name: "4º período", exact: true });
  await expect(fourth).toContainText("Futuro → Simulação");
  await drag(page, card(page, "Matemática Discreta para Computação"), fourth);
  await expect(page).toHaveURL(/\/simulacao/);
  await expect(notice(page)).toContainText("Criamos a alternativa");
  await expect(
    page
      .getByRole("region", { name: "4º período", exact: true })
      .getByRole("button", {
        name: "Matemática Discreta para Computação",
        exact: true,
      }),
  ).toBeVisible();
  await expect(page.getByLabel("Nome do plano")).toHaveValue("Rascunho 1");
});

test("what if I fail shows the delay and the failure level", async ({
  page,
}) => {
  await register(page, "what-if", "1");
  await goHistory(page);
  await card(page, "Introdução à Programação").click();
  const details = page.getByRole("complementary", {
    name: "Detalhes da disciplina",
  });
  await details.getByRole("tab", { name: "Resumo" }).click();
  await details.getByRole("button", { name: "E se eu reprovar?" }).click();
  const impact = details.getByRole("region", { name: "E se eu reprovar?" });
  await expect(impact).toContainText("Seria sua 1ª reprovação");
  await expect(impact).toContainText("atenção");
  await expect(impact).toContainText(/Formatura de|Não atrasa/);
});

test("next semester suggestion becomes an alternative and alternatives compare side by side", async ({
  page,
}) => {
  await register(page, "planner-student", "2");
  await approveFirstPeriod(page);
  await nav(page, "Próximo semestre");
  const suggested = page.getByRole("table", { name: "Disciplinas sugeridas" });
  await expect(suggested.locator("tbody tr").nth(1)).toBeVisible();
  await expect(suggested).toContainText("Caminho crítico");
  await page.getByLabel("Carga desejada").selectOption("180");
  await expect(suggested.locator("tfoot")).toContainText("de 180h");
  await page
    .getByRole("button", { name: "Criar alternativa com esta sugestão" })
    .click();
  await expect(page).toHaveURL(/\/simulacao/);
  await expect(
    page.getByRole("heading", { name: "Cenário hipotético" }),
  ).toBeVisible();
  await expect(notice(page)).toContainText("criada com");

  await page.getByLabel("Nome da alternativa").fill("Plano leve");
  await page.getByLabel("Semestre-alvo").fill("2025.2");
  await page.getByRole("button", { name: "Criar alternativa" }).click();
  await nav(page, "Comparar");
  const comparison = page.getByRole("region", { name: "Comparação" });
  await expect(comparison).toContainText("Plano leve");
  await expect(comparison).toContainText("Sugestão 2025.2");
  await expect(comparison).toContainText("Previsão de conclusão");
  await comparison
    .getByRole("button", { name: "Abrir na Simulação" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/simulacao$/);
  await expect(page.getByLabel("Alternativa salva")).not.toHaveValue("");
});

test("a saved plan is shared read-only, revoked and exported", async ({
  page,
  browser,
}) => {
  await register(page, "share-student", "2");
  await nav(page, "Simulação");
  await page.getByLabel("Nome da alternativa").fill("Para o orientador");
  await page.getByLabel("Semestre-alvo").fill("2025.2");
  await page.getByRole("button", { name: "Criar alternativa" }).click();
  await page.getByRole("button", { name: "Compartilhar" }).click();
  const share = page.getByRole("region", { name: "Compartilhar plano" });
  const link = share.getByLabel("Link somente leitura");
  await expect(link).toHaveValue(/\/compartilhado\//);
  const url = await link.inputValue();

  const guest = await browser.newPage();
  await guest.goto(url);
  await expect(
    guest.getByRole("heading", { name: "Para o orientador", level: 1 }),
  ).toBeVisible();
  await expect(
    guest.getByRole("region", { name: "Resumo da trajetória" }),
  ).toContainText("Compartilhado · somente leitura");
  await expect(guest.getByText("share-student@example.test")).toHaveCount(0);

  await share.getByRole("button", { name: "Revogar link" }).click();
  await guest.reload();
  await expect(
    guest.getByRole("heading", { name: "Link indisponível" }),
  ).toBeVisible();
  await guest.close();

  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".print-report")).toBeVisible();
  await expect(page.locator(".print-report")).toContainText(
    "Para o orientador",
  );
  await expect(page.locator(".sidebar")).toBeHidden();
  await page.emulateMedia({ media: "screen" });
});

test("mobile shows the navigation as a bottom tab bar without horizontal scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await register(page, "mobile-shell");
  const bar = page.getByRole("navigation", { name: "Navegação principal" });
  const box = (await bar.boundingBox())!;
  expect(box.y + box.height).toBeGreaterThan(780);
  await nav(page, "Meu histórico");
  await expect(
    page.getByRole("heading", { name: "Meu histórico", level: 1 }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("a current-period course the student skipped is shown as not taken", async ({
  page,
}) => {
  await register(page, "skipped-course");
  await goHistory(page);
  await expect(
    page.getByRole("region", { name: "3º período", exact: true }),
  ).toContainText("2026.1 · atual");
  await page
    .getByRole("button", { name: "Marcar 3º período como cursando" })
    .click();
  const algorithms = card(page, "Algoritmos");
  await expect(algorithms).toHaveAttribute("data-status", "in_progress");
  await algorithms.click();
  await page
    .getByRole("region", { name: "Situação no histórico" })
    .getByRole("button", { name: "Marcar como não cursada" })
    .click();
  await expect(algorithms).toContainText("Não cursando agora");
  await expect(algorithms).toHaveAttribute("data-gap", "skipped");
  await page.getByRole("button", { name: "Salvar histórico" }).click();
  await expect(notice(page)).toContainText("Histórico salvo");
  await nav(page, "Visão geral");
  await expect(
    page.getByRole("note").filter({ hasText: "ficou para depois" }),
  ).toContainText("Algoritmos");
});

const fixture = fileURLToPath(
  new URL("./fixtures/historico-ficticio.pdf", import.meta.url),
);

test("the SIGAA PDF fills the history in one step from the overview", async ({
  page,
}) => {
  await register(page, "import-onboarding", "2");
  await page.getByRole("button", { name: /Importar o PDF do SIGAA/ }).click();
  const dialog = page.getByRole("dialog", {
    name: "Importar histórico do SIGAA",
  });
  await dialog.getByLabel("PDF do histórico (SIGAA)").setInputFiles(fixture);
  const summary = dialog.getByLabel("Resumo da importação");
  await expect(summary).toContainText("Aprovadas");
  await expect(summary).toContainText("Introdução à Programação");
  await expect(summary).toContainText("Cursando agora");
  await expect(summary).toContainText("Obrigatórias ainda não cursadas");
  await expect(dialog).toContainText("fora da sua matriz");
  await dialog.getByRole("button", { name: "Importar e salvar" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(notice(page)).toContainText("Histórico importado do PDF");
  await expect(
    page.getByRole("region", { name: "Integralização" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Preencha seu histórico acadêmico" }),
  ).toHaveCount(0);
});
