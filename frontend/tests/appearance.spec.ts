import { test, expect } from "@playwright/test";

test("academic overview reflects official progression and stays usable on mobile with reduced motion", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("login-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("login-mobile.png"),
    fullPage: true,
  });
  await page.getByLabel("E-mail").fill("student-a@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("fictional-secret");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Histórico informado", exact: true }),
  ).toBeVisible();
  const response = await page.request.get("/api/me/progression");
  expect(response.ok()).toBe(true);
  const progression = await response.json();
  await expect(
    page.getByRole("region", { name: "Resumo da trajetória" }),
  ).toContainText(
    `${Math.round((progression.counts.completed / progression.courses.length) * 100)}%`,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("workspace-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: testInfo.outputPath("workspace-desktop.png"),
    fullPage: true,
  });
});
