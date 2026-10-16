import { test, expect, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("E-mail").fill("student-b@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("fictional-secret");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sair", exact: true }),
  ).toBeVisible();
}
async function create(page: Page, name: string) {
  await page.getByLabel("Nome da alternativa").fill(name);
  await page.getByLabel("Semestre-alvo").fill("2026.2");
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
  await intro.dragTo(target);
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
  await math.hover();
  await page.mouse.down();
  const destination = await target
    .getByRole("button", { name: "Introdução à Programação", exact: true })
    .boundingBox();
  if (!destination) throw new Error("Drop target missing");
  await page.mouse.move(
    destination.x + destination.width / 2,
    destination.y + destination.height / 2,
    { steps: 12 },
  );
  await page.mouse.up();
  const names = await target
    .getByRole("button")
    .evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-label")),
    );
  expect(names.indexOf("Introdução à Programação")).toBe(
    names.indexOf("Matemática Discreta para Computação") + 1,
  );
  // Reorder the two moved cards inside their new period.
  await intro.hover();
  const samePeriodTarget = await math.boundingBox();
  if (!samePeriodTarget) throw new Error("Drop target missing");
  await page.mouse.down();
  await page.mouse.move(
    samePeriodTarget.x + samePeriodTarget.width / 2,
    samePeriodTarget.y + samePeriodTarget.height / 2,
    { steps: 12 },
  );
  await page.mouse.up();
  await expect(
    target.getByRole("button", {
      name: "Introdução à Programação",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Plano salvo");
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
    .selectOption({ label: "Mapa arrastável · 2026.2" });
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
  await page
    .getByRole("button", {
      name: "Planejar para próximo semestre",
      exact: true,
    })
    .click();
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
  await page
    .getByLabel("Mover Contabilidade de Custos e Gerencial para período", {
      exact: true,
    })
    .selectOption("4");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Plano salvo");
  await page.reload();
  await page
    .getByLabel("Alternativa salva")
    .selectOption({ label: "Eletivas no mapa · 2026.2" });
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
    .getByLabel("Mover Contabilidade de Custos e Gerencial para período", {
      exact: true,
    })
    .selectOption("catalog");
  await expect(
    catalog.getByRole("button", {
      name: "Contabilidade de Custos e Gerencial",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Plano salvo");
  await page.reload();
  await page
    .getByLabel("Alternativa salva")
    .selectOption({ label: "Eletivas no mapa · 2026.2" });
  await expect(
    catalog.getByRole("button", {
      name: "Contabilidade de Custos e Gerencial",
      exact: true,
    }),
  ).toBeVisible();
});
