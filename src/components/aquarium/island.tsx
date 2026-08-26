"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TANK } from "@/lib/store";
import { W, floorAt } from "./terrain";
import { rand } from "./parts";

const { waterTop } = TANK;

/*
 * The island fills the far corner of the block and is cut flush by the two
 * tank faces, the way the reference diorama is. That shape falls out of a
 * quarter-polar fan anchored exactly at the corner: the fan's two straight
 * edges lie along z = -W/2 and x = -W/2, so they land on the walls without
 * any clipping work, and the outer arc feathers down into the seabed.
 */
const CX = -W / 2;
const CZ = -W / 2;

/** Footprint radius from the corner, and how far the cap clears the water. */
const R = 2.15;
const FREEBOARD = 0.46;
/** Plateau ends here, beach runs to here, then it drops to the seabed. */
const PLATEAU = 0.4;
const SHORE = 0.72;

const DRY = new THREE.Color("#f4e6c4");
const WET = new THREE.Color("#d8c093");
const DEEP = new THREE.Color("#b3a482");
const CUT = new THREE.Color("#e2cfa6");

const PEAK = waterTop + FREEBOARD;

/** Island surface height at a normalised radius, given the seabed below. */
function surfaceAt(u: number, bed: number): number {
  if (u < PLATEAU) {
    const k = u / PLATEAU;
    return PEAK - 0.07 * k * k;               // faintly crowned plateau
  }
  if (u < SHORE) {
    const k = (u - PLATEAU) / (SHORE - PLATEAU);
    return THREE.MathUtils.lerp(PEAK - 0.07, waterTop - 0.06, k * k * (3 - 2 * k));
  }
  const k = (u - SHORE) / (1 - SHORE);
  return THREE.MathUtils.lerp(waterTop - 0.06, bed, Math.pow(k, 1.45));
}

/**
 * Surface roughening. Factored out because the top surface and the cut
 * faces MUST agree on it — computing it in one place and not the other
 * leaves the cut edge floating above or below the surface it is meant to
 * close, which opens slivers along the whole join.
 */
function roughAt(x: number, z: number, u: number, seed: number): number {
  // fades out below the waterline so the submerged skirt still meets the
  // seabed cleanly
  const dry = Math.max(0, 1 - u / SHORE);

  const lumps =
    (Math.sin(x * 3.3 + z * 2.7 + seed) * 0.5 + Math.sin(x * 6.1 - z * 4.7) * 0.3) *
    0.06 *
    dry;

  // Ripples key off distance from the corner, not x/z, so they run
  // parallel to the shoreline the way a real beach's do. Keying them to
  // x/z instead gives a diagonal corduroy that reads as a texture bug.
  const d = Math.hypot(x - CX, z - CZ);
  const wander = Math.sin(x * 2.1 + z * 1.7 + seed * 3) * 0.8;
  const ripple = Math.sin(d * 14.0 + wander) * 0.013 * dry;

  return lumps + ripple;
}

/** The island's finished height at a point — the only definition of it. */
function islandY(x: number, z: number, u: number, seed: number): number {
  return surfaceAt(u, floorAt(x, z)) + roughAt(x, z, u, seed);
}

function sandColor(y: number, out: THREE.Color): THREE.Color {
  if (y > waterTop + 0.03) return out.copy(DRY);
  if (y > waterTop - 0.28) {
    return out.copy(WET).lerp(DRY, (y - (waterTop - 0.28)) / 0.31);
  }
  const t = THREE.MathUtils.clamp((waterTop - 0.28 - y) / 1.1, 0, 1);
  return out.copy(WET).lerp(DEEP, t);
}

function buildIsland(seed: number): THREE.BufferGeometry {
  const RINGS = 28;
  const SEG = 34;

  // per-angle radius so the shoreline is ragged rather than a clean arc
  const radii: number[] = [];
  for (let j = 0; j <= SEG; j++) {
    const a = (j / SEG) * (Math.PI / 2);
    const wob =
      Math.sin(a * 4 + seed * 7) * 0.5 +
      Math.sin(a * 7 - seed * 11) * 0.3 +
      Math.sin(a * 11 + seed * 3) * 0.2;
    radii.push(R * (0.9 + wob * 0.13));
  }

  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const c = new THREE.Color();

  const vert = (x: number, y: number, z: number, tint?: THREE.Color) => {
    pos.push(x, y, z);
    if (tint) {
      col.push(tint.r, tint.g, tint.b);
    } else {
      // fine light/dark speckle so the beach reads as grains rather than
      // a flat tinted surface
      const t = sandColor(y, c);
      const sp =
        Math.sin(x * 47.0 + 1.3) * Math.sin(z * 53.0 - 0.7) +
        Math.sin((x + z) * 89.0) * 0.5;
      const k = 1 + sp * 0.04;
      col.push(t.r * k, t.g * k, t.b * k);
    }
    return pos.length / 3 - 1;
  };

  // ── top surface: quarter fan from the corner ────────────────────
  const apex = vert(CX, islandY(CX, CZ, 0, seed), CZ);

  const ringStart: number[] = [];
  for (let i = 1; i <= RINGS; i++) {
    ringStart.push(pos.length / 3);
    const u = i / RINGS;
    for (let j = 0; j <= SEG; j++) {
      const a = (j / SEG) * (Math.PI / 2);
      const d = u * radii[j];
      const x = CX + Math.cos(a) * d;
      const z = CZ + Math.sin(a) * d;
      vert(x, islandY(x, z, u, seed), z);
    }
  }

  for (let j = 0; j < SEG; j++) {
    idx.push(apex, ringStart[0] + j + 1, ringStart[0] + j);
  }
  for (let i = 0; i < RINGS - 1; i++) {
    const a0 = ringStart[i];
    const b0 = ringStart[i + 1];
    for (let j = 0; j < SEG; j++) {
      idx.push(a0 + j, a0 + j + 1, b0 + j);
      idx.push(a0 + j + 1, b0 + j + 1, b0 + j);
    }
  }

  // ── the two cut faces, flush against the tank walls ─────────────
  // Separate vertices on purpose: sharing them with the top surface
  // would let computeVertexNormals round the edge off, and the whole
  // point of the cut is that it reads as a hard slice.
  for (const edge of [0, SEG]) {
    let prevTop = -1;
    let prevBot = -1;
    // Starts at i = 0 — the corner itself. Beginning one ring out leaves
    // the corner column unclosed, and you can see straight through the
    // resulting wedge into the water behind.
    for (let i = 0; i <= RINGS; i++) {
      const u = i / RINGS;
      const a = (edge / SEG) * (Math.PI / 2);
      const d = u * radii[edge];
      const x = CX + Math.cos(a) * d;
      const z = CZ + Math.sin(a) * d;
      const bed = floorAt(x, z);
      const top = islandY(x, z, u, seed);
      if (top <= bed + 0.005) break;         // island has run out

      const tTop = vert(x, top, z, CUT);
      const tBot = vert(x, bed, z, CUT.clone().multiplyScalar(0.82));
      if (prevTop >= 0) {
        // wind each face outward, away from the tank's interior
        if (edge === 0) {
          idx.push(prevTop, tTop, prevBot, tTop, tBot, prevBot);
        } else {
          idx.push(prevTop, prevBot, tTop, tTop, prevBot, tBot);
        }
      }
      prevTop = tTop;
      prevBot = tBot;
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Trunk: tapered, leaning, and ringed. The horizontal banding is the
 * thing that makes a palm read as a palm rather than a stick — it comes
 * from modulating the radius along the sweep, with the grooves darkened
 * through vertex colour so they hold up even when the shading is flat.
 */
const BARK_LIT = new THREE.Color("#a9764a");
const BARK_DARK = new THREE.Color("#6f4a2c");

function buildTrunk(): THREE.BufferGeometry {
  const STEPS = 40;
  const SIDES = 12;
  const BANDS = 9;
  const H = 1.05;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const c = new THREE.Color();

  for (let i = 0; i <= STEPS; i++) {
    const s = i / STEPS;
    const cx = 0.26 * s * s;                 // palms rarely grow straight
    const cz = 0.09 * s * s;
    const ring = Math.sin(s * BANDS * Math.PI * 2);
    const r = 0.088 * (1 - s * 0.46) * (1 + ring * 0.085);
    // grooves darker than the ridges
    c.copy(BARK_DARK).lerp(BARK_LIT, 0.5 + ring * 0.5);
    for (let j = 0; j < SIDES; j++) {
      const a = (j / SIDES) * Math.PI * 2;
      pos.push(cx + Math.cos(a) * r, H * s, cz + Math.sin(a) * r);
      col.push(c.r, c.g, c.b);
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
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const LEAF_DARK = new THREE.Color("#2f7c43");
const LEAF_LIT = new THREE.Color("#5fbe72");

/**
 * One frond: a broad leaf that arcs up then droops, folded along a raised
 * midrib and notched down both edges.
 *
 * The notches are what sell it. A smooth-edged blade reads as a canoe
 * paddle at any size; alternating the half-width section by section gives
 * the sawtooth leaflet silhouette a palm actually has, for no extra
 * geometry. The midrib fold matters too — flat blades look like paper.
 */
function buildFrond(): THREE.BufferGeometry {
  const N = 22;
  const L = 0.86;
  const WIDE = 0.23;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const c = new THREE.Color();

  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const y = 0.38 * Math.sin(s * 2.1) - 0.72 * s * s;   // arc, then droop
    // leaf outline: narrow at the stem, broad through the middle, pointed
    const shape = Math.pow(Math.sin(Math.PI * Math.pow(Math.min(s * 1.06, 1), 0.72)), 0.8);
    const notch = i % 2 === 0 ? 1 : 0.7;                 // leaflet sawtooth
    const w = WIDE * shape * notch;
    const rib = 0.055 * (1 - s * 0.8);
    // edges curl down and away from the midrib
    const droop = 0.085 * Math.pow(shape, 1.5);

    c.copy(LEAF_DARK).lerp(LEAF_LIT, 0.25 + s * 0.5);
    const edge = c.clone().multiplyScalar(0.9);

    pos.push(L * s, y - droop, -w);
    col.push(edge.r, edge.g, edge.b);
    pos.push(L * s, y + rib, 0);
    col.push(c.r, c.g, c.b);
    pos.push(L * s, y - droop, w);
    col.push(edge.r, edge.g, edge.b);
  }
  for (let i = 0; i < N; i++) {
    const a = i * 3, b = (i + 1) * 3;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
    idx.push(a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Wind strength at time t, in 0..1.
 *
 * A single sine reads as a metronome. Real wind arrives in gusts, so a
 * slow envelope built from two incommensurate rates rides under the
 * faster sway — the tree leans into a gust, holds, and eases back.
 */
function gustAt(t: number): number {
  const env = 0.55 + 0.45 * Math.sin(t * 0.23) * Math.sin(t * 0.37 + 1.1);
  return Math.max(0, env);
}

function Palm({ seed, scale = 1 }: { seed: number; scale?: number }) {
  const tree = useRef<THREE.Group>(null!);
  const crown = useRef<THREE.Group>(null!);
  const blades = useRef<(THREE.Group | null)[]>([]);
  const trunk = useMemo(() => buildTrunk(), []);
  const frond = useMemo(() => buildFrond(), []);
  useEffect(() => () => { trunk.dispose(); frond.dispose(); }, [trunk, frond]);

  const fronds = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        yaw: (i / 8) * Math.PI * 2 + rand(seed, i) * 0.28,
        // spread of tilts so the crown has depth instead of forming a
        // flat parasol — a few reach out, a few sit up near the centre
        tilt: 0.06 + rand(seed, i + 20) * 0.72,
        s: 0.9 + rand(seed, i + 40) * 0.28,
      })),
    [seed],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const g = gustAt(t + seed);

    // The whole tree bends from the base. Rotating the trunk group is
    // what carries the crown with it — displacing trunk vertices in a
    // shader would bend the wood and leave the fronds hanging in the air.
    if (tree.current) {
      const lean = (Math.sin(t * 1.05 + seed) * 0.62 + Math.sin(t * 1.9 + 1.3) * 0.38) * g;
      tree.current.rotation.z = -0.055 - lean * 0.075;
      tree.current.rotation.x = Math.cos(t * 0.83 + seed * 2) * 0.03 * g;
    }

    // crown lags the trunk slightly, so the top whips rather than
    // travelling rigidly with it
    if (crown.current) {
      const lag = Math.sin(t * 1.05 + seed - 0.5) * g;
      crown.current.rotation.z = lag * 0.09;
      crown.current.rotation.x = Math.cos(t * 0.9 + seed * 2 - 0.4) * 0.05 * g;
    }

    // individual fronds flutter on their own phases
    blades.current.forEach((b, i) => {
      if (!b) return;
      const ph = i * 1.7 + seed * 5;
      b.rotation.z = fronds[i].tilt + Math.sin(t * 2.3 + ph) * 0.12 * g;
      b.rotation.y = fronds[i].yaw + Math.sin(t * 1.6 + ph) * 0.05 * g;
    });
  });

  return (
    // outer group pivots at the base — this is the trunk bending
    <group ref={tree} scale={scale}>
      <mesh geometry={trunk}>
        <meshStandardMaterial vertexColors roughness={0.88} metalness={0} />
      </mesh>
      <group ref={crown} position={[0.26, 1.05, 0.09]}>
        {fronds.map((f, i) => (
          <group
            key={i}
            ref={(el) => {
              blades.current[i] = el;
            }}
            rotation={[0, f.yaw, f.tilt]}
            scale={f.s}
          >
            <mesh geometry={frond}>
              <meshStandardMaterial
                vertexColors
                roughness={0.72}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        ))}
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.075, -0.055, Math.sin(a) * 0.075]}>
              <sphereGeometry args={[0.045, 8, 6]} />
              <meshStandardMaterial color="#6b4a2f" roughness={0.8} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

/**
 * A spiky shore plant: a rosette of stiff, tapered blades.
 *
 * Built as flat strips rather than cones — a cone reads as a spike from
 * every angle, whereas a broad tapering blade turns edge-on as it rotates
 * and gives the clump the varied silhouette the reference has.
 */
function buildRosette(seed: number): THREE.BufferGeometry {
  const BLADES = 9;
  const N = 5;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const c = new THREE.Color();
  const DARK = new THREE.Color("#2f8f45");
  const LIT = new THREE.Color("#63d977");

  for (let b = 0; b < BLADES; b++) {
    const yaw = (b / BLADES) * Math.PI * 2 + rand(seed, b) * 0.35;
    const lean = 0.45 + rand(seed, b + 12) * 0.75;      // upright .. splayed
    const len = 0.2 + rand(seed, b + 24) * 0.13;
    const wide = 0.045 + rand(seed, b + 36) * 0.02;
    const base = pos.length / 3;

    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const out = Math.sin(lean) * len * t;
      const up = Math.cos(lean) * len * t + 0.02;
      const w = wide * (1 - t) ** 0.8;
      const nx = -Math.sin(yaw), nz = Math.cos(yaw);
      const cx = Math.cos(yaw) * out, cz = Math.sin(yaw) * out;
      c.copy(DARK).lerp(LIT, 0.25 + t * 0.6);
      pos.push(cx - nx * w, up, cz - nz * w);
      col.push(c.r, c.g, c.b);
      pos.push(cx + nx * w, up + w * 0.5, cz + nz * w);
      col.push(c.r, c.g, c.b);
    }
    for (let i = 0; i < N; i++) {
      const a = base + i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Five-armed starfish, domed slightly so it isn't a flat decal. */
function buildStar(): THREE.BufferGeometry {
  const ARMS = 5;
  const OUT = 0.085;
  const IN = 0.036;
  const pos: number[] = [0, 0.022, 0];
  const idx: number[] = [];
  const n = ARMS * 2;

  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? OUT : IN;
    pos.push(Math.cos(a) * r, i % 2 === 0 ? 0.004 : 0.014, Math.sin(a) * r);
  }
  for (let i = 0; i < n; i++) {
    idx.push(0, 1 + ((i + 1) % n), 1 + i);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Point on the island's surface at radius d, angle a from the corner. */
function onIsland(d: number, a: number): [number, number, number] {
  const x = CX + Math.cos(a) * d;
  const z = CZ + Math.sin(a) * d;
  return [x, islandY(x, z, d / R, 0.42) - 0.02, z];
}

export function Island({ seed = 0.42 }: { seed?: number }) {
  const geo = useMemo(() => buildIsland(seed), [seed]);
  const rosette = useMemo(() => buildRosette(seed), [seed]);
  const star = useMemo(() => buildStar(), []);
  useEffect(
    () => () => {
      geo.dispose();
      rosette.dispose();
      star.dispose();
    },
    [geo, rosette, star],
  );

  const palm = onIsland(1.0, Math.PI * 0.28);

  // scattered across the dry beach, clear of the palm
  const plants: Array<[number, number, number]> = [
    [1.34, Math.PI * 0.12, 1.0],
    [1.18, Math.PI * 0.40, 0.82],
    [0.72, Math.PI * 0.46, 0.68],
    [1.5, Math.PI * 0.30, 0.9],
  ];
  const stars: Array<[number, number]> = [
    [1.62, Math.PI * 0.2],
    [1.5, Math.PI * 0.42],
  ];

  return (
    <group>
      <mesh geometry={geo}>
        <meshStandardMaterial vertexColors roughness={0.93} metalness={0} />
      </mesh>

      <group position={palm}>
        <Palm seed={seed} />
      </group>

      {plants.map(([d, a, sc], i) => {
        const p = onIsland(d, a);
        return (
          <group key={`p${i}`} position={p} scale={sc} rotation={[0, rand(seed, i) * 6, 0]}>
            <mesh geometry={rosette}>
              <meshStandardMaterial
                vertexColors
                roughness={0.62}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        );
      })}

      {stars.map(([d, a], i) => {
        const p = onIsland(d, a);
        return (
          <mesh
            key={`s${i}`}
            geometry={star}
            position={p}
            rotation={[0, rand(seed, i + 40) * 6, 0]}
          >
            <meshStandardMaterial color="#f4603f" roughness={0.75} flatShading />
          </mesh>
        );
      })}

      {/* shore stones */}
      {[
        [1.55, Math.PI * 0.08, 0.07],
        [1.42, Math.PI * 0.44, 0.055],
        [0.85, Math.PI * 0.06, 0.045],
        [1.62, Math.PI * 0.33, 0.062],
        [1.05, Math.PI * 0.22, 0.04],
      ].map(([d, a, r], i) => {
        const p = onIsland(d, a);
        return (
          <mesh
            key={i}
            position={[p[0], p[1] + r * 0.5, p[2]]}
            rotation={[rand(seed, i) * 3, rand(seed, i + 5) * 3, rand(seed, i + 9) * 3]}
          >
            <dodecahedronGeometry args={[r, 0]} />
            <meshStandardMaterial color="#a2957c" roughness={0.9} flatShading />
          </mesh>
        );
      })}
    </group>
  );
}
