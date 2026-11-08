import { useId } from "react";

/**
 * O "i" do Centro de Informática: uma gota sobre uma onda.
 *
 * Redesenhado em vetor a partir do vídeo de referência da equipe (não é o arquivo
 * oficial). Os mesmos contornos alimentam o símbolo 3D, então trocar pelos traços
 * oficiais aqui atualiza as duas versões.
 */
export const CIN_VIEWBOX = { width: 480, height: 490 };
export const CIN_DROP =
  "M218 142 C222 100 250 18 305 14 C345 12 368 45 365 78 C362 118 320 140 218 142Z";
export const CIN_WAVE =
  "M22 370 C90 320 150 225 210 223 C265 221 285 270 300 320 C318 380 340 395 375 390 C405 386 430 360 450 335 L455 360 C420 410 340 478 255 476 C200 474 165 440 150 400 C138 365 125 342 105 345 C80 350 50 375 22 392Z";

export function CinMark({
  size = 32,
  className = "",
  title,
}: {
  size?: number;
  className?: string;
  /** Sem título, o símbolo é decorativo. */
  title?: string;
}) {
  // Um degradê por instância: ids repetidos falham quando o primeiro some.
  const gradient = `cin-red-${useId().replace(/:/g, "")}`;
  return (
    <svg
      className={`cin-mark ${className}`}
      viewBox={`0 0 ${CIN_VIEWBOX.width} ${CIN_VIEWBOX.height}`}
      width={size}
      height={size}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--brand-glow)" />
          <stop offset="0.55" stopColor="var(--brand)" />
          <stop offset="1" stopColor="var(--brand-strong)" />
        </linearGradient>
      </defs>
      <path className="cin-drop" d={CIN_DROP} fill={`url(#${gradient})`} />
      <path className="cin-wave" d={CIN_WAVE} fill={`url(#${gradient})`} />
    </svg>
  );
}
