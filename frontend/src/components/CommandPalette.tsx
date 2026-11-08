import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Search } from "lucide-react";

export interface Command {
  id: string;
  label: string;
  group: string;
  hint?: string;
  icon?: ReactNode;
  /** Texto extra usado só na busca (código, período…). */
  keywords?: string;
  run: () => void;
}

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");

/** Busca rápida (Ctrl+K / ⌘K): pula para uma disciplina ou uma página. */
export function CommandPalette({
  open,
  onClose,
  commands,
}: {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      requestAnimationFrame(() => input.current?.focus());
    }
  }, [open]);
  const results = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    const matches = commands.filter((command) => {
      const text = normalize(
        `${command.label} ${command.keywords ?? ""} ${command.group}`,
      );
      return terms.every((term) => text.includes(term));
    });
    // Sem busca, mostra só as páginas; com busca, as disciplinas aparecem.
    return (
      terms.length ? matches : matches.filter((c) => c.group !== "Disciplinas")
    ).slice(0, 40);
  }, [commands, query]);
  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    list.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);
  if (!open) return null;
  const choose = (command: Command | undefined) => {
    if (!command) return;
    onClose();
    command.run();
  };
  let lastGroup = "";
  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Busca rápida"
        className="palette"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((i) => Math.min(results.length - 1, i + 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          } else if (event.key === "Enter") {
            event.preventDefault();
            choose(results[active]);
          }
        }}
      >
        <div className="palette-input">
          <Search size={18} aria-hidden="true" />
          <input
            ref={input}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={
              results[active] ? `palette-${results[active].id}` : undefined
            }
            aria-label="Buscar disciplina ou ação"
            placeholder="Buscar disciplina, página ou ação…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <kbd>Esc</kbd>
        </div>
        <ul
          id="palette-results"
          role="listbox"
          ref={list}
          className="palette-list"
        >
          {results.map((command, index) => {
            const header = command.group !== lastGroup;
            lastGroup = command.group;
            return (
              <li key={command.id} role="presentation">
                {header && <p className="palette-group">{command.group}</p>}
                <div
                  id={`palette-${command.id}`}
                  role="option"
                  aria-selected={index === active}
                  data-index={index}
                  className="palette-item"
                  onMouseMove={() => setActive(index)}
                  onClick={() => choose(command)}
                >
                  <span className="palette-icon" aria-hidden="true">
                    {command.icon}
                  </span>
                  <span className="palette-label">{command.label}</span>
                  {command.hint && (
                    <span className="palette-hint">{command.hint}</span>
                  )}
                </div>
              </li>
            );
          })}
          {!results.length && (
            <li className="palette-empty">Nada encontrado para “{query}”.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
