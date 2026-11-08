import { motionAllowed } from "./motion";

const colors = ["#c8161d", "#ff4d57", "#8c1d2c", "#ffffff", "#ffd2d4"];

/** Comemoração em vermelho e branco, vinda das duas laterais. */
export async function celebrate() {
  if (!motionAllowed()) return;
  const { default: confetti } = await import("canvas-confetti");
  const shared = {
    colors,
    particleCount: 90,
    spread: 70,
    startVelocity: 55,
    ticks: 220,
    scalar: 1.05,
    zIndex: 90,
    disableForReducedMotion: true,
  };
  confetti({ ...shared, angle: 60, origin: { x: 0, y: 0.75 } });
  confetti({ ...shared, angle: 120, origin: { x: 1, y: 0.75 } });
  setTimeout(
    () =>
      confetti({
        ...shared,
        particleCount: 140,
        spread: 110,
        startVelocity: 40,
        origin: { x: 0.5, y: 0.35 },
      }),
    250,
  );
}
