/** Número grande com as casas decimais menores, como os saldos do Mercury. */
export function BigValue({
  value,
  digits = 2,
  suffix,
}: {
  value: number | null | undefined;
  digits?: number;
  suffix?: string;
}) {
  if (value === null || value === undefined)
    return <span className="big-value">—</span>;
  const text = value.toLocaleString("pt-BR", {
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
