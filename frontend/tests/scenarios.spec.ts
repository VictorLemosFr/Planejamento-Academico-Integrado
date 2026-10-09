import { test, expect } from "@playwright/test";

test("trocar de cenário descarta as alterações da demonstração anterior", async ({
  page,
}) => {
  await page.goto("/demo");
  await page
    .getByLabel("Cenário demonstrativo")
    .selectOption("desenvolvimento");
  await page
    .getByRole("button", { name: "Desenvolvimento de Software", exact: true })
    .click();
  const panel = page.getByRole("complementary", {
    name: "Detalhes da disciplina",
  });
  await panel.getByRole("button", { name: "Simular aprovação" }).click();
  await expect(panel.getByText("Concluída", { exact: true })).toBeVisible();
  await page.getByLabel("Cenário demonstrativo").selectOption("estatistica");
  await page
    .getByLabel("Cenário demonstrativo")
    .selectOption("desenvolvimento");
  await page
    .getByRole("button", { name: "Desenvolvimento de Software", exact: true })
    .click();
  await expect(panel.getByText("Pendente", { exact: true })).toBeVisible();
});
