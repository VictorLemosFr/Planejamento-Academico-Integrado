import type { Locator, Page } from "@playwright/test";

/**
 * Arrasta como uma pessoa: pressiona, desloca alguns pixels (o dnd-kit só
 * começa o arraste após 6 px, para o clique continuar selecionando) e segue em
 * passos até o destino.
 */
export async function drag(page: Page, source: Locator, target: Locator) {
  await source.scrollIntoViewIfNeeded();
  const from = (await source.boundingBox())!;
  const x = from.x + from.width / 2;
  const y = from.y + from.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 12, y, { steps: 4 });
  const to = (await target.boundingBox())!;
  await page.mouse.move(
    to.x + to.width / 2,
    to.y + Math.min(to.height / 2, 120),
    { steps: 15 },
  );
  await page.mouse.up();
}
