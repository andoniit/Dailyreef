"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { rand } from "./parts";
import type { CatalogItem, PlacedItem } from "@/lib/types";
import { MODELLED, ReefModel } from "./ReefModel";

type P = { item: CatalogItem; placed: PlacedItem };

const DEEP = -0.55;
const HIGH = 1.6;

/** Elliptical wander path with a slow vertical bob. */
function makePath(seed: number, band: number, rx: number, rz: number) {
  const wob = 0.6 + rand(seed, 7) * 0.8;
  return (t: number, out: THREE.Vector3) =>
    out.set(
      Math.sin(t) * rx + Math.sin(t * 2.3 + seed) * 0.18,
      band + Math.sin(t * wob + seed * 3) * 0.28,
      Math.cos(t * 0.83 + seed * 2) * rz
    );
}

function Swimmer({
  seed,
  band,
  speed,
  upright = false,
  children,
}: {
  seed: number;
  band: number;
  speed: number;
  upright?: boolean;
  children: React.ReactNode;
}) {
  const g = useRef<THREE.Group>(null!);
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  const rx = 1.15 + rand(seed, 1) * 0.85;
  const rz = 1.0 + rand(seed, 2) * 0.85;
  const path = useMemo(() => makePath(seed, band, rx, rz), [seed, band, rx, rz]);

  useFrame(({ clock }) => {
    if (!g.current) return;
    const t = clock.elapsedTime * speed + seed * 12;
    path(t, a);
    g.current.position.copy(a);
    if (!upright) {
      path(t + 0.04, b);
      g.current.lookAt(b);
      g.current.rotation.z = Math.sin(t) * 0.12;
    }
  });

  return <group ref={g}>{children}</group>;
}

function Eyes({ z = 0.3, x = 0.15, y = 0.1 }: { z?: number; x?: number; y?: number }) {
  return (
    <>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[x * s, y, z]}>
          <sphereGeometry args={[0.045, 8, 8]} />
          <meshStandardMaterial color="#1c2b3a" roughness={0.3} />
        </mesh>
      ))}
    </>
  );
}

/** Tail fan that flaps side to side. Points backwards (-Z). */
function Tail({ color, size = 1, speed = 7 }: { color: string; size?: number; speed?: number }) {
  const g = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    if (g.current) g.current.rotation.y = Math.sin(clock.elapsedTime * speed) * 0.45;
  });
  return (
    <group ref={g} position={[0, 0, -0.34 * size]}>
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <mesh scale={[0.3, 1, 1.25]}>
          <coneGeometry args={[0.22 * size, 0.38 * size, 10]} />
          <meshStandardMaterial color={color} roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

function BodyFish({ item, scale, tall = false }: { item: CatalogItem; scale: number; tall?: boolean }) {
  const [a, b] = item.colors;
  return (
    <group scale={scale}>
      <mesh scale={tall ? [0.32, 0.95, 0.72] : [0.46, 0.62, 1]}>
        <sphereGeometry args={[0.42, 18, 14]} />
        <meshStandardMaterial color={a} roughness={0.45} />
      </mesh>
      {/* belly */}
      <mesh position={[0, -0.07, 0.02]} scale={tall ? [0.26, 0.7, 0.6] : [0.38, 0.44, 0.86]}>
        <sphereGeometry args={[0.42, 16, 12]} />
        <meshStandardMaterial color={b} roughness={0.5} />
      </mesh>
      {/* dorsal */}
      <mesh position={[0, tall ? 0.38 : 0.22, -0.02]} scale={[0.09, 1, 0.7]}>
        <coneGeometry args={[0.2, tall ? 0.44 : 0.24, 8]} />
        <meshStandardMaterial color={b} roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
      {tall && (
        <mesh position={[0, -0.36, -0.02]} rotation={[Math.PI, 0, 0]} scale={[0.09, 1, 0.6]}>
          <coneGeometry args={[0.18, 0.36, 8]} />
          <meshStandardMaterial color={b} roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* pectoral fins */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[0.17 * s, -0.02, 0.06]}
          rotation={[0, 0, -0.5 * s]}
          scale={[0.08, 0.5, 0.35]}
        >
          <coneGeometry args={[0.2, 0.3, 7]} />
          <meshStandardMaterial color={b} roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <Eyes z={0.3} x={0.13} y={0.08} />
      <Tail color={b} size={tall ? 0.8 : 1} />
    </group>
  );
}

function Seahorse({ item }: P) {
  const [a, b] = item.colors;
  return (
    <group scale={0.9}>
      <mesh position={[0, 0, 0]} scale={[0.7, 1, 0.7]}>
        <capsuleGeometry args={[0.14, 0.3, 4, 10]} />
        <meshStandardMaterial color={a} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.3, 0.04]} rotation={[0.4, 0, 0]}>
        <sphereGeometry args={[0.13, 14, 10]} />
        <meshStandardMaterial color={a} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.32, 0.2]} rotation={[1.3, 0, 0]}>
        <coneGeometry args={[0.05, 0.22, 8]} />
        <meshStandardMaterial color={b} roughness={0.6} />
      </mesh>
      <mesh position={[0, -0.3, -0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.12, 0.045, 6, 16, Math.PI * 1.5]} />
        <meshStandardMaterial color={b} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.02, -0.14]} scale={[0.08, 0.7, 0.5]}>
        <coneGeometry args={[0.16, 0.3, 8]} />
        <meshStandardMaterial color={b} roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
      <Eyes z={0.1} x={0.09} y={0.33} />
    </group>
  );
}

function Jelly({ item, placed }: P) {
  const bell = useRef<THREE.Group>(null!);
  const tent = useRef<(THREE.Mesh | null)[]>([]);
  const [a, b] = item.colors;
  const arms = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => {
        const ang = (i / 8) * Math.PI * 2;
        return { x: Math.cos(ang) * 0.16, z: Math.sin(ang) * 0.16, h: 0.35 + rand(placed.seed, i) * 0.35 };
      }),
    [placed.seed]
  );
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pulse = 1 + Math.sin(t * 1.6 + placed.seed * 6) * 0.14;
    if (bell.current) bell.current.scale.set(2 - pulse, pulse, 2 - pulse);
    arms.forEach((_, i) => {
      const m = tent.current[i];
      if (m) m.rotation.x = Math.sin(t * 1.4 + i) * 0.24;
    });
  });
  return (
    <group>
      <group ref={bell}>
        <mesh>
          <sphereGeometry args={[0.3, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial
            color={a}
            transparent
            opacity={0.75}
            roughness={0.2}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh position={[0, -0.02, 0]}>
          <torusGeometry args={[0.29, 0.03, 6, 20]} />
          <meshStandardMaterial color={b} transparent opacity={0.85} roughness={0.3} />
        </mesh>
      </group>
      {arms.map((arm, i) => (
        <group key={i} position={[arm.x, -0.02, arm.z]}>
          <mesh
            ref={(el) => {
              tent.current[i] = el;
            }}
            position={[0, -arm.h / 2, 0]}
          >
            <capsuleGeometry args={[0.014, arm.h, 3, 6]} />
            <meshStandardMaterial color={b} transparent opacity={0.7} roughness={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Ray({ item }: P) {
  const wings = useRef<(THREE.Group | null)[]>([]);
  const [a, b] = item.colors;
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    wings.current.forEach((w, i) => {
      if (w) w.rotation.z = Math.sin(t * 1.8) * 0.42 * (i === 0 ? 1 : -1);
    });
  });
  return (
    <group scale={1.05}>
      <mesh scale={[0.4, 0.2, 0.9]}>
        <sphereGeometry args={[0.42, 16, 12]} />
        <meshStandardMaterial color={a} roughness={0.5} />
      </mesh>
      {[0, 1].map((i) => (
        <group
          key={i}
          ref={(el) => {
            wings.current[i] = el;
          }}
          position={[0.1 * (i === 0 ? 1 : -1), 0.02, 0]}
        >
          <mesh
            rotation={[Math.PI / 2, 0, i === 0 ? -0.15 : Math.PI + 0.15]}
            scale={[1, 1, 0.42]}
          >
            <circleGeometry args={[0.72, 20, 0, Math.PI]} />
            <meshStandardMaterial color={a} roughness={0.5} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0, -0.55]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.04, 0.9, 7]} />
        <meshStandardMaterial color={b} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.02, 0.3]} scale={[0.42, 0.3, 0.4]}>
        <sphereGeometry args={[0.3, 14, 10]} />
        <meshStandardMaterial color={b} roughness={0.5} />
      </mesh>
      <Eyes z={0.34} x={0.11} y={0.09} />
    </group>
  );
}

export function Fish({ item, placed }: P) {
  const seed = placed.seed;
  const v = item.variant;

  // modelled species keep the procedural swim path, only the body changes.
  // jelly and seahorse hold themselves upright instead of steering.
  if (MODELLED.has(item.id)) {
    const motion =
      v === "jelly"
        ? { band: 0.9 + rand(seed, 5) * 0.7, speed: 0.13, upright: true }
        : v === "seahorse"
          ? { band: -0.2 + rand(seed, 5) * 0.5, speed: 0.09, upright: true }
          : v === "ray"
            ? { band: DEEP + rand(seed, 5) * 0.5, speed: 0.16, upright: false }
            : {
                band: DEEP + rand(seed, 5) * (HIGH - DEEP),
                speed: v === "small" ? 0.42 : 0.3,
                upright: false,
              };
    return (
      <Swimmer
        seed={seed}
        band={motion.band}
        speed={motion.speed}
        upright={motion.upright}
      >
        <ReefModel id={item.id} />
      </Swimmer>
    );
  }

  if (v === "jelly") {
    return (
      <Swimmer seed={seed} band={0.9 + rand(seed, 5) * 0.7} speed={0.13} upright>
        <Jelly item={item} placed={placed} />
      </Swimmer>
    );
  }
  if (v === "seahorse") {
    return (
      <Swimmer seed={seed} band={-0.2 + rand(seed, 5) * 0.5} speed={0.09} upright>
        <Seahorse item={item} placed={placed} />
      </Swimmer>
    );
  }
  if (v === "ray") {
    return (
      <Swimmer seed={seed} band={DEEP + rand(seed, 5) * 0.5} speed={0.16}>
        <Ray item={item} placed={placed} />
      </Swimmer>
    );
  }

  const band = DEEP + rand(seed, 5) * (HIGH - DEEP);
  const scale = v === "small" ? 0.78 : v === "tall" ? 1.0 : 1.12;
  const speed = v === "small" ? 0.42 : 0.3;

  return (
    <Swimmer seed={seed} band={band} speed={speed}>
      <BodyFish item={item} scale={scale} tall={v === "tall"} />
    </Swimmer>
  );
}
