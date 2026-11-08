import { expect, test, type Page } from "@playwright/test";
import { goHistory } from "./drag";

const origin = { Origin: "http://127.0.0.1:5173" };

/** Estudante fictício do 1º período cursando IP e Matemática Discreta. */
async function studentTakingIp(page: Page) {
  const registered = await page.request.post("/api/auth/register", {
    headers: origin,
    data: {
      email: `reprova-${Date.now()}@example.test`,
      password: "fictional-secret",
      registration: `r${Date.now()}`,
      current_period: 1,
      start_term: "2026.1",
      program: "SI",
    },
  });
  expect(registered.status()).toBe(201);
  const { csrf_token } = await registered.json();
  const history = await page.request.put("/api/me/history", {
    headers: { ...origin, "X-CSRF-Token": csrf_token },
    data: {
      start_term: "2026.1",
      current_period: 1,
      records: [
        { course_id: "ip", academic_term: "2026.1", status: "in_progress" },
        { course_id: "mdc", academic_term: "2026.1", status: "in_progress" },
      ],
    },
  });
  expect(history.status()).toBe(200);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();
}

const notice = (page: Page) => page.locator(".banner.success");
const ip = (page: Page) =>
  page.getByRole("button", { name: "Introdução à Programação", exact: true });

test("planning with a failure creates an alternative that retakes the course", async ({
  page,
}) => {
  await studentTakingIp(page);
  await goHistory(page);
  await ip(page).click();
  await page.getByRole("tab", { name: "Resumo" }).click();
  await page.getByRole("button", { name: "E se eu reprovar?" }).click();
  await page
    .getByRole("button", { name: "Planejar com essa reprovação" })
    .click();

  await expect(page).toHaveURL(/\/simulacao/);
  await expect(notice(page)).toContainText(
    "Criamos a alternativa “Se eu reprovar em",
  );
  // Na Simulação, IP é refeita num semestre futuro; o histórico não muda.
  await expect(ip(page)).toHaveAttribute("data-status", "planned");
  await expect(ip(page)).toHaveAttribute("data-sim-failure", "true");
  await expect(
    page
      .getByRole("region", { name: "Resumo da trajetória" })
      .getByText("reprov. simuladas"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Estruturas de Dados Orientadas a Objetos",
      exact: true,
    }),
  ).toHaveAttribute("data-status", "planned");

  // Desfazer devolve IP ao andamento.
  await page
    .getByRole("button", { name: "Desfazer reprovação simulada" })
    .click();
  await expect(ip(page)).toHaveAttribute("data-status", "in_progress");
  await expect(ip(page)).not.toHaveAttribute("data-sim-failure", "true");

  await goHistory(page);
  await expect(ip(page)).toHaveAttribute("data-status", "in_progress");
});

test("an open alternative takes the failure and postpones dependents", async ({
  page,
}) => {
  await studentTakingIp(page);
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Simulação" })
    .click();
  await page.getByLabel("Nome da alternativa").fill("Plano normal");
  await page.getByRole("button", { name: "Criar alternativa" }).click();
  await expect(page.getByLabel("Nome do plano")).toHaveValue("Plano normal");

  await ip(page).click();
  await page
    .getByRole("button", { name: "Simular reprovação e replanejar" })
    .click();
  await expect(notice(page)).toContainText("Reprovação simulada em");
  await expect(ip(page)).toHaveAttribute("data-sim-failure", "true");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(notice(page)).toContainText("Plano salvo");
  await page.getByLabel("Nome da alternativa").fill("Sem reprovar");
  await page.getByRole("button", { name: "Criar alternativa" }).click();
  await expect(page.getByLabel("Nome do plano")).toHaveValue("Sem reprovar");

  // A comparação mostra a reprovação simulada da alternativa.
  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Comparar" })
    .click();
  await expect(page.getByText("Reprovações simuladas")).toBeVisible();
});
