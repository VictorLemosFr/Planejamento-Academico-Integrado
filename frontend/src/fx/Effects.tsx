import {
  Suspense,
  lazy,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { CinMark } from "../components/brand/CinMark";
import { Brasao } from "../components/brand/Brand";
import { motionAllowed, webglAvailable } from "./motion";

const CinSymbol3D = lazy(() => import("./CinSymbol3D"));

/**
 * O "i" em 3D quando há WebGL e movimento permitido; senão, o vetor com um
 * giro em CSS (ou parado, para quem pediu menos movimento).
 */
export function Symbol3D({
  className = "",
  spin,
}: {
  className?: string;
  spin?: number;
}) {
  const [live] = useState(() => motionAllowed() && webglAvailable());
  const fallback = (
    <div
      className={`symbol-3d symbol-fallback ${className}`}
      aria-hidden="true"
    >
      <CinMark size={220} />
    </div>
  );
  if (!live) return fallback;
  return (
    <Suspense fallback={fallback}>
      <CinSymbol3D className={className} spin={spin} />
    </Suspense>
  );
}

/**
 * Fundo vivo: formas curvas em vermelho que derivam devagar e respondem ao
 * ponteiro com profundidade (parallax). Fica atrás de tudo e nunca cria
 * rolagem horizontal.
 */
export function Aurora({ intensity = 1 }: { intensity?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!motionAllowed()) return;
    let frame = 0;
    const move = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const x = event.clientX / innerWidth - 0.5;
        const y = event.clientY / innerHeight - 0.5;
        ref.current?.style.setProperty("--px", x.toFixed(3));
        ref.current?.style.setProperty("--py", y.toFixed(3));
      });
    };
    window.addEventListener("pointermove", move);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
    };
  }, []);
  return (
    <div
      ref={ref}
      className="aurora"
      aria-hidden="true"
      style={{ "--intensity": intensity } as CSSProperties}
    >
      <i className="aurora-blob a" />
      <i className="aurora-blob b" />
      <i className="aurora-blob c" />
      <i className="aurora-ring" />
      <i className="aurora-grain" />
    </div>
  );
}

const SPLASH_KEY = "pai-splash-seen";

/**
 * Abertura (uma vez por sessão): o "i" se monta em 3D, o brasão entra e o nome
 * se revela. Clique, tecla ou 2,8 s encerram. Não aparece em testes nem para
 * quem pediu menos movimento.
 */
export function Splash() {
  const [show, setShow] = useState(() => {
    if (!motionAllowed()) return false;
    try {
      return sessionStorage.getItem(SPLASH_KEY) !== "1";
    } catch {
      return false;
    }
  });
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (!show) return;
    try {
      sessionStorage.setItem(SPLASH_KEY, "1");
    } catch {
      // Sem armazenamento, a abertura só aparece de novo ao recarregar.
    }
    const close = () => setLeaving(true);
    const timer = setTimeout(close, 2800);
    window.addEventListener("keydown", close);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", close);
    };
  }, [show]);
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setShow(false), 650);
    return () => clearTimeout(timer);
  }, [leaving]);
  if (!show) return null;
  return (
    <div
      className={`splash ${leaving ? "is-leaving" : ""}`}
      role="presentation"
      onClick={() => setLeaving(true)}
    >
      <Aurora intensity={1.3} />
      <div className="splash-stage">
        <Symbol3D className="splash-symbol" spin={0.9} />
        <div className="splash-brand">
          <Brasao height={64} />
        </div>
        <p className="splash-title">
          Planejamento Acadêmico <span>Integrado</span>
        </p>
        <span className="splash-progress" aria-hidden="true">
          <b />
        </span>
        <span className="splash-skip">Clique para pular</span>
      </div>
    </div>
  );
}

/** Cortina vermelha que passa ao entrar no sistema. */
export function Curtain({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 900);
    return () => clearTimeout(timer);
  }, [onDone]);
  return (
    <div className="curtain" aria-hidden="true">
      <CinMark size={88} />
    </div>
  );
}

/** Carregamento: o "i" girando em 3D (CSS) com um texto discreto. */
export function Loader({ label }: { label: string }) {
  return (
    <div className="loader" role="status">
      <span className="loader-mark" aria-hidden="true">
        <CinMark size={56} />
      </span>
      <span className="loader-label">{label}</span>
    </div>
  );
}

/**
 * Número que rola até o valor, com uma curva que desacelera no fim. Em testes
 * e com menos movimento, mostra o valor final na hora.
 */
export function useCountUp(value: number | null | undefined, duration = 900) {
  // Ao aparecer, conta a partir de zero; depois, a partir do valor anterior.
  const [shown, setShown] = useState(() =>
    value === null || value === undefined ? null : motionAllowed() ? 0 : value,
  );
  const from = useRef(motionAllowed() ? 0 : (value ?? 0));
  useEffect(() => {
    if (value === null || value === undefined) {
      setShown(null);
      return;
    }
    if (!motionAllowed()) {
      setShown(value);
      from.current = value;
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 4);
      setShown(origin + (value - origin) * eased);
      if (p < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      from.current = value;
    };
  }, [value, duration]);
  return shown;
}
