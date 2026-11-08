import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router";
import * as api from "./api";
import type { Identity } from "./types";
import DemoApp from "./DemoApp";
import { PublicExplorer } from "./components/PublicExplorer";
import { ThemeToggle } from "./components/ThemeToggle";
import { Student, programNames } from "./Student";
import { SharedPlanView } from "./pages/SharedPlanView";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  TriangleAlert,
} from "lucide-react";
import { BrandLockup } from "./components/brand/Brand";
import { Aurora, Curtain, Loader, Splash, Symbol3D } from "./fx/Effects";
import { motionAllowed } from "./fx/motion";
import { publicDemo, publicDemoNotice } from "./deploy";

const input =
  "glass-input mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
const button =
  "glass-button rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50";
const primary = `${button} primary-button text-white`;

export default function App() {
  return (
    <>
      <Splash />
      <Routes />
    </>
  );
}

function Routes() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [curtain, setCurtain] = useState(false);
  const endCurtain = useCallback(() => setCurtain(false), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const client = useQueryClient();
  const location = useLocation();
  useEffect(() => {
    let active = true;
    api
      .getMe()
      .then((result) => {
        if (active) {
          api.setCsrf(result.csrf_token);
          setIdentity(result);
        }
      })
      .catch((error) => {
        if (active && !(error instanceof api.ApiError && error.status === 401))
          setError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const expire = () => {
      api.setCsrf("");
      client.clear();
      setIdentity(null);
      setError("Sessão expirada. Entre novamente.");
    };
    window.addEventListener("session-expired", expire);
    return () => {
      active = false;
      window.removeEventListener("session-expired", expire);
    };
  }, [client]);
  if (
    location.pathname.startsWith("/demo") &&
    import.meta.env.VITE_DEMO_ENABLED === "true"
  )
    return <DemoApp />;
  if (loading) return <Loader label="Carregando sessão…" />;
  if (location.pathname.startsWith("/grades"))
    return <PublicExplorer identity={identity} />;
  if (location.pathname.startsWith("/compartilhado/"))
    return <SharedPlanView />;
  if (!identity)
    return (
      <Login
        error={error}
        onLogin={(result) => {
          client.clear();
          api.setCsrf(result.csrf_token);
          setIdentity(result);
          setError("");
          if (motionAllowed()) setCurtain(true);
        }}
      />
    );
  if (identity.student && !identity.student.curriculum.available)
    return (
      <PendingProgram
        identity={identity}
        onLogout={() => {
          api.setCsrf("");
          client.clear();
          setIdentity(null);
          setError("");
        }}
      />
    );
  return (
    <>
      {curtain && <Curtain onDone={endCurtain} />}
      <Student
        key={identity.user.id}
        identity={identity}
        onLogout={() => {
          api.setCsrf("");
          client.clear();
          setIdentity(null);
          setError("");
        }}
      />
    </>
  );
}

function PendingProgram({
  identity,
  onLogout,
}: {
  identity: Identity;
  onLogout: () => void;
}) {
  const [failure, setFailure] = useState("");
  const program = identity.student!.program;
  const validFrom = identity.student!.curriculum.valid_from;
  return (
    <div className="app-shell min-h-dvh">
      <header className="app-header flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-5 sm:px-8">
        <div>
          <BrandLockup size={36} />
          <p className="mt-2 text-xs text-slate-500">{programNames[program]}</p>
          <h1 className="sr-only">Planejamento Acadêmico Integrado</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">{identity.user.email}</span>
          <button
            className={button}
            onClick={() =>
              void api
                .logout()
                .then(onLogout)
                .catch((error) => setFailure(error.message))
            }
          >
            Sair
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
        {failure && (
          <p role="alert" className="mb-4 text-sm text-red-700">
            {failure}
          </p>
        )}
        <section className="glass-panel rounded-xl p-7 sm:p-10">
          <p className="eyebrow">{programNames[program]}</p>
          <h2 className="mt-3 text-2xl font-semibold">
            {validFrom
              ? `Matriz de ${program} disponível a partir de ${validFrom}`
              : `Grade de ${program} ainda não cadastrada`}
          </h2>
          <p className="mt-3 text-slate-600">
            {validFrom
              ? "Seu semestre de ingresso é anterior à matriz atendida. O planejamento para sua turma ainda não está disponível."
              : "A grade e o planejamento deste curso estarão disponíveis após o cadastro da matriz curricular."}
          </p>
        </section>
      </main>
    </div>
  );
}

function Login({
  error,
  onLogin,
}: {
  error: string;
  onLogin: (value: Identity) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [registration, setRegistration] = useState("");
  const [startTerm, setStartTerm] = useState("");
  const [currentPeriod, setCurrentPeriod] = useState("1");
  const [program, setProgram] = useState<"CC" | "SI" | "IA" | "EC">("SI");
  const [registering, setRegistering] = useState(false);
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  return (
    <main className="login-layout">
      <Aurora />
      <section className="login-story" aria-label="Sua trajetória acadêmica">
        <div className="brand-lockup">
          <BrandLockup size={46} tilt />
        </div>
        <div className="login-hero">
          <Symbol3D className="login-symbol" />
          <div className="login-orbit" aria-hidden="true">
            {["CC", "SI", "IA", "EC"].map((code, i) => (
              <span key={code} style={{ "--i": i } as CSSProperties}>
                {code}
              </span>
            ))}
          </div>
        </div>
        <div className="login-headline">
          <p className="eyebrow">SUA TRAJETÓRIA, SUAS POSSIBILIDADES</p>
          <h2>
            Um novo olhar <br />
            para o seu <em>futuro.</em>
          </h2>
          <p>
            Simule a matrícula, veja o impacto de cada escolha e descubra quando
            você se forma.
          </p>
        </div>
      </section>
      <form
        className="login-panel glass-panel"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setFailure("");
          try {
            if (registering) {
              if (password !== confirmPassword) {
                setFailure("As senhas não coincidem.");
                return;
              }
              onLogin(
                await api.register({
                  email,
                  password,
                  registration,
                  start_term: startTerm,
                  current_period: Number(currentPeriod),
                  program,
                }),
              );
            } else {
              onLogin(await api.login(email, password));
            }
            setPassword("");
            setConfirmPassword("");
          } catch (error) {
            setFailure((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="login-top">
          <span className="login-badge">PORTAL DO ESTUDANTE</span>
          <ThemeToggle />
        </div>
        <h1 className="login-title">
          Planejamento Acadêmico <span>Integrado</span>
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          {registering
            ? "Crie sua conta e escolha seu curso para começar."
            : "Acesse seu histórico e suas alternativas para o semestre."}
        </p>
        {publicDemo && (
          <p
            className="banner warn notice mt-4"
            data-testid="public-demo-notice"
          >
            <TriangleAlert size={16} aria-hidden="true" />
            <span>{publicDemoNotice}</span>
          </p>
        )}
        {(failure || error) && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {failure || error}
          </p>
        )}
        <label className="field-icon mt-6 block text-sm">
          E-mail
          <span className="field-wrap">
            <Mail size={17} aria-hidden="true" />
            <input
              className={input}
              type="email"
              autoComplete="email"
              placeholder="voce@exemplo.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </span>
        </label>
        <label className="field-icon mt-4 block text-sm">
          Senha
          <span className="field-wrap">
            <Lock size={17} aria-hidden="true" />
            <input
              className={input}
              type={showPassword ? "text" : "password"}
              autoComplete={registering ? "new-password" : "current-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="reveal-password"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff size={17} aria-hidden="true" />
              ) : (
                <Eye size={17} aria-hidden="true" />
              )}
            </button>
          </span>
        </label>
        {registering && (
          <>
            <label className="mt-4 block text-sm">
              Confirmar senha
              <input
                className={input}
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>
            <label className="mt-4 block text-sm">
              Matrícula
              <input
                className={input}
                required
                maxLength={80}
                value={registration}
                onChange={(e) => setRegistration(e.target.value)}
              />
            </label>
            <label className="mt-4 block text-sm">
              Semestre de ingresso
              <input
                className={input}
                required
                placeholder="AAAA.1 ou AAAA.2"
                pattern="[0-9]{4}\.[12]"
                value={startTerm}
                onChange={(e) => setStartTerm(e.target.value)}
              />
            </label>
            <label className="mt-4 block text-sm">
              Período atual
              <input
                className={input}
                type="number"
                min="1"
                max="20"
                required
                value={currentPeriod}
                onChange={(e) => setCurrentPeriod(e.target.value)}
              />
            </label>
            <label className="mt-4 block text-sm">
              Curso
              <select
                className={input}
                value={program}
                onChange={(e) => setProgram(e.target.value as typeof program)}
              >
                {Object.entries(programNames).map(([code, name]) => (
                  <option key={code} value={code}>
                    {code} · {name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <button
          className={`${primary} shine-button mt-5 w-full`}
          disabled={busy}
        >
          {busy
            ? registering
              ? "Cadastrando…"
              : "Entrando…"
            : registering
              ? "Cadastrar"
              : "Entrar"}
          {!busy && <ArrowRight size={18} aria-hidden="true" />}
        </button>
        <button
          type="button"
          className="link-button mt-4 w-full text-sm font-semibold"
          onClick={() => {
            setRegistering(!registering);
            setFailure("");
          }}
        >
          {registering ? "Já tenho conta" : "Criar conta"}
        </button>
        <p className="mt-4 text-xs leading-5 text-slate-500">
          {registering
            ? "Após entrar, informe as cadeiras que você já cursou."
            : "A redefinição de senha é feita pela coordenação."}
        </p>
        <p className="login-or" aria-hidden="true">
          <span>ou</span>
        </p>
        <Link to="/grades" className="outline-cta">
          Explorar as grades sem entrar
        </Link>
      </form>
    </main>
  );
}
