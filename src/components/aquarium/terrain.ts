import * as THREE from "three";
import { TANK } from "@/lib/store";

export const W = 6;
const { floorY, sandBottom } = TANK;

/** Strata boundaries down the cut face, top band first. */
const BANDS = [-1.74, -2.04, -2.34, sandBottom];

/**
 * Deterministic PRNG, so every generated field is stable across reloads
 * and hot-reloads rather than reshuffling on each build.
 */
function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * Seabed relief relative to floorY: a diagonal slope plus dunes.
 * Kept fully submerged — a dry shelf would strand items and fish.
 * Single source of truth: the mesh and item placement both read it.
 */
export function terrainHeight(x: number, z: number): number {
  const u = (x + z) / W;
  const slope = 0.34 * Math.tanh(u * 1.6);
  const dunes =
    Math.sin(x * 0.9 + 1.3) * 0.055 +
    Math.cos(z * 1.1 - 0.7) * 0.055 +
    Math.sin((x + z) * 0.55) * 0.045 +
    Math.sin(x * 2.1 - z * 1.7) * 0.02;
  return slope + dunes;
}

export function floorAt(x: number, z: number): number {
  return floorY + terrainHeight(x, z);
}

const RELIEF_MIN = -0.52;
const RELIEF_MAX = 0.52;

/**
 * Seabed sand tint. Ported from the Cycles study: warm tan in the
 * shallows darkening with depth, rather than a flat colour.
 */
function sandColor(
  relief: number,
  shallow: THREE.Color,
  deep: THREE.Color,
  out: THREE.Color,
): THREE.Color {
  const t = THREE.MathUtils.clamp(
    (RELIEF_MAX - relief) / (RELIEF_MAX - RELIEF_MIN),
    0,
    1,
  );
  return out.copy(shallow).lerp(deep, Math.pow(t, 0.8));
}

/**
 * The seabed only — indexed and smooth-shaded. Smooth normals are most
 * of what separated the Cycles render from the faceted low-poly look.
 */
/**
 * High-frequency detail sitting on top of the dune shape — sand ripples
 * and grain. Deliberately separate from terrainHeight() so item placement
 * and the shader's shoreline stay on the smooth base surface and don't
 * jitter with the grain.
 */
export function sandGrain(x: number, z: number): number {
  return (
    Math.sin(x * 9.1 + z * 4.3) * 0.009 +
    Math.sin(x * 3.7 - z * 11.2) * 0.007 +
    Math.sin((x + z) * 17.5) * 0.004 +
    Math.sin(x * 31.0 - z * 27.0) * 0.002
  );
}

export function buildSeabed(sandHex: string, divisions = 112): THREE.BufferGeometry {
  const shallow = new THREE.Color(sandHex);
  const deep = shallow.clone().lerp(new THREE.Color("#146b7a"), 0.42);
  const scratch = new THREE.Color();

  const g = new THREE.PlaneGeometry(W, W, divisions, divisions);
  g.rotateX(-Math.PI / 2);

  const pos = g.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const relief = terrainHeight(x, z);
    pos.setY(i, floorY + relief + sandGrain(x, z));
    const c = sandColor(relief, shallow, deep, scratch);
    // grain speckle: light and dark specks so it reads as sand rather
    // than a flat tinted surface
    const sp =
      Math.sin(x * 53.0 + 1.7) * Math.sin(z * 61.0 - 0.9) +
      Math.sin(x * 97.0 - z * 71.0) * 0.6;
    const k = 1.0 + sp * 0.055;
    colors[i * 3] = c.r * k;
    colors[i * 3 + 1] = c.g * k;
    colors[i * 3 + 2] = c.b * k;
  }
  pos.needsUpdate = true;
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();      // indexed => smooth
  return g;
}

/**
 * Cut walls and base cap — deliberately flat-shaded so the strata read
 * as crisp bands instead of blurring into each other.
 */
export function buildWalls(strataHex: string, divisions = 72): THREE.BufferGeometry {
  // Pull the sand style's colour a long way toward damp earth. Keeping a
  // trace of the original hue means each sand still tints its own block,
  // but the result lands in the reference's dark-soil family rather than
  // the bright orange it used to be.
  const earth = new THREE.Color(strataHex).lerp(new THREE.Color("#3d2617"), 0.62);
  const band = [
    earth.clone(),
    earth.clone().multiplyScalar(0.80),
    earth.clone().multiplyScalar(0.63),
    earth.clone().multiplyScalar(0.49),
  ];

  const pos: number[] = [];
  const col: number[] = [];
  const tri = (
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
    c: THREE.Color,
  ) => {
    pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
  };

  const step = W / divisions;
  const ring: { x: number; z: number }[] = [];
  for (let i = 0; i < divisions; i++) ring.push({ x: -W / 2 + step * i, z: -W / 2 });
  for (let j = 0; j < divisions; j++) ring.push({ x: W / 2, z: -W / 2 + step * j });
  for (let i = divisions; i > 0; i--) ring.push({ x: -W / 2 + step * i, z: W / 2 });
  for (let j = divisions; j > 0; j--) ring.push({ x: -W / 2, z: -W / 2 + step * j });

  const rnd = prng(2411);
  const scratch = new THREE.Color();

  for (let bi = 0; bi < BANDS.length; bi++) {
    const c = band[bi];
    for (let k = 0; k < ring.length; k++) {
      const p = ring[k];
      const q = ring[(k + 1) % ring.length];
      const topP = bi === 0 ? floorAt(p.x, p.z) : BANDS[bi - 1];
      const topQ = bi === 0 ? floorAt(q.x, q.z) : BANDS[bi - 1];
      const bot = BANDS[bi];
      // mottle each quad slightly so the bands read as packed earth
      // instead of four flat ribbons of colour
      const m = 1 + (rnd() - 0.5) * 0.13;
      scratch.copy(c).multiplyScalar(m);
      tri(p.x, topP, p.z, q.x, topQ, q.z, q.x, bot, q.z, scratch);
      tri(p.x, topP, p.z, q.x, bot, q.z, p.x, bot, p.z, scratch);
    }
  }

  const base = band[BANDS.length - 1];
  for (let k = 0; k < ring.length; k++) {
    const p = ring[k];
    const q = ring[(k + 1) % ring.length];
    tri(p.x, sandBottom, p.z, q.x, sandBottom, q.z, 0, sandBottom, 0, base);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();    // non-indexed => flat
  return geo;
}

/**
 * Stones embedded in the cut earth faces, as in the reference: pale
 * rounded shapes sitting in the soil.
 *
 * These are real geometry rather than vertex colour on the wall. The wall
 * is only a few triangles tall per band, and colour interpolated across
 * quads that size gives soft, stair-stepped blobs — the same limitation
 * that made the tang's markings unusable. Actual meshes keep the edges.
 *
 * Each stone is a flattened octahedron centred exactly on the wall plane,
 * so its outer half stands proud and catches light while the inner half
 * is buried. It crosses the wall rather than lying on it, so there is no
 * coplanar z-fighting.
 */
export function buildEmbeddedStones(count = 34, seed = 91): THREE.BufferGeometry {
  const rnd = prng(seed);

  // face index -> outward normal and the in-plane lateral axis
  const FACES = [
    { n: [0, 0, -1], lat: "x" },
    { n: [1, 0, 0], lat: "z" },
    { n: [0, 0, 1], lat: "x" },
    { n: [-1, 0, 0], lat: "z" },
  ] as const;

  const DIRS: [number, number, number][] = [
    [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
  ];
  const TRIS: [number, number, number][] = [
    [0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4],
    [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5],
  ];

  const pos: number[] = [];
  const col: number[] = [];
  const half = W / 2;
  const tint = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const face = FACES[i % FACES.length];
    const nx = face.n[0], nz = face.n[2];

    // position along the face, inset so stones never straddle a corner
    const t = (rnd() * 2 - 1) * (half - 0.22);
    const x = face.lat === "x" ? t : nx * half;
    const z = face.lat === "z" ? t : nz * half;

    // sit between the base and the sand line, which varies along the rim
    const ceil = floorAt(x, z) - 0.16;
    const y = sandBottom + 0.12 + rnd() * (ceil - sandBottom - 0.24);

    const r = 0.11 + rnd() * 0.13;
    const thin = r * (0.30 + rnd() * 0.15);     // squashed into the face
    // Sediment settles flat, so bias to horizontal ovals with only a
    // little tilt rather than free rotation — that reads as layered
    // ground instead of gravel thrown at a wall.
    const squash = 0.48 + rnd() * 0.28;
    const roll = (rnd() - 0.5) * 0.7;

    // Kept far below mid-grey. Total irradiance here is well above 1
    // (ambient 1.0 + hemisphere + three directionals), so a stone that
    // looks correct as a swatch renders as a blown-out white fleck.
    tint.setHSL(0.083 - rnd() * 0.02, 0.19 + rnd() * 0.13, 0.19 + rnd() * 0.13);

    // vertices: octahedron squashed along the face normal, then jittered
    const verts = DIRS.map(([dx, dy, dz]) => {
      const j = 0.82 + rnd() * 0.36;
      // in-plane basis: lateral axis and world Y
      const a = (face.lat === "x" ? dx : dz) * r * j;
      const b = dy * r * squash * j;
      const out = (face.lat === "x" ? dz : dx) * thin * j;
      // roll the oval within the plane
      const ca = Math.cos(roll), sa = Math.sin(roll);
      const la = a * ca - b * sa;
      const lb = a * sa + b * ca;
      return face.lat === "x"
        ? [x + la, y + lb, z + out * nz]
        : [x + out * nx, y + lb, z + la];
    });

    for (const [ia, ib, ic] of TRIS) {
      for (const vi of [ia, ib, ic]) {
        pos.push(verts[vi][0], verts[vi][1], verts[vi][2]);
        col.push(tint.r, tint.g, tint.b);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();    // non-indexed => flat
  return geo;
}

/**
 * A grid hugging the seabed, used as an additive caustics overlay.
 */
export function buildFloorOverlay(divisions = 44): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(W, W, divisions, divisions);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, floorAt(pos.getX(i), pos.getZ(i)) + 0.014);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/**
 * A field of small stones strewn across the seabed, merged into one
 * non-indexed geometry — one draw call, flat-shaded, vertex-coloured.
 * Each pebble is a displaced octahedron: 8 faces is plenty at this size
 * and keeps the whole field cheap.
 */
export function buildPebbleField(count = 150, seed = 7): THREE.BufferGeometry {
  // small deterministic PRNG so the field is stable across reloads
  let state = seed;
  const rnd = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };

  const DIRS: [number, number, number][] = [
    [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
  ];
  const FACES: [number, number, number][] = [
    [0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4],
    [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5],
  ];

  const pos: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  const half = W / 2 - 0.25;

  for (let n = 0; n < count; n++) {
    const cx = (rnd() * 2 - 1) * half;
    const cz = (rnd() * 2 - 1) * half;
    const r = 0.018 + rnd() * 0.042;
    // sit them partly buried so they read as settled, not scattered on top
    const cy = floorAt(cx, cz) + sandGrain(cx, cz) + r * 0.35;

    // one lumpy shape per pebble
    const verts = DIRS.map(([dx, dy, dz]) => {
      const k = r * (0.72 + rnd() * 0.55);
      return [cx + dx * k, cy + dy * k * 0.68, cz + dz * k] as [number, number, number];
    });

    const tone = 0.42 + rnd() * 0.34;
    const warm = rnd() * 0.12;
    c.setRGB(tone + warm, tone + warm * 0.6, tone * 0.94);

    for (const [a, b, d] of FACES) {
      for (const vi of [a, b, d]) {
        pos.push(verts[vi][0], verts[vi][1], verts[vi][2]);
        col.push(c.r, c.g, c.b);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}
