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
  await expect(page.getByRole("status")).toContainText("Histórico salvo");
  await expect(
    page.getByRole("button", { name: "Introdução à Programação" }),
  ).toContainText("Concluída");
  await expect(
    page.getByRole("button", { name: "Introdução à Programação" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
});

test("other program shows its own pending curriculum state", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.getByLabel("E-mail").fill("new-cc@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("fictional-secret");
  await page.getByLabel("Confirmar senha").fill("fictional-secret");
  await page.getByLabel("Matrícula").fill("new-cc-registration");
  await page.getByLabel("Semestre de ingresso").fill("2024.1");
  await page.getByLabel("Período atual").fill("1");
  await page.getByLabel("Curso").selectOption("CC");
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(
    page.getByText("Grade de CC ainda não cadastrada"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Introdução à Programação" }),
  ).toHaveCount(0);
});
