import { useState } from "react";
import { Check, Copy, Link2, Link2Off } from "lucide-react";
import * as api from "../api";

/** Link somente leitura de um plano salvo, sem notas, CR nem e-mail. */
export function SharePanel({
  planId,
  token,
  onChange,
}: {
  planId: string;
  token?: string | null;
  onChange: (token: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const url = token ? `${window.location.origin}/compartilhado/${token}` : "";
  async function act(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="share">
      <button
        type="button"
        className="ghost-button"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          if (!open && !token)
            void act(async () => onChange((await api.sharePlan(planId)).token));
        }}
      >
        <Link2 size={15} aria-hidden="true" /> Compartilhar
      </button>
      {open && (
        <div
          className="share-popover"
          role="region"
          aria-label="Compartilhar plano"
        >
          {error && <p role="alert">{error}</p>}
          {busy && !token && <p className="muted small">Criando link…</p>}
          {token && (
            <>
              <label className="small muted">
                Link somente leitura
                <input
                  className="field"
                  readOnly
                  value={url}
                  onFocus={(e) => e.target.select()}
                />
              </label>
              <div className="share-actions">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(url);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1800);
                    } catch {
                      setError(
                        "Não foi possível copiar. Selecione o link e copie.",
                      );
                    }
                  }}
                >
                  {copied ? (
                    <Check size={15} aria-hidden="true" />
                  ) : (
                    <Copy size={15} aria-hidden="true" />
                  )}
                  {copied ? "Copiado" : "Copiar link"}
                </button>
                <button
                  type="button"
                  className="ghost-button danger"
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      await api.unsharePlan(planId);
                      onChange(null);
                      setOpen(false);
                    })
                  }
                >
                  <Link2Off size={15} aria-hidden="true" /> Revogar link
                </button>
              </div>
              <p className="small muted">
                Quem tiver o link vê a última versão salva: disciplinas
                concluídas, planejadas e a previsão. Notas, CR, reprovações e
                seu e-mail não aparecem.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
