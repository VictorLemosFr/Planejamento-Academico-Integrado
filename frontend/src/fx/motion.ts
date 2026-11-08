/**
 * Quando os efeitos podem rodar.
 *
 * - `prefers-reduced-motion`: a pessoa pediu menos movimento; tudo fica estático.
 * - `navigator.webdriver`: testes automatizados (Playwright) veem a interface
 *   final na hora, sem abertura, sem 3D e sem animações que mudam posições.
 */
export const automated =
  typeof navigator !== "undefined" && navigator.webdriver === true;

export function reducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/** Animações que mexem em posição ou duram mais de um instante. */
export function motionAllowed() {
  return !automated && !reducedMotion();
}

let webgl: boolean | null = null;
export function webglAvailable() {
  if (webgl !== null) return webgl;
  try {
    const canvas = document.createElement("canvas");
    webgl = !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    webgl = false;
  }
  return webgl;
}

/** Marca o documento para o CSS desligar animações em testes automatizados. */
export function markAutomation() {
  if (automated) document.documentElement.dataset.automation = "true";
}
