import { test, expect, type Page } from "@playwright/test";
import { drag } from "./drag";

async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("E-mail").fill("student-b@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("fictional-secret");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sair", exact: true }),
  ).toBeVisible();
  // Alternativas ficam na aba Simulação, separadas do histórico real.
  await goSimulation(page);
}
async function goSimulation(page: import("@playwright/test").Page) {
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Simulação" })
    .click();
  await expect(page.getByLabel("Alternativa salva")).toBeVisible();
}
async function create(page: Page, name: string) {
  await page.getByLabel("Nome da alternativa").fill(name);
  await page
    .getByRole("button", { name: "Criar alternativa", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Cenário hipotético", exact: true }),
  ).toBeVisible();
}

test("dragging between and within periods is saved per alternative after a new login", async ({
  page,
}) => {
  await login(page);
  await create(page, "Mapa arrastável");
  const intro = page.getByRole("button", {
    name: "Introdução à Programação",
    exact: true,
  });
  const target = page.getByRole("region", { name: "3º período", exact: true });
  await drag(page, intro, target);
  await expect(
    target.getByRole("button", {
      name: "Introdução à Programação",
      exact: true,
    }),
  ).toBeVisible();
  const math = page.getByRole("button", {
    name: "Matemática Discreta para Computação",
    exact: true,
  });
  await drag(
    page,
    math,
    target.getByRole("button", {
      name: "Introdução à Programação",
      exact: true,
    }),
  );
  const names = await target
    .getByRole("button")
    .evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-label")),
    );
  expect(names.indexOf("Introdução à Programação")).toBe(
    names.indexOf("Matemática Discreta para Computação") + 1,
  );
  // Reorder the two moved cards inside their new period.
  await drag(page, intro, math);
  await expect(
    target.getByRole("button", {
      name: "Introdução à Programação",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.locator('[role="status"]:not([id^="DndLiveRegion"])'),
  ).toContainText("Plano salvo");
  await create(page, "Mapa independente");
  await expect(
    page
      .getByRole("region", { name: "1º período", exact: true })
      .getByRole("button", { name: "Introdução à Programação", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await login(page);
  await page
    .getByLabel("Alternativa salva")
    .selectOption({ label: "Mapa arrastável" });
  await expect(
    target.getByRole("button", {
      name: "Matemática Discreta para Computação",
      exact: true,
    }),
  ).toBeVisible();
  const restoredNames = await target
    .getByRole("button")
    .evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-label")),
    );
  expect(restoredNames.indexOf("Matemática Discreta para Computação")).toBe(
    restoredNames.indexOf("Introdução à Programação") + 1,
  );
  await expect(
    target.getByRole("button", {
      name: "Introdução à Programação",
      exact: true,
    }),
  ).toBeVisible();
});

test("planned electives enter the map and can be moved and saved using mobile controls", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await create(page, "Eletivas no mapa");
  await page
    .getByRole("button", {
      name: "Contabilidade de Custos e Gerencial",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: /^Planejar para/ }).click();
  await page
    .getByRole("button", { name: "Fechar detalhes", exact: true })
    .last()
    .click();
  await expect(
    page
      .getByRole("region", { name: "2º período", exact: true })
      .getByRole("button", {
        name: "Contabilidade de Custos e Gerencial",
        exact: true,
      }),
  ).toBeVisible();
  const catalog = page.getByRole("region", {
    name: "Disciplinas eletivas",
    exact: true,
  });
  await expect(
    catalog.getByRole("button", {
      name: "Contabilidade de Custos e Gerencial",
      exact: true,
    }),
  ).toHaveCount(0);
  // No celular, o seletor de período fica no painel da disciplina.
  await page
    .getByRole("button", {
      name: "Contabilidade de Custos e Gerencial",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Mover Contabilidade de Custos e Gerencial para período", {
      exact: true,
    })
    .selectOption("4");
  await page
    .getByRole("button", { name: "Fechar detalhes", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.locator('[role="status"]:not([id^="DndLiveRegion"])'),
  ).toContainText("Plano salvo");
  await page.reload();
  await page
    .getByLabel("Alternativa salva")
    .selectOption({ label: "Eletivas no mapa" });
  await expect(
    page
      .getByRole("region", { name: "4º período", exact: true })
      .getByRole("button", {
        name: "Contabilidade de Custos e Gerencial",
        exact: true,
      }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("movable-map-mobile.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", {
      name: "Contabilidade de Custos e Gerencial",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Mover Contabilidade de Custos e Gerencial para período", {
      exact: true,
    })
    .selectOption("catalog");
  await page
    .getByRole("button", { name: "Fechar detalhes", exact: true })
    .last()
    .click();
  await expect(
    catalog.getByRole("button", {
      name: "Contabilidade de Custos e Gerencial",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.locator('[role="status"]:not([id^="DndLiveRegion"])'),
  ).toContainText("Plano salvo");
  await page.reload();
  await page
    .getByLabel("Alternativa salva")
    .selectOption({ label: "Eletivas no mapa" });
  await expect(
    catalog.getByRole("button", {
      name: "Contabilidade de Custos e Gerencial",
      exact: true,
    }),
  ).toBeVisible();
});
