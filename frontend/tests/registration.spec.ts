import { expect, test } from "@playwright/test";

test("student registers and enters the SI planner", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.getByLabel("E-mail").fill("new-si@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("fictional-secret");
  await page.getByLabel("Confirmar senha").fill("fictional-secret");
  await page.getByLabel("Matrícula").fill("new-si-registration");
  await page.getByLabel("Semestre de ingresso").fill("2024.1");
  await page.getByLabel("Período atual").fill("2");
  await page.getByLabel("Curso").selectOption("SI");
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
  await page.getByRole("button", { name: "Editar histórico" }).click();
  await page.getByRole("button", { name: "Adicionar cadeira" }).click();
  await page.getByRole("combobox", { name: "Disciplina" }).selectOption("ip");
  await page.getByLabel("Semestre da tentativa").fill("2024.1");
  await page.getByLabel("Situação").selectOption("completed");
  await page.getByRole("button", { name: "Salvar histórico" }).click();
  await expect(
    page.locator('[role="status"]:not([id^="DndLiveRegion"])'),
  ).toContainText("Histórico salvo");
  await expect(
    page.getByRole("button", { name: "Introdução à Programação" }),
  ).toContainText("Concluída");
  await expect(
    page.getByRole("button", { name: "Introdução à Programação" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
});

async function goSimulation(page: import("@playwright/test").Page) {
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Simulação" })
    .click();
  await expect(page.getByLabel("Alternativa salva")).toBeVisible();
}

for (const [program, term, course] of [
  ["CC", "2024.1", "cc:cin0133"],
  ["IA", "2025.1", "ia:cin0133"],
  ["EC", "2024.1", "ec:cin0001"],
] as const) {
  test(`${program} registers and edits its own curriculum`, async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await page.getByLabel("E-mail").fill(`new-${program}@example.test`);
    await page.getByLabel("Senha", { exact: true }).fill("fictional-secret");
    await page.getByLabel("Confirmar senha").fill("fictional-secret");
    await page.getByLabel("Matrícula").fill(`new-${program}-registration`);
    await page.getByLabel("Semestre de ingresso").fill(term);
    await page.getByLabel("Período atual").fill("1");
    await page.getByLabel("Curso").selectOption(program);
    await page.getByRole("button", { name: "Cadastrar" }).click();
    await expect(page.locator(".institution-note")).toContainText(
      "pré-requisitos conferidos no PPC",
    );
    await page.getByRole("button", { name: "Editar histórico" }).click();
    await page.getByRole("button", { name: "Adicionar cadeira" }).click();
    await page
      .getByRole("combobox", { name: "Disciplina" })
      .selectOption(course);
    await page.getByLabel("Semestre da tentativa").fill(term);
    await page.getByRole("button", { name: "Salvar histórico" }).click();
    await expect(
      page.locator('[role="status"]:not([id^="DndLiveRegion"])'),
    ).toContainText("Histórico salvo");
    await goSimulation(page);
    await page.getByLabel("Nome da alternativa").fill(`Plano ${program}`);
    await page.getByLabel("Semestre-alvo").fill("2026.2");
    await page.getByRole("button", { name: "Criar alternativa" }).click();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Simulação", exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Alternativa salva")
      .selectOption({ label: `Plano ${program} · 2026.2` });
  });
}

test("older cohort sees the supported matrix start date", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.getByLabel("E-mail").fill("old-cc@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("fictional-secret");
  await page.getByLabel("Confirmar senha").fill("fictional-secret");
  await page.getByLabel("Matrícula").fill("old-cc-registration");
  await page.getByLabel("Semestre de ingresso").fill("2023.2");
  await page.getByLabel("Período atual").fill("4");
  await page.getByLabel("Curso").selectOption("CC");
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page.getByText(/a partir de 2024\.1/)).toBeVisible();
});
