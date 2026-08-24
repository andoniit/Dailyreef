import * as THREE from "three";
import { TANK } from "@/lib/store";

export const W = 6;
const { floorY, sandBottom } = TANK;

/** Strata boundaries down the cut face, top band first. */
const BANDS = [-1.78, -2.18, sandBottom];

/**
 * Seabed relief relative to floorY: a diagonal slope plus dunes.
 * Kept fully submerged — a dry shelf would strand items and fish.
 * This is the single source of truth; the block mesh and item
 * placement both read it, so they can never drift apart.
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

/** World-space height of the sand at a point. */
export function floorAt(x: number, z: number): number {
  return floorY + terrainHeight(x, z);
}

const RELIEF_MIN = -0.52;
const RELIEF_MAX = 0.52;

/**
 * The whole diorama block as one flat-shaded, vertex-coloured mesh:
 * sloped seabed on top, banded strata down the cut walls, capped base.
 * Colours are computed from the equipped sand style, so the shop's
 * sand options keep working — nothing is baked in.
 */
export function buildBlock(sandHex: string, strataHex: string): THREE.BufferGeometry {
  const N = 46;
  const pos: number[] = [];
  const col: number[] = [];

  const shallow = new THREE.Color(sandHex);
  const deep = shallow.clone().lerp(new THREE.Color("#146b7a"), 0.42);
  const band = [
    new THREE.Color(strataHex),
    new THREE.Color(strataHex).multiplyScalar(0.74),
    new THREE.Color(strataHex).multiplyScalar(0.52),
  ];
  const scratch = new THREE.Color();

  /** Sand tint by relative depth — deepest reads teal, shallow stays sandy. */
  const sandColor = (relief: number) => {
    const t = THREE.MathUtils.clamp(
      (RELIEF_MAX - relief) / (RELIEF_MAX - RELIEF_MIN),
      0,
      1,
    );
    return scratch.copy(shallow).lerp(deep, Math.pow(t, 0.8));
  };

  const tri = (
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    cx: number, cy: number, cz: number,
    ca: THREE.Color, cb: THREE.Color, cc: THREE.Color,
  ) => {
    pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
  };

  // ── seabed ─────────────────────────────────────────────────────
  const step = W / N;
  const h = (i: number, j: number) => {
    const x = -W / 2 + step * i;
    const z = -W / 2 + step * j;
    return { x, z, y: floorAt(x, z), r: terrainHeight(x, z) };
  };

  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const a = h(i, j), b = h(i + 1, j), c = h(i + 1, j + 1), d = h(i, j + 1);
      const ca = sandColor(a.r).clone();
      const cb = sandColor(b.r).clone();
      const cc = sandColor(c.r).clone();
      const cd = sandColor(d.r).clone();
      tri(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z, ca, cc, cb);
      tri(a.x, a.y, a.z, d.x, d.y, d.z, c.x, c.y, c.z, ca, cd, cc);
    }
  }

  // ── walls: each band owns its verts so the boundaries stay crisp ─
  const ring: { x: number; z: number }[] = [];
  for (let i = 0; i < N; i++) ring.push({ x: -W / 2 + step * i, z: -W / 2 });
  for (let j = 0; j < N; j++) ring.push({ x: W / 2, z: -W / 2 + step * j });
  for (let i = N; i > 0; i--) ring.push({ x: -W / 2 + step * i, z: W / 2 });
  for (let j = N; j > 0; j--) ring.push({ x: -W / 2, z: -W / 2 + step * j });

  for (let bi = 0; bi < BANDS.length; bi++) {
    const c = band[bi];
    for (let k = 0; k < ring.length; k++) {
      const p = ring[k];
      const q = ring[(k + 1) % ring.length];
      const topP = bi === 0 ? floorAt(p.x, p.z) : BANDS[bi - 1];
      const topQ = bi === 0 ? floorAt(q.x, q.z) : BANDS[bi - 1];
      const bot = BANDS[bi];
      tri(p.x, topP, p.z, q.x, topQ, q.z, q.x, bot, q.z, c, c, c);
      tri(p.x, topP, p.z, q.x, bot, q.z, p.x, bot, p.z, c, c, c);
    }
  }

  // ── base cap ───────────────────────────────────────────────────
  const cb3 = band[2];
  for (let k = 0; k < ring.length; k++) {
    const p = ring[k];
    const q = ring[(k + 1) % ring.length];
    tri(p.x, sandBottom, p.z, q.x, sandBottom, q.z, 0, sandBottom, 0, cb3, cb3, cb3);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();   // non-indexed, so this gives flat facets
  return geo;
}
