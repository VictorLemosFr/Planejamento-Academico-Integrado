import { useState } from "react";

type Theme = "light" | "dark";
const KEY = "pai-theme";

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return typeof matchMedia === "function" &&
    matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** Aplica o tema antes da primeira pintura: escolha salva ou a do sistema. */
export function applyInitialTheme() {
  document.documentElement.dataset.theme = storedTheme() ?? systemTheme();
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.dataset.theme as Theme) ?? systemTheme(),
  );
  const dark = theme === "dark";
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label="Tema escuro"
      aria-pressed={dark}
      title={dark ? "Usar tema claro" : "Usar tema escuro"}
      onClick={() => {
        const next: Theme = dark ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem(KEY, next);
        } catch {
          // Sem armazenamento, o tema vale só para esta visita.
        }
        setTheme(next);
      }}
    >
      <span aria-hidden="true">{dark ? "☀" : "☾"}</span>
    </button>
  );
}
