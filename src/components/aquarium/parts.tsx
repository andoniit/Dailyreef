"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** Deterministic pseudo-random from a seed, in [0,1). */
export function rand(seed: number, salt = 0): number {
  const x = Math.sin(seed * 9301.7 + salt * 233.13 + 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** A soft dark ellipse that grounds an object on the sand. */
export function Contact({ r = 0.4 }: { r?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <circleGeometry args={[r, 24]} />
      <meshBasicMaterial
        color="#1e3a5f"
        transparent
        opacity={0.14}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-8}
        polygonOffsetUnits={-8}
      />
    </mesh>
  );
}

/**
 * A flat blade whose vertices bend with the current. Base sits at y = 0.
 */
export function SwayBlade({
  w,
  h,
  color,
  phase,
  bend = 0.3,
  segs = 8,
  rotation,
  position,
}: {
  w: number;
  h: number;
  color: string;
  phase: number;
  bend?: number;
  segs?: number;
  rotation?: [number, number, number];
  position?: [number, number, number];
}) {
  const ref = useRef<THREE.Mesh>(null!);
  const base = useRef<Float32Array | null>(null);

  useFrame(({ clock }) => {
    const geo = ref.current?.geometry;
    if (!geo) return;
    const pos = geo.attributes.position;
    if (!base.current) base.current = Float32Array.from(pos.array as Float32Array);
    const t = clock.elapsedTime;
    for (let i = 0; i < pos.count; i++) {
      const y = base.current[i * 3 + 1];
      const k = Math.max(0, y / h + 0.5);
      const off = Math.sin(t * 1.1 + phase + k * 2.4) * bend * k * k;
      pos.setX(i, base.current[i * 3] + off);
      pos.setZ(i, base.current[i * 3 + 2] + off * 0.45);
    }
    pos.needsUpdate = true;
  });

  return (
    <group position={position} rotation={rotation}>
      <mesh ref={ref} position={[0, h / 2, 0]}>
        <planeGeometry args={[w, h, 1, segs]} />
        <meshStandardMaterial
          color={color}
          side={THREE.DoubleSide}
          roughness={0.75}
          metalness={0}
        />
      </mesh>
    </group>
  );
}

/** Bubbles drifting up from a point. */
export function Bubbles({
  count = 6,
  height = 2.4,
  spread = 0.16,
  seed = 0,
}: {
  count?: number;
  height?: number;
  spread?: number;
  seed?: number;
}) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const params = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        offset: rand(seed, i),
        speed: 0.28 + rand(seed, i + 40) * 0.3,
        x: (rand(seed, i + 80) - 0.5) * spread,
        z: (rand(seed, i + 120) - 0.5) * spread,
        r: 0.022 + rand(seed, i + 160) * 0.03,
      })),
    [count, seed, spread]
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    params.forEach((p, i) => {
      const m = refs.current[i];
      if (!m) return;
      const k = (p.offset + t * p.speed) % 1;
      m.position.y = k * height;
      m.position.x = p.x + Math.sin(t * 2 + i) * 0.05 * k;
      m.position.z = p.z + Math.cos(t * 1.6 + i) * 0.05 * k;
      const s = k < 0.06 ? k / 0.06 : k > 0.9 ? (1 - k) / 0.1 : 1;
      m.scale.setScalar(Math.max(0.001, s));
    });
  });

  return (
    <group>
      {params.map((p, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          <sphereGeometry args={[p.r, 8, 8]} />
          <meshStandardMaterial
            color="#e6f6ff"
            transparent
            opacity={0.55}
            roughness={0.1}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
