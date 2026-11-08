import { useCountUp } from "../fx/Effects";

/** Número grande com as casas decimais menores; rola até o valor ao aparecer. */
export function BigValue({
  value,
  digits = 2,
  suffix,
}: {
  value: number | null | undefined;
  digits?: number;
  suffix?: string;
}) {
  const shown = useCountUp(value, 1100);
  if (value === null || value === undefined || shown === null)
    return <span className="big-value">—</span>;
  const text = shown.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  const [whole, fraction] = text.split(",");
  return (
    <span className="big-value">
      {whole}
      {fraction !== undefined && <small>,{fraction}</small>}
      {suffix && <small>{suffix}</small>}
    </span>
  );
}
