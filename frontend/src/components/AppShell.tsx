import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router";
import {
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  Compass,
  FileUp,
  FlaskConical,
  History,
  LayoutDashboard,
  LogIn,
  Search,
  Sparkles,
} from "lucide-react";
import { CommandPalette, type Command } from "./CommandPalette";
import { ThemeToggle } from "./ThemeToggle";
import { Logo } from "./Logo";

const KEY = "pai-sidebar-collapsed";

function readCollapsed() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export const studentNav = [
  { to: "/", label: "Visão geral", icon: LayoutDashboard, end: true },
  { to: "/historico", label: "Meu histórico", icon: History },
  { to: "/simulacao", label: "Simulação", icon: FlaskConical },
  { to: "/sugestoes", label: "Sugestões", icon: Sparkles },
  { to: "/comparar", label: "Comparar", icon: Columns3 },
  { to: "/grades", label: "Explorar grades", icon: Compass },
];
const guestNav = [
  { to: "/grades", label: "Explorar grades", icon: Compass },
  { to: "/", label: "Entrar", icon: LogIn, end: true },
];

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform);

/** Moldura inspirada no Mercury: barra lateral retrátil, topo enxuto e rodapé. */
export function AppShell({
  title,
  subtitle,
  email,
  signedIn = true,
  busy = false,
  onLogout,
  onImport,
  commands = [],
  footer,
  actions,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  program?: string;
  email?: string;
  signedIn?: boolean;
  busy?: boolean;
  onLogout?: () => void;
  onImport?: () => void;
  commands?: Command[];
  footer?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [palette, setPalette] = useState(false);
  useEffect(() => {
    const open = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette((value) => !value);
      }
    };
    window.addEventListener("keydown", open);
    return () => window.removeEventListener("keydown", open);
  }, []);
  const nav = signedIn ? studentNav : guestNav;
  const toggle = () => {
    setCollapsed(!collapsed);
    try {
      localStorage.setItem(KEY, collapsed ? "0" : "1");
    } catch {
      // Só uma preferência visual.
    }
  };
  return (
    <div className="shell" data-collapsed={collapsed || undefined}>
      <aside className="sidebar">
        <Link
          to="/"
          className="sidebar-brand"
          aria-label="pai · Planejamento Acadêmico Integrado, página inicial"
        >
          <Logo size={34} compact={collapsed} />
        </Link>
        <nav aria-label="Navegação principal" className="sidebar-nav">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} aria-hidden="true" />
              <span className="nav-label">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          {signedIn && onImport && (
            <button
              type="button"
              onClick={onImport}
              title="Importar histórico (PDF)"
            >
              <FileUp size={18} aria-hidden="true" />
              <span className="nav-label">Importar histórico</span>
            </button>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? (
              <ChevronsRight size={18} aria-hidden="true" />
            ) : (
              <ChevronsLeft size={18} aria-hidden="true" />
            )}
            <span className="nav-label">Recolher</span>
          </button>
        </div>
      </aside>
      <div className="shell-main">
        <header className="topbar">
          <div className="topbar-title">
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className="topbar-actions">
            {actions}
            {commands.length > 0 && (
              <button
                type="button"
                className="search-trigger"
                onClick={() => setPalette(true)}
                aria-keyshortcuts="Control+K Meta+K"
              >
                <Search size={16} aria-hidden="true" />
                <span>Buscar</span>
                <kbd>{isMac ? "⌘" : "Ctrl"} K</kbd>
              </button>
            )}
            <ThemeToggle />
            {email && <span className="topbar-email">{email}</span>}
            {onLogout && (
              <button
                type="button"
                className="ghost-button"
                disabled={busy}
                onClick={onLogout}
              >
                Sair
              </button>
            )}
          </div>
        </header>
        <div className="shell-content">{children}</div>
        {footer && <footer className="site-footer">{footer}</footer>}
      </div>
      <CommandPalette
        open={palette}
        onClose={() => setPalette(false)}
        commands={commands}
      />
    </div>
  );
}
