"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Bubbles, Contact, SwayBlade, rand } from "./parts";
import type { CatalogItem, PlacedItem } from "@/lib/types";
import { MODELLED, ReefModel } from "./ReefModel";

type P = { item: CatalogItem; placed: PlacedItem };

/* ── Plants ─────────────────────────────────────────────────────── */

function Grass({ item, placed }: P) {
  const blades = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        w: 0.11 + rand(placed.seed, i) * 0.07,
        h: 0.5 + rand(placed.seed, i + 10) * 0.4,
        x: (rand(placed.seed, i + 20) - 0.5) * 0.42,
        z: (rand(placed.seed, i + 30) - 0.5) * 0.42,
        rot: rand(placed.seed, i + 40) * Math.PI,
        color: i % 2 ? item.colors[1] : item.colors[0],
      })),
    [item, placed.seed]
  );
  return (
    <group>
      <Contact r={0.34} />
      {blades.map((b, i) => (
        <SwayBlade
          key={i}
          w={b.w}
          h={b.h}
          color={b.color}
          phase={i * 1.3 + placed.seed * 6}
          bend={0.12}
          position={[b.x, 0, b.z]}
          rotation={[0, b.rot, 0]}
        />
      ))}
    </group>
  );
}

function Kelp({ item, placed }: P) {
  const blades = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => ({
        w: 0.16 + rand(placed.seed, i) * 0.09,
        h: 1.2 + rand(placed.seed, i + 10) * 1.1,
        x: (rand(placed.seed, i + 20) - 0.5) * 0.34,
        z: (rand(placed.seed, i + 30) - 0.5) * 0.34,
        rot: rand(placed.seed, i + 40) * Math.PI,
        color: i % 2 ? item.colors[1] : item.colors[0],
      })),
    [item, placed.seed]
  );
  return (
    <group>
      <Contact r={0.3} />
      {blades.map((b, i) => (
        <SwayBlade
          key={i}
          w={b.w}
          h={b.h}
          color={b.color}
          phase={i * 1.1 + placed.seed * 6}
          bend={0.34}
          segs={10}
          position={[b.x, 0, b.z]}
          rotation={[0, b.rot, 0]}
        />
      ))}
    </group>
  );
}

function Fan({ item, placed }: P) {
  const ref = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    if (ref.current)
      ref.current.rotation.z = Math.sin(clock.elapsedTime * 0.9 + placed.seed * 6) * 0.09;
  });
  return (
    <group>
      <Contact r={0.32} />
      <group ref={ref}>
        <mesh position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.035, 0.06, 0.36, 6]} />
          <meshStandardMaterial color={item.colors[0]} roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.72, 0]} rotation={[0, 0, 0]}>
          <circleGeometry args={[0.52, 20, Math.PI * 0.15, Math.PI * 0.7]} />
          <meshStandardMaterial
            color={item.colors[1]}
            side={THREE.DoubleSide}
            roughness={0.7}
          />
        </mesh>
        <mesh position={[0, 0.68, 0.02]}>
          <circleGeometry args={[0.4, 18, Math.PI * 0.18, Math.PI * 0.64]} />
          <meshStandardMaterial
            color={item.colors[0]}
            side={THREE.DoubleSide}
            roughness={0.7}
          />
        </mesh>
      </group>
    </group>
  );
}

function Anemone({ item, placed }: P) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const arms = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        const r = 0.14 + rand(placed.seed, i) * 0.1;
        return {
          x: Math.cos(a) * r,
          z: Math.sin(a) * r,
          h: 0.26 + rand(placed.seed, i + 20) * 0.22,
          tilt: 0.3 + rand(placed.seed, i + 40) * 0.5,
          a,
        };
      }),
    [placed.seed]
  );
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    arms.forEach((arm, i) => {
      const m = refs.current[i];
      if (!m) return;
      m.rotation.z = Math.cos(arm.a) * arm.tilt + Math.sin(t * 1.6 + i) * 0.16;
      m.rotation.x = -Math.sin(arm.a) * arm.tilt + Math.cos(t * 1.4 + i) * 0.16;
    });
  });
  return (
    <group>
      <Contact r={0.36} />
      <mesh position={[0, 0.11, 0]}>
        <sphereGeometry args={[0.26, 16, 10]} />
        <meshStandardMaterial color={item.colors[0]} roughness={0.7} />
      </mesh>
      {arms.map((arm, i) => (
        <group key={i} position={[arm.x, 0.2, arm.z]}>
          <mesh
            ref={(el) => {
              refs.current[i] = el;
            }}
            position={[0, arm.h / 2, 0]}
          >
            <capsuleGeometry args={[0.028, arm.h, 3, 6]} />
            <meshStandardMaterial color={item.colors[1]} roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ── Rocks ──────────────────────────────────────────────────────── */

function Pebbles({ item, placed }: P) {
  const stones = useMemo(
    () =>
      Array.from({ length: 4 }, (_, i) => ({
        r: 0.11 + rand(placed.seed, i) * 0.12,
        x: (rand(placed.seed, i + 10) - 0.5) * 0.6,
        z: (rand(placed.seed, i + 20) - 0.5) * 0.6,
        rot: rand(placed.seed, i + 30) * Math.PI,
        color: i % 2 ? item.colors[1] : item.colors[0],
      })),
    [item, placed.seed]
  );
  return (
    <group>
      <Contact r={0.42} />
      {stones.map((s, i) => (
        <mesh
          key={i}
          position={[s.x, s.r * 0.75, s.z]}
          rotation={[s.rot, s.rot * 2, s.rot * 0.5]}
          scale={[1, 0.75, 1]}
        >
          <dodecahedronGeometry args={[s.r, 0]} />
          <meshStandardMaterial color={s.color} flatShading roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function Boulder({ item, placed }: P) {
  return (
    <group>
      <Contact r={0.46} />
      <mesh position={[0, 0.26, 0]} rotation={[0.3, placed.seed * 6, 0.2]} scale={[1, 0.78, 0.9]}>
        <icosahedronGeometry args={[0.42, 0]} />
        <meshStandardMaterial color={item.colors[0]} flatShading roughness={0.9} />
      </mesh>
      <mesh position={[0.3, 0.12, 0.24]} rotation={[0.6, 1.2, 0]}>
        <dodecahedronGeometry args={[0.16, 0]} />
        <meshStandardMaterial color={item.colors[1]} flatShading roughness={0.9} />
      </mesh>
    </group>
  );
}

function Stack({ item, placed }: P) {
  const slabs = useMemo(
    () =>
      Array.from({ length: 4 }, (_, i) => ({
        r: 0.4 - i * 0.07,
        h: 0.1 + rand(placed.seed, i) * 0.06,
        rot: rand(placed.seed, i + 10) * Math.PI,
        color: i % 2 ? item.colors[1] : item.colors[0],
      })),
    [item, placed.seed]
  );
  let y = 0;
  return (
    <group>
      <Contact r={0.44} />
      {slabs.map((s, i) => {
        const py = y + s.h / 2;
        y += s.h;
        return (
          <mesh key={i} position={[0, py, 0]} rotation={[0, s.rot, 0]}>
            <cylinderGeometry args={[s.r, s.r * 1.05, s.h, 7]} />
            <meshStandardMaterial color={s.color} flatShading roughness={0.9} />
          </mesh>
        );
      })}
    </group>
  );
}

function Arch({ item }: P) {
  return (
    <group>
      <Contact r={0.55} />
      <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 1.6]}>
        <torusGeometry args={[0.42, 0.13, 6, 14, Math.PI]} />
        <meshStandardMaterial color={item.colors[0]} flatShading roughness={0.9} />
      </mesh>
      <mesh position={[-0.42, 0.09, 0]} scale={[1, 0.6, 1]}>
        <dodecahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial color={item.colors[1]} flatShading roughness={0.9} />
      </mesh>
      <mesh position={[0.42, 0.09, 0]} scale={[1, 0.6, 1]}>
        <dodecahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial color={item.colors[1]} flatShading roughness={0.9} />
      </mesh>
    </group>
  );
}

/* ── Coral ──────────────────────────────────────────────────────── */

function Brain({ item }: P) {
  return (
    <group>
      <Contact r={0.4} />
      <mesh position={[0, 0.12, 0]} scale={[1, 0.72, 1]}>
        <sphereGeometry args={[0.38, 20, 14]} />
        <meshStandardMaterial color={item.colors[0]} roughness={0.85} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0.26 - i * 0.05, 0]} rotation={[Math.PI / 2, 0, i * 0.7]}>
          <torusGeometry args={[0.14 + i * 0.09, 0.028, 6, 20]} />
          <meshStandardMaterial color={item.colors[1]} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function Staghorn({ item, placed }: P) {
  const branches = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 + placed.seed;
        return {
          a,
          tilt: 0.35 + rand(placed.seed, i) * 0.35,
          h: 0.4 + rand(placed.seed, i + 10) * 0.45,
        };
      }),
    [placed.seed]
  );
  return (
    <group>
      <Contact r={0.4} />
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.14, 0.22, 0.26, 8]} />
        <meshStandardMaterial color={item.colors[0]} roughness={0.85} />
      </mesh>
      {branches.map((b, i) => (
        <group key={i} rotation={[0, b.a, 0]} position={[0, 0.22, 0]}>
          <group rotation={[b.tilt, 0, 0]}>
            <mesh position={[0, b.h / 2, 0]}>
              <capsuleGeometry args={[0.055, b.h, 3, 7]} />
              <meshStandardMaterial color={item.colors[0]} roughness={0.85} />
            </mesh>
            <mesh position={[0.07, b.h * 0.85, 0]} rotation={[0, 0, -0.6]}>
              <capsuleGeometry args={[0.038, b.h * 0.45, 3, 7]} />
              <meshStandardMaterial color={item.colors[1]} roughness={0.85} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

function BubbleCoral({ item, placed }: P) {
  const beads = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        r: 0.09 + rand(placed.seed, i) * 0.09,
        x: (rand(placed.seed, i + 10) - 0.5) * 0.5,
        y: rand(placed.seed, i + 20) * 0.26,
        z: (rand(placed.seed, i + 30) - 0.5) * 0.5,
        color: i % 3 ? item.colors[0] : item.colors[1],
      })),
    [item, placed.seed]
  );
  return (
    <group>
      <Contact r={0.4} />
      {beads.map((b, i) => (
        <mesh key={i} position={[b.x, b.y + b.r * 0.8, b.z]}>
          <sphereGeometry args={[b.r, 14, 10]} />
          <meshStandardMaterial color={b.color} roughness={0.25} metalness={0.05} />
        </mesh>
      ))}
    </group>
  );
}

function TubeCoral({ item, placed }: P) {
  const tubes = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        h: 0.3 + rand(placed.seed, i) * 0.5,
        x: (rand(placed.seed, i + 10) - 0.5) * 0.42,
        z: (rand(placed.seed, i + 20) - 0.5) * 0.42,
        tilt: (rand(placed.seed, i + 30) - 0.5) * 0.4,
      })),
    [placed.seed]
  );
  return (
    <group>
      <Contact r={0.36} />
      {tubes.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} rotation={[t.tilt, 0, t.tilt]}>
          <mesh position={[0, t.h / 2, 0]}>
            <cylinderGeometry args={[0.06, 0.045, t.h, 8]} />
            <meshStandardMaterial color={item.colors[0]} roughness={0.8} />
          </mesh>
          <mesh position={[0, t.h, 0]}>
            <sphereGeometry args={[0.062, 10, 8]} />
            <meshStandardMaterial color={item.colors[1]} roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ── Decor ──────────────────────────────────────────────────────── */

function Chest({ item, placed }: P) {
  return (
    <group>
      <Contact r={0.42} />
      <mesh position={[0, 0.14, 0]}>
        <boxGeometry args={[0.6, 0.28, 0.4]} />
        <meshStandardMaterial color={item.colors[0]} roughness={0.85} />
      </mesh>
      <group position={[0, 0.28, -0.2]} rotation={[-0.7, 0, 0]}>
        <mesh position={[0, 0.06, 0.2]}>
          <boxGeometry args={[0.6, 0.12, 0.4]} />
          <meshStandardMaterial color={item.colors[0]} roughness={0.85} />
        </mesh>
      </group>
      <mesh position={[0, 0.14, 0]}>
        <boxGeometry args={[0.63, 0.06, 0.43]} />
        <meshStandardMaterial color={item.colors[1]} roughness={0.4} metalness={0.5} />
      </mesh>
      <group position={[0, 0.32, 0.05]}>
        <Bubbles count={5} height={2.0} spread={0.2} seed={placed.seed} />
      </group>
    </group>
  );
}

function Amphora({ item }: P) {
  return (
    <group>
      <Contact r={0.42} />
      <group rotation={[0, 0, 1.15]} position={[0, 0.22, 0]}>
        <mesh>
          <sphereGeometry args={[0.24, 16, 12]} />
          <meshStandardMaterial color={item.colors[0]} roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.26, 0]}>
          <cylinderGeometry args={[0.09, 0.14, 0.3, 12]} />
          <meshStandardMaterial color={item.colors[0]} roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.42, 0]}>
          <cylinderGeometry args={[0.12, 0.09, 0.08, 12]} />
          <meshStandardMaterial color={item.colors[1]} roughness={0.7} />
        </mesh>
      </group>
    </group>
  );
}

function Wreck({ item, placed }: P) {
  return (
    <group>
      <Contact r={0.9} />
      <group rotation={[0, 0, -0.22]}>
        <mesh position={[0, 0.3, 0]} scale={[1, 0.55, 0.5]}>
          <sphereGeometry args={[0.8, 16, 10]} />
          <meshStandardMaterial color={item.colors[0]} flatShading roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.52, 0]}>
          <boxGeometry args={[1.5, 0.1, 0.62]} />
          <meshStandardMaterial color={item.colors[1]} roughness={0.85} />
        </mesh>
        {[-0.5, -0.15, 0.2, 0.55].map((x, i) => (
          <mesh key={i} position={[x, 0.42, 0]}>
            <boxGeometry args={[0.05, 0.42, 0.66]} />
            <meshStandardMaterial color={item.colors[1]} roughness={0.9} />
          </mesh>
        ))}
        <mesh position={[-0.1, 1.0, 0]} rotation={[0, 0, 0.12]}>
          <cylinderGeometry args={[0.05, 0.06, 1.0, 8]} />
          <meshStandardMaterial color={item.colors[1]} roughness={0.9} />
        </mesh>
      </group>
      <group position={[0.5, 0.5, 0]}>
        <Bubbles count={4} height={1.7} spread={0.3} seed={placed.seed + 3} />
      </group>
    </group>
  );
}

const REGISTRY: Record<string, (p: P) => React.ReactElement> = {
  grass: Grass,
  kelp: Kelp,
  fan: Fan,
  anemone: Anemone,
  pebbles: Pebbles,
  boulder: Boulder,
  stack: Stack,
  arch: Arch,
  brain: Brain,
  staghorn: Staghorn,
  bubble: BubbleCoral,
  tube: TubeCoral,
  chest: Chest,
  amphora: Amphora,
  wreck: Wreck,
};

export function Scenery({ item, placed }: P) {
  // a Blender-authored mesh wins whenever one exists for this catalog id
  if (MODELLED.has(item.id)) {
    return <ReefModel id={item.id} />;
  }
  const Model = REGISTRY[item.variant];
  if (!Model) return null;
  return <Model item={item} placed={placed} />;
}

export const SCENERY_VARIANTS = Object.keys(REGISTRY);
