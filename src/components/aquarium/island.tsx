"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ISLAND_X, ISLAND_Z, TANK } from "@/lib/store";
import { floorAt } from "./terrain";
import { rand } from "./parts";

const { waterTop } = TANK;

/*
 * The island is anchored, not placed: it sits in the far corner — the one
 * away from the default camera — so it reads as a backdrop instead of
 * standing between the viewer and the reef. The anchor itself lives in
 * the store, next to the rest of the tank's dimensions.
 */

/** Footprint radius at the seabed, and how far the cap clears the water. */
const R = 1.25;
// Kept low on purpose: every unit above the water line pushes the cap
// up-screen under the ortho camera, and much more than this reads as an
// island hovering above the tank rather than sitting in it.
const FREEBOARD = 0.42;
/** Fraction of the radius that sits above the water line. */
const BEACH = 0.5;

const DRY = new THREE.Color("#f2e2be");
const WET = new THREE.Color("#d9c294");
const DEEP = new THREE.Color("#6c6752");

/**
 * Sand mound, built in world space so each rim vertex can be dropped onto
 * the real seabed height. Building it in local space and sitting it at one
 * height would leave a gap on the low side of the slope.
 */
function buildMound(seed: number): THREE.BufferGeometry {
  const RINGS = 26;
  const SEG = 46;
  const peakY = waterTop + FREEBOARD;

  // per-angle radius, so the shoreline is irregular rather than a circle
  const radii: number[] = [];
  for (let j = 0; j < SEG; j++) {
    const a = (j / SEG) * Math.PI * 2;
    const wob =
      Math.sin(a * 2 + seed * 7) * 0.5 +
      Math.sin(a * 3 - seed * 11) * 0.3 +
      Math.sin(a * 5 + seed * 3) * 0.2;
    radii.push(R * (0.88 + wob * 0.16));
  }

  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const c = new THREE.Color();

  const push = (x: number, y: number, z: number) => {
    pos.push(x, y, z);
    // dry above the water line, damp right at it, dimmer as it drops away
    if (y > waterTop + 0.04) {
      c.copy(DRY);
    } else if (y > waterTop - 0.3) {
      c.copy(WET).lerp(DRY, (y - (waterTop - 0.3)) / 0.34);
    } else {
      const t = THREE.MathUtils.clamp((waterTop - 0.3 - y) / 1.1, 0, 1);
      c.copy(WET).lerp(DEEP, t);
    }
    col.push(c.r, c.g, c.b);
  };

  // apex
  push(ISLAND_X, peakY, ISLAND_Z);

  for (let i = 1; i <= RINGS; i++) {
    const u = i / RINGS;
    for (let j = 0; j < SEG; j++) {
      const a = (j / SEG) * Math.PI * 2;
      const d = u * radii[j];
      const x = ISLAND_X + Math.cos(a) * d;
      const z = ISLAND_Z + Math.sin(a) * d;
      const bed = floorAt(x, z);

      let y: number;
      if (u < BEACH) {
        // gentle cap above the water
        const k = u / BEACH;
        y = waterTop + (peakY - waterTop) * (1 - k * k);
      } else {
        // steeper flank dropping to the seabed
        const k = (u - BEACH) / (1 - BEACH);
        y = bed + (waterTop - bed) * (1 - Math.pow(k, 1.6));
      }
      // roughen it, easing off at the rim so the skirt still meets the sand
      const rough =
        (Math.sin(x * 3.1 + z * 2.3 + seed) * 0.5 +
          Math.sin(x * 5.7 - z * 4.1) * 0.3) *
        0.07 *
        (1 - u) ** 0.6;
      push(x, y + rough, z);
    }
  }

  // apex fan
  for (let j = 0; j < SEG; j++) {
    idx.push(0, 1 + ((j + 1) % SEG), 1 + j);
  }
  // quad rings
  for (let i = 0; i < RINGS - 1; i++) {
    const a0 = 1 + i * SEG;
    const b0 = 1 + (i + 1) * SEG;
    for (let j = 0; j < SEG; j++) {
      const j2 = (j + 1) % SEG;
      idx.push(a0 + j, a0 + j2, b0 + j);
      idx.push(a0 + j2, b0 + j2, b0 + j);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();     // indexed => smooth, like the seabed
  return g;
}

/** Tapered, slightly leaning trunk swept along a curve. */
function buildTrunk(): THREE.BufferGeometry {
  const STEPS = 14;
  const SIDES = 9;
  const H = 1.0;
  const pos: number[] = [];
  const idx: number[] = [];

  for (let i = 0; i <= STEPS; i++) {
    const s = i / STEPS;
    // lean out and curve back — palms rarely grow straight
    const cx = 0.22 * s * s;
    const cz = 0.075 * s * s;
    const y = H * s;
    const r = 0.075 * (1 - s * 0.42);
    for (let j = 0; j < SIDES; j++) {
      const a = (j / SIDES) * Math.PI * 2;
      pos.push(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r);
    }
  }
  for (let i = 0; i < STEPS; i++) {
    for (let j = 0; j < SIDES; j++) {
      const j2 = (j + 1) % SIDES;
      const a = i * SIDES, b = (i + 1) * SIDES;
      idx.push(a + j, a + j2, b + j);
      idx.push(a + j2, b + j2, b + j);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * One frond: a strip that arcs up then droops, with a raised midrib.
 * The fold matters — a flat blade reads as a strip of paper from most
 * angles, and the whole crown looks limp.
 */
function buildFrond(): THREE.BufferGeometry {
  const N = 12;
  const L = 0.78;
  const pos: number[] = [];
  const idx: number[] = [];

  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const x = L * s;
    const y = 0.42 * Math.sin(s * 2.0) - 0.85 * s * s;
    const w = 0.17 * Math.pow(Math.sin(Math.PI * Math.min(s * 1.15, 1)), 0.7);
    const rib = 0.045 * (1 - s);
    pos.push(x, y, -w);          // left
    pos.push(x, y + rib, 0);     // midrib
    pos.push(x, y, w);           // right
  }
  for (let i = 0; i < N; i++) {
    const a = i * 3, b = (i + 1) * 3;
    idx.push(a, b, a + 1, a + 1, b, b + 1);        // left half
    idx.push(a + 1, b + 1, a + 2, a + 2, b + 1, b + 2); // right half
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function Palm({ seed }: { seed: number }) {
  const crown = useRef<THREE.Group>(null!);
  const trunk = useMemo(() => buildTrunk(), []);
  const frond = useMemo(() => buildFrond(), []);
  useEffect(() => () => { trunk.dispose(); frond.dispose(); }, [trunk, frond]);

  const fronds = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        yaw: (i / 9) * Math.PI * 2 + rand(seed, i) * 0.3,
        tilt: 0.15 + rand(seed, i + 20) * 0.5,
        scale: 0.85 + rand(seed, i + 40) * 0.3,
        phase: rand(seed, i + 60) * Math.PI * 2,
      })),
    [seed],
  );

  useFrame(({ clock }) => {
    if (crown.current) {
      const t = clock.elapsedTime;
      crown.current.rotation.z = Math.sin(t * 0.7 + seed) * 0.035;
      crown.current.rotation.x = Math.cos(t * 0.55 + seed * 2) * 0.028;
    }
  });

  return (
    <group>
      <mesh geometry={trunk} castShadow={false}>
        <meshStandardMaterial color="#8d6c4a" roughness={0.85} />
      </mesh>
      {/* crown rides on the trunk's leaning tip */}
      <group ref={crown} position={[0.22, 1.0, 0.075]}>
        {fronds.map((f, i) => (
          <group key={i} rotation={[0, f.yaw, f.tilt]} scale={f.scale}>
            <mesh geometry={frond}>
              <meshStandardMaterial
                color={i % 2 ? "#3f9c5a" : "#4bb168"}
                roughness={0.7}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        ))}
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.075, -0.05, Math.sin(a) * 0.075]}>
              <sphereGeometry args={[0.052, 8, 6]} />
              <meshStandardMaterial color="#6b4a2f" roughness={0.8} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

export function Island({ seed = 0.42 }: { seed?: number }) {
  const mound = useMemo(() => buildMound(seed), [seed]);
  useEffect(() => () => mound.dispose(), [mound]);

  // sit the palm on the cap, a little off-centre so it isn't a bullseye
  const px = ISLAND_X + 0.26;
  const pz = ISLAND_Z + 0.2;
  const capY = waterTop + FREEBOARD * 0.72;

  return (
    <group>
      <mesh geometry={mound}>
        <meshStandardMaterial vertexColors roughness={0.93} metalness={0} />
      </mesh>
      <group position={[px, capY, pz]}>
        <Palm seed={seed} />
      </group>
      {/* a couple of stones on the beach */}
      {[
        [-0.34, 0.16, 0.055],
        [0.1, -0.42, 0.042],
      ].map(([dx, dz, r], i) => (
        <mesh
          key={i}
          position={[ISLAND_X + dx, waterTop + FREEBOARD * 0.5, ISLAND_Z + dz]}
          rotation={[rand(seed, i) * 3, rand(seed, i + 5) * 3, 0]}
        >
          <dodecahedronGeometry args={[r, 0]} />
          <meshStandardMaterial color="#9c8f78" roughness={0.9} flatShading />
        </mesh>
      ))}
    </group>
  );
}
