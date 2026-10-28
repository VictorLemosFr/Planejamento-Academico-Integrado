import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router";
import * as api from "./api";
import type { Identity } from "./types";
import DemoApp from "./DemoApp";
import { PublicExplorer } from "./components/PublicExplorer";
import { ThemeToggle } from "./components/ThemeToggle";
import { Student, programNames } from "./Student";
import { SharedPlanView } from "./pages/SharedPlanView";

const input =
  "glass-input mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
const button =
  "glass-button rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50";
const primary = `${button} primary-button border-blue-700! bg-blue-700! text-white hover:bg-blue-800!`;

export default function App() {
  const [identity, setIdentity] = useState<Identity | null>(null);
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
  if (loading)
    return (
      <p className="p-8" role="status">
        Carregando sessão…
      </p>
    );
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
          <p className="text-xs text-slate-500">{programNames[program]}</p>
          <h1 className="app-title mt-1 text-xl font-semibold">
            Planejamento Acadêmico Integrado
          </h1>
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
  return (
    <main className="login-layout">
      <section className="login-story" aria-label="Sua trajetória acadêmica">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            p<span>ai</span>
          </span>
          <span>
            Seu próximo passo,
            <br />
            com mais clareza.
          </span>
        </div>
        <div className="login-headline">
          <p className="eyebrow">SUA TRAJETÓRIA, SUAS POSSIBILIDADES</p>
          <h2>
            Um novo olhar
            <br />
            para o seu <em>futuro.</em>
          </h2>
          <p>
            Conecte o que você já conquistou às possibilidades do próximo
            semestre.
          </p>
        </div>
        <div className="trajectory-art" aria-hidden="true">
          <svg viewBox="0 0 600 240" fill="none">
            <defs>
              <linearGradient id="trajectory" x1="0" y1="240" x2="600" y2="0">
                <stop stopColor="#22a69b" />
                <stop offset="1" stopColor="#5072df" />
              </linearGradient>
            </defs>
            <path
              className="trajectory-shadow"
              d="M20 205 C130 205 90 135 205 135 S310 185 365 95 S475 40 580 25"
            />
            <path
              className="trajectory-line"
              d="M20 205 C130 205 90 135 205 135 S310 185 365 95 S475 40 580 25"
            />
            {[
              [20, 205],
              [205, 135],
              [365, 95],
              [580, 25],
            ].map(([x, y], i) => (
              <g key={x}>
                <circle cx={x} cy={y} r="15" fill="white" />
                <circle
                  cx={x}
                  cy={y}
                  r="6"
                  fill={i === 3 ? "#5072df" : "#22a69b"}
                />
              </g>
            ))}
          </svg>
          <span className="trajectory-note note-start">
            Cada conquista conta
          </span>
          <span className="trajectory-note note-end">
            O próximo passo é seu ↗
          </span>
        </div>
        <p className="login-caption">
          CC <span>·</span> SI <span>·</span> IA <span>·</span> EC
        </p>
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
        <h1 className="login-title">Planejamento Acadêmico Integrado</h1>
        <p className="mt-3 text-sm text-slate-600">
          {registering
            ? "Crie sua conta e escolha seu curso para começar."
            : "Acesse seu histórico e suas alternativas para o semestre."}
        </p>
        {(failure || error) && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {failure || error}
          </p>
        )}
        <label className="mt-6 block text-sm">
          E-mail
          <input
            className={input}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="mt-4 block text-sm">
          Senha
          <input
            className={input}
            type="password"
            autoComplete={registering ? "new-password" : "current-password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
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
        <button className={`${primary} mt-5 w-full`} disabled={busy}>
          {busy
            ? registering
              ? "Cadastrando…"
              : "Entrando…"
            : registering
              ? "Cadastrar"
              : "Entrar"}
        </button>
        <button
          type="button"
          className="mt-4 w-full text-sm font-medium text-blue-700"
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
        <Link
          to="/grades"
          className="mt-3 block text-center text-sm font-medium text-blue-700 underline"
        >
          Explorar as grades sem entrar
        </Link>
      </form>
    </main>
  );
}
