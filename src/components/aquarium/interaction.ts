import * as THREE from "three";
import { TANK } from "@/lib/store";
import { floorAt } from "./terrain";

const { waterTop } = TANK;

/**
 * Ephemeral tank interaction state — food in the water and where the
 * cursor is hovering.
 *
 * Deliberately module-level mutable data rather than React state: every
 * fish reads this inside useFrame, and the cursor moves continuously.
 * Routing it through setState would re-render (and re-mount) every fish
 * in the tank on each pointer event. Nothing here is persisted; food does
 * not survive a reload.
 */

export type Pellet = {
  alive: boolean;
  pos: THREE.Vector3;
  vy: number;
  /** horizontal sway, so pellets drift rather than falling on rails */
  swayPhase: number;
  swayRate: number;
  born: number;
};

/**
 * Fixed pool. A pool means the renderer can mount a constant set of
 * meshes once and just toggle visibility — no React state churn as food
 * is dropped and eaten.
 */
export const POOL = 36;

export const pellets: Pellet[] = Array.from({ length: POOL }, () => ({
  alive: false,
  pos: new THREE.Vector3(),
  vy: 0,
  swayPhase: 0,
  swayRate: 0,
  born: 0,
}));

/** Cursor position projected onto a mid-water plane. */
export const lure = {
  active: false,
  pos: new THREE.Vector3(),
};

/** Height of the plane the cursor is projected onto. */
export const LURE_Y = 0.55;

let clock = 0;
let nextSlot = 0;

/** Claim a slot, preferring a dead one and otherwise recycling round-robin. */
function slot(): Pellet {
  for (let i = 0; i < POOL; i++) {
    if (!pellets[i].alive) return pellets[i];
  }
  const p = pellets[nextSlot];
  nextSlot = (nextSlot + 1) % POOL;
  return p;
}

/**
 * Drop a scatter of food just above (x, y, z). Pellets start at staggered
 * heights so a pinch trickles down rather than arriving as one flat layer.
 *
 * Food appears a little above where you clicked rather than at the water
 * line: the top surface is nearly opaque from the tank's viewing angle,
 * so pellets released at the surface stay hidden for the twenty-odd
 * seconds they take to sink into view.
 */
export function dropFood(x: number, y: number, z: number, count = 7): void {
  const top = Math.min(waterTop - 0.12, y + 0.34);
  for (let i = 0; i < count; i++) {
    const p = slot();
    p.alive = true;
    p.pos.set(
      x + (Math.random() - 0.5) * 0.42,
      top - Math.random() * 0.26,
      z + (Math.random() - 0.5) * 0.42,
    );
    p.vy = -0.13 - Math.random() * 0.07;
    p.swayPhase = Math.random() * Math.PI * 2;
    p.swayRate = 0.7 + Math.random() * 0.9;
    p.born = clock;
  }
}

/** Sink every live pellet; retire the ones that reach the sand or go stale. */
export function stepPellets(dt: number): void {
  clock += dt;
  for (let i = 0; i < POOL; i++) {
    const p = pellets[i];
    if (!p.alive) continue;
    p.pos.y += p.vy * dt;
    p.pos.x += Math.sin(clock * p.swayRate + p.swayPhase) * 0.06 * dt;
    p.pos.z += Math.cos(clock * p.swayRate * 0.8 + p.swayPhase) * 0.06 * dt;
    // settled into the sand, or uneaten for long enough to dissolve
    if (p.pos.y <= floorAt(p.pos.x, p.pos.z) + 0.03 || clock - p.born > 26) {
      p.alive = false;
    }
  }
}

/** Index of the closest live pellet within `radius`, or -1. */
export function nearestPellet(from: THREE.Vector3, radius: number): number {
  let best = -1;
  let bestD = radius * radius;
  for (let i = 0; i < POOL; i++) {
    const p = pellets[i];
    if (!p.alive) continue;
    const d = p.pos.distanceToSquared(from);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export function eatPellet(i: number): void {
  if (i >= 0 && i < POOL) pellets[i].alive = false;
}

export function anyFood(): boolean {
  for (let i = 0; i < POOL; i++) if (pellets[i].alive) return true;
  return false;
}

/** Clear the water — used when feed mode is switched off. */
export function clearFood(): void {
  for (let i = 0; i < POOL; i++) pellets[i].alive = false;
}
