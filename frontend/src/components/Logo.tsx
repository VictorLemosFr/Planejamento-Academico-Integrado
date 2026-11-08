/**
 * Marca do PAI: um P que fecha num marco verde (a formatura).
 * As cores vêm de variáveis CSS, então o símbolo acompanha o tema.
 */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      className="logo-mark"
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <rect className="logo-bg" width="48" height="48" rx="12" />
      <path
        className="logo-p"
        d="M16 37 V12 H26 a8 8 0 0 1 0 16 H20"
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle className="logo-dot" cx="20" cy="28" r="3.6" />
    </svg>
  );
}

/** Símbolo + "pai" + nome completo, lado a lado. */
export function Logo({
  size = 32,
  compact = false,
}: {
  size?: number;
  /** Só o símbolo (barra lateral recolhida). */
  compact?: boolean;
}) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      {!compact && (
        <span className="logo-text">
          <strong>pai</strong>
          <small>Planejamento Acadêmico Integrado</small>
        </span>
      )}
    </span>
  );
}
