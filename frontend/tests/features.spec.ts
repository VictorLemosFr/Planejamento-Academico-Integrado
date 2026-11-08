import { expect, test, type Page } from "@playwright/test";
import { goHistory } from "./drag";
import { fileURLToPath } from "node:url";

const fixture = fileURLToPath(
  new URL("./fixtures/historico-ficticio.pdf", import.meta.url),
);

async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("E-mail").fill("student-a@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("fictional-secret");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
  await goHistory(page);
}

test("public explorer simulates approvals without an account", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("link", { name: "Explorar as grades sem entrar" })
    .click();
  await expect(page).toHaveURL(/\/grades/);
  const tabs = page.getByRole("group", { name: "Curso" });
  await expect(tabs.getByRole("button")).toHaveCount(4);
  await expect(
    tabs.getByRole("button", { name: /SI · Sistemas de Informação/ }),
  ).toHaveAttribute("aria-pressed", "true");
  const summary = page.getByRole("region", {
    name: "Integralização e previsão",
  });
  await expect(summary).toContainText("8 semestres");

  await page
    .getByRole("button", { name: "Introdução à Programação", exact: true })
    .click();
  await page.getByRole("button", { name: "Simular aprovação" }).click();
  await expect(
    page.getByRole("button", { name: "Introdução à Programação", exact: true }),
  ).toHaveAttribute("data-status", "simulated");
  await expect(
    page.getByRole("button", {
      name: "Estruturas de Dados Orientadas a Objetos",
      exact: true,
    }),
  ).toHaveAttribute("data-status", "available");
  await expect(
    summary.getByRole("progressbar", { name: /Obrigatórias/ }),
  ).toHaveAttribute("aria-valuenow", "120");
  await page.getByRole("button", { name: /Limpar simulação/ }).click();
  await expect(
    page.getByRole("button", { name: "Introdução à Programação", exact: true }),
  ).toHaveAttribute("data-status", "available");

  await tabs
    .getByRole("button", { name: /CC · Ciência da Computação/ })
    .click();
  await expect(page).toHaveURL(/matriz=CC-2024/);
  await expect(page.locator(".institution-note")).toContainText(
    "pré-requisitos conferidos no PPC",
  );
  const electives = page.getByRole("region", { name: "Disciplinas eletivas" });
  await electives.getByRole("button", { name: /^Bloqueadas/ }).click();
  const locked = await electives
    .locator(".course-card")
    .evaluateAll((cards) => cards.map((c) => c.getAttribute("data-status")));
  expect(locked.length).toBeGreaterThan(0);
  expect(new Set(locked)).toEqual(new Set(["locked"]));

  // O TCC de CC fica no 9º período e precisa aparecer na grade.
  await expect(
    page
      .getByRole("region", { name: "9º período", exact: true })
      .getByRole("button", { name: "Trabalho de Conclusão de Curso" }),
  ).toBeVisible();

  await tabs
    .getByRole("button", { name: /EC · Engenharia da Computação/ })
    .click();
  await expect(
    page.getByRole("region", { name: "10º período", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Laboratório de Sistemas Digitais",
      exact: true,
    })
    .click();
  const details = page.getByRole("complementary", {
    name: "Detalhes da disciplina",
  });
  await details.getByRole("tab", { name: "Dependências" }).click();
  await expect(details).toContainText("Co-requisitos");
  await expect(
    details.getByRole("button", { name: /Sistemas Digitais$/ }),
  ).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("elective filter and sort refine the catalog", async ({ page }) => {
  await login(page);
  const electives = page.getByRole("region", { name: "Disciplinas eletivas" });
  const statuses = () =>
    electives
      .locator(".course-card")
      .evaluateAll((cards) => cards.map((c) => c.getAttribute("data-status")));
  await electives.getByRole("button", { name: /^Bloqueadas/ }).click();
  await expect(
    electives.getByRole("button", { name: /^Bloqueadas/ }),
  ).toHaveAttribute("aria-pressed", "true");
  const locked = await statuses();
  expect(locked.length).toBeGreaterThan(0);
  expect(new Set(locked)).toEqual(new Set(["locked"]));
  await electives.getByRole("button", { name: /^Disponíveis/ }).click();
  expect(new Set(await statuses())).toEqual(new Set(["available"]));

  await electives.getByRole("button", { name: /^Todas/ }).click();
  const byStatus = await statuses();
  expect(byStatus.indexOf("locked")).toBeGreaterThan(
    byStatus.lastIndexOf("available"),
  );
  await electives.getByLabel("Ordenar eletivas").selectOption("name");
  const names = await electives
    .locator(".course-card")
    .evaluateAll((cards) => cards.map((c) => c.getAttribute("aria-label")!));
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "pt-BR")));
});

test("forecast and integralization summarize the student's history", async ({
  page,
}) => {
  await login(page);
  const summary = page.getByRole("region", {
    name: "Integralização e previsão",
  });
  await expect(summary).toContainText("INTEGRALIZAÇÃO");
  await expect(summary).toContainText("PREVISÃO DE CONCLUSÃO");
  await expect(summary).toContainText("Eletivas de perfil");
  await summary.getByText("Como calculamos").click();
  await expect(summary).toContainText("Disciplinas em andamento");
});

test("history import reads a fictional SIGAA PDF before saving", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.getByLabel("E-mail").fill("pdf-si@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("fictional-secret");
  await page.getByLabel("Confirmar senha").fill("fictional-secret");
  await page.getByLabel("Matrícula").fill("pdf-si-registration");
  await page.getByLabel("Semestre de ingresso").fill("2025.1");
  await page.getByLabel("Período atual").fill("2");
  await page.getByLabel("Curso").selectOption("SI");
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await goHistory(page);
  await page.getByRole("button", { name: "Editar histórico" }).click();
  await page.getByLabel("PDF do histórico escolar").setInputFiles(fixture);
  const preview = page.getByLabel("Prévia da importação");
  await expect(preview).toContainText("4 registros encontrados");
  await expect(preview).toContainText("CIN0133");
  await preview.getByText("1 linha para conferir manualmente").click();
  await expect(preview).toContainText("IF9999");
  await preview
    .getByRole("button", { name: "Substituir lista pelo PDF" })
    .click();
  await expect(page.getByRole("combobox", { name: "Disciplina" })).toHaveCount(
    4,
  );
  await page.getByRole("button", { name: "Salvar histórico" }).click();
  await expect(
    page.locator('[role="status"]:not([id^="DndLiveRegion"])'),
  ).toContainText("Histórico salvo");
  await expect(
    page.getByRole("button", { name: "Introdução à Programação", exact: true }),
  ).toHaveAttribute("data-status", "completed");
  await expect(
    page.getByRole("button", {
      name: "Estruturas de Dados Orientadas a Objetos",
      exact: true,
    }),
  ).toHaveAttribute("data-status", "in_progress");
});
