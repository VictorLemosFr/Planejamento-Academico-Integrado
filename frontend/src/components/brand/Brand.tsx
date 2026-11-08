import type { CSSProperties } from "react";
import { CinMark } from "./CinMark";

/**
 * Brasão da UFPE recortado do vídeo de referência da equipe. Troque o arquivo em
 * public/brand/ufpe-brasao.png pelo oficial quando houver; o componente não muda.
 * Inclina em 3D com o ponteiro e um reflexo de luz atravessa o brasão.
 */
export function Brasao({
  height = 48,
  tilt = false,
}: {
  height?: number;
  tilt?: boolean;
}) {
  return (
    <span
      className={`brasao ${tilt ? "is-tilting" : ""}`}
      style={{ "--h": `${height}px` } as CSSProperties}
      onPointerMove={
        tilt
          ? (event) => {
              const box = event.currentTarget.getBoundingClientRect();
              const x = (event.clientX - box.left) / box.width - 0.5;
              const y = (event.clientY - box.top) / box.height - 0.5;
              event.currentTarget.style.setProperty("--rx", `${-y * 18}deg`);
              event.currentTarget.style.setProperty("--ry", `${x * 22}deg`);
            }
          : undefined
      }
      onPointerLeave={
        tilt
          ? (event) => {
              event.currentTarget.style.setProperty("--rx", "0deg");
              event.currentTarget.style.setProperty("--ry", "0deg");
            }
          : undefined
      }
    >
      <img src="/brand/ufpe-brasao.png" alt="Brasão da UFPE" height={height} />
      <i className="brasao-sheen" aria-hidden="true" />
    </span>
  );
}

/** "i" do CIn | brasão da UFPE, como nas peças da universidade. */
export function BrandLockup({
  size = 40,
  compact = false,
  tilt = false,
}: {
  size?: number;
  /** Barra lateral recolhida: só o "i". */
  compact?: boolean;
  tilt?: boolean;
}) {
  return (
    <span className="brand-lockup-cin" data-compact={compact || undefined}>
      <span className="brand-cin">
        <CinMark size={size} title="Centro de Informática" />
        {!compact && (
          <span className="brand-cin-text">
            Centro de
            <br />
            Informática
            <small>UFPE</small>
          </span>
        )}
      </span>
      {!compact && (
        <>
          <span className="brand-divider" aria-hidden="true" />
          <Brasao height={Math.round(size * 1.3)} tilt={tilt} />
        </>
      )}
    </span>
  );
}
