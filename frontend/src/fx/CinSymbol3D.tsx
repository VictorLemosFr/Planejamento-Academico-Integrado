/**
 * O "i" do CIn em 3D de verdade (WebGL): os contornos do vetor são extrudados,
 * recebem um verniz vermelho com reflexos e giram como no vídeo de referência.
 * A gota cai e a onda se forma ao montar; depois o símbolo flutua e segue o
 * ponteiro. Carregado sob demanda (só login e abertura).
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { CIN_DROP, CIN_VIEWBOX, CIN_WAVE } from "../components/brand/CinMark";

const SCALE = 0.0105;

function geometry(d: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`;
  const shapes = new SVGLoader()
    .parse(svg)
    .paths.flatMap((path) => SVGLoader.createShapes(path));
  const result = new THREE.ExtrudeGeometry(shapes, {
    depth: 46,
    bevelEnabled: true,
    bevelThickness: 7,
    bevelSize: 5,
    bevelSegments: 8,
    curveSegments: 64,
  });
  // SVG cresce para baixo; o centro do desenho vira a origem.
  result.translate(-CIN_VIEWBOX.width / 2, -CIN_VIEWBOX.height / 2, -23);
  result.scale(SCALE, -SCALE, SCALE);
  result.computeVertexNormals();
  return result;
}

function Environment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = texture;
    return () => {
      scene.environment = null;
      texture.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

/** Sombra de contato: um degradê radial que encolhe quando o símbolo sobe. */
function Shadow({ lift }: { lift: React.RefObject<number> }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(90,10,15,0.55)");
    g.addColorStop(1, "rgba(90,10,15,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
  }, []);
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!mesh.current) return;
    const s = 1 - (lift.current ?? 0) * 0.9;
    mesh.current.scale.set(3.4 * s, 0.7 * s, 1);
    (mesh.current.material as THREE.MeshBasicMaterial).opacity = 0.55 * s;
  });
  return (
    <mesh
      ref={mesh}
      position={[0, -2.75, -0.5]}
      rotation={[-Math.PI / 2.2, 0, 0]}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  );
}

function Symbol({ color, spin }: { color: string; spin: number }) {
  const drop = useMemo(() => geometry(CIN_DROP), []);
  const wave = useMemo(() => geometry(CIN_WAVE), []);
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.32,
        metalness: 0.08,
        clearcoat: 1,
        clearcoatRoughness: 0.12,
        sheen: 0.15,
        sheenColor: new THREE.Color("#ff9aa0"),
        // O SVG foi espelhado no eixo Y: as faces precisam valer dos dois lados.
        side: THREE.DoubleSide,
      }),
    [color],
  );
  // A gota aparece ao cair: precisa de transparência própria.
  const dropMaterial = useMemo(() => {
    const clone = material.clone();
    clone.transparent = true;
    return clone;
  }, [material]);
  const group = useRef<THREE.Group>(null);
  const dropRef = useRef<THREE.Mesh>(null);
  const waveRef = useRef<THREE.Mesh>(null);
  const lift = useRef(0);
  const start = useRef<number | null>(null);
  const pointer = useThree((state) => state.pointer);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    start.current ??= t;
    const age = t - start.current;
    // Montagem: a onda cresce girando e a gota cai com um quique.
    const grow = Math.min(1, age / 0.9);
    const easeOut = 1 - Math.pow(1 - grow, 3);
    const fall = Math.min(1, Math.max(0, (age - 0.35) / 0.8));
    const bounce =
      fall < 1 ? 1 - Math.abs(Math.cos(fall * Math.PI * 1.5)) * (1 - fall) : 1;
    if (waveRef.current) {
      waveRef.current.scale.setScalar(0.4 + 0.6 * easeOut);
      waveRef.current.rotation.z = (1 - easeOut) * -0.9;
    }
    if (dropRef.current) {
      dropRef.current.position.y = (1 - bounce) * 3.2;
      dropRef.current.rotation.z = Math.sin(t * 1.3) * 0.04;
      (dropRef.current.material as THREE.Material).opacity = Math.min(
        1,
        fall * 3,
      );
    }
    if (!group.current) return;
    // Flutua, gira como no vídeo e inclina na direção do ponteiro.
    const float = Math.sin(t * 1.4) * 0.12;
    lift.current = ((float + 0.12) / 0.24) * 0.35;
    group.current.position.y = float;
    group.current.rotation.y += delta * spin;
    const tiltX = -pointer.y * 0.35;
    const tiltZ = -pointer.x * 0.12;
    group.current.rotation.x += (tiltX - group.current.rotation.x) * 0.06;
    group.current.rotation.z += (tiltZ - group.current.rotation.z) * 0.06;
  });

  return (
    <>
      <group ref={group}>
        <mesh ref={waveRef} geometry={wave} material={material} castShadow />
        <mesh
          ref={dropRef}
          geometry={drop}
          material={dropMaterial}
          castShadow
        />
      </group>
      <Shadow lift={lift} />
    </>
  );
}

export default function CinSymbol3D({
  color = "#b3121a",
  spin = 0.55,
  className = "",
}: {
  color?: string;
  /** Radianos por segundo. */
  spin?: number;
  className?: string;
}) {
  return (
    <div className={`symbol-3d ${className}`} aria-hidden="true">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0.2, 8.2], fov: 36 }}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.85;
        }}
      >
        <Environment />
        <ambientLight intensity={0.35} />
        <directionalLight position={[4, 6, 6]} intensity={2.2} />
        <directionalLight
          position={[-6, -2, 3]}
          intensity={0.8}
          color="#ffd1d4"
        />
        <pointLight
          position={[0, 0, 4]}
          intensity={2.5}
          distance={9}
          color="#ff6b72"
        />
        <Symbol color={color} spin={spin} />
      </Canvas>
    </div>
  );
}
