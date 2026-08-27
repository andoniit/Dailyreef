"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { rand } from "./parts";
import type { CatalogItem, PlacedItem } from "@/lib/types";
import { MODELLED, ReefModel } from "./ReefModel";
import { floorAt } from "./terrain";
import { eatPellet, lure, pushOutOfIsland, nearestPellet, pellets } from "./interaction";

type P = { item: CatalogItem; placed: PlacedItem };

const DEEP = -0.55;
const HIGH = 1.6;

/** Elliptical wander path with a slow vertical bob. */
function makePath(seed: number, band: number, rx: number, rz: number) {
  const wob = 0.6 + rand(seed, 7) * 0.8;
  const spin = rand(seed, 11) * Math.PI * 2;        // each loop sits at its own angle
  const cs = Math.cos(spin);
  const sn = Math.sin(spin);
  // deliberately incommensurate rates: the path never visibly repeats
  const f1 = 0.83 + rand(seed, 13) * 0.45;
  const f2 = 0.31 + rand(seed, 17) * 0.28;
  const f3 = 1.7 + rand(seed, 19) * 0.9;
  const driftX = 0.22 + rand(seed, 23) * 0.20;
  const driftZ = 0.22 + rand(seed, 29) * 0.20;

  return (t: number, out: THREE.Vector3) => {
    let x = Math.sin(t) * rx + Math.sin(t * f3 + seed) * 0.16;
    let z = Math.cos(t * f1 + seed * 2) * rz + Math.cos(t * f2 * 1.7 + seed) * 0.20;
    x += Math.sin(t * f2 + seed * 5) * driftX;      // slow wander of the loop
    z += Math.cos(t * f2 * 0.7 + seed * 3) * driftZ;
    const y =
      band +
      Math.sin(t * wob + seed * 3) * 0.26 +
      Math.sin(t * f2 * 0.5 + seed) * 0.12;
    out.set(x * cs - z * sn, y, x * sn + z * cs);   // rotate the whole loop
  };
}

/** How far a fish will notice food, and how close counts as eating it. */
const FOOD_NOTICE = 1.8;
const BITE = 0.16;
/** Cursor curiosity is weaker and shorter-ranged than hunger. */
const LURE_NOTICE = 1.7;
const LURE_PULL = 0.4;
/**
 * Once committed to a pellet a fish keeps chasing it a little past the
 * notice radius. Without this margin a fish sitting near the edge flips
 * between "chasing" and "not" from frame to frame.
 */
const FOOD_KEEP = 0.7;
/** Below this the per-frame velocity is numerical noise, not a heading. */
const MIN_SPEED = 0.06;

function Swimmer({
  seed,
  band,
  speed,
  upright = false,
  appetite = 1,
  girth = 0.16,
  ailing = false,
  children,
}: {
  seed: number;
  band: number;
  speed: number;
  upright?: boolean;
  /** 0 = ignores food and the cursor entirely (drifters like jellyfish) */
  appetite?: number;
  /** half-width of the body, used to keep it clear of solid ground */
  girth?: number;
  /** sick fish sink to the sand and stay there until they recover */
  ailing?: boolean;
  children: React.ReactNode;
}) {
  const g = useRef<THREE.Group>(null!);
  const home = useMemo(() => new THREE.Vector3(), []);   // point on the path
  const goal = useMemo(() => new THREE.Vector3(), []);   // path blended w/ target
  const cur = useMemo(() => new THREE.Vector3(), []);    // where the fish is
  const prev = useMemo(() => new THREE.Vector3(), []);
  const vel = useMemo(() => new THREE.Vector3(), []);
  const step = useMemo(() => new THREE.Vector3(), []);
  const aim = useMemo(() => new THREE.Vector3(), []);
  const lureAt = useMemo(() => new THREE.Vector3(), []);
  /** smoothed facing direction, kept separate from the raw velocity */
  const dir = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  const basis = useMemo(() => new THREE.Matrix4(), []);
  const qWant = useMemo(() => new THREE.Quaternion(), []);
  /** un-banked orientation; banking is applied on top each frame so that
      it cannot accumulate through the slerp */
  const qLevel = useMemo(() => new THREE.Quaternion(), []);
  const UP = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const started = useRef(false);
  /** pellet this fish has committed to, so it doesn't dither between two */
  const chasing = useRef(-1);
  // headroom over the fish's own cruising speed, so a chase is a dash
  const maxSpeed = 1.5 + appetite * 0.6;
  /** smoothed attraction weight, so fish ease off the path and back on */
  const pull = useRef(0);
  const rx = 0.95 + rand(seed, 1) * 0.70;
  const rz = 0.85 + rand(seed, 2) * 0.70;
  const path = useMemo(() => makePath(seed, band, rx, rz), [seed, band, rx, rz]);

  // fixed personal offset so a shoal gathers *around* the cursor rather
  // than every fish stacking on the same point
  const offset = useMemo(
    () =>
      new THREE.Vector3(
        (rand(seed, 31) - 0.5) * 0.7,
        (rand(seed, 37) - 0.5) * 0.45,
        (rand(seed, 41) - 0.5) * 0.7,
      ),
    [seed],
  );

  useFrame(({ clock }, dt) => {
    if (!g.current) return;
    // A stalled tab or a dropped frame hands back a huge delta; without a
    // clamp every smoothing term below jumps in one step.
    const d = Math.min(dt, 1 / 30);
    const t = clock.elapsedTime * speed + seed * 12;
    path(t, home);

    // ── sick: settle onto the sand and stay put ──────────────────
    if (ailing) {
      if (!started.current) cur.copy(home);
      // Hold the x/z it was already at and just sink, rather than
      // steering to a fixed spot — a sick fish drifting sideways across
      // the tank to reach some anchor point reads as swimming, which is
      // the opposite of the intent.
      const bed = floorAt(cur.x, cur.z) + 0.13;
      const fall = Math.min(0.28 * d, Math.abs(cur.y - bed));
      cur.y += cur.y > bed ? -fall : fall;
      // barely-there drift so it does not look frozen in place
      cur.x += Math.sin(t * 0.5 + seed) * 0.0008;
      cur.z += Math.cos(t * 0.42 + seed * 2) * 0.0008;
      g.current.position.copy(cur);

      if (!upright) {
        // list onto one side, easing over rather than snapping
        qWant.setFromEuler(new THREE.Euler(0, seed * 6.28, 0.55 + Math.sin(t) * 0.05));
        if (!started.current) qLevel.copy(qWant);
        qLevel.slerp(qWant, Math.min(1, d * 1.5));
        g.current.quaternion.copy(qLevel);
        prev.copy(cur);
      }
      pull.current = 0;
      chasing.current = -1;
      started.current = true;
      return;
    }

    // ── pick something to chase ──────────────────────────────────
    let target: THREE.Vector3 | null = null;
    let want = 0;
    if (appetite > 0) {
      const from = started.current ? cur : home;
      const notice = FOOD_NOTICE * appetite;

      // Stay with the pellet already committed to while it lives and is
      // still roughly in range; only look for a new one otherwise.
      // Re-picking the nearest every frame makes a fish snap back and
      // forth between two near-equidistant pellets.
      let i = chasing.current;
      if (i < 0 || !pellets[i].alive || from.distanceTo(pellets[i].pos) > notice + FOOD_KEEP) {
        i = nearestPellet(from, notice);
        chasing.current = i;
      }

      if (i >= 0) {
        const dist = from.distanceTo(pellets[i].pos);
        if (dist < BITE) {
          eatPellet(i);
          chasing.current = -1;
        } else {
          target = pellets[i].pos;
          // Fade interest in rather than switching it on at a hard edge —
          // a binary test makes fish near the boundary stutter as the
          // weight flips between frames.
          want = 1 - THREE.MathUtils.smoothstep(dist, notice, notice + FOOD_KEEP);
        }
      } else if (lure.active) {
        const dist = from.distanceTo(lure.pos);
        if (dist < LURE_NOTICE) {
          lureAt.copy(lure.pos).add(offset);
          target = lureAt;
          want =
            LURE_PULL *
            (1 - THREE.MathUtils.smoothstep(dist, LURE_NOTICE * 0.45, LURE_NOTICE));
        }
      }
    }

    // Ease the goal off the path and back, rather than switching hard.
    pull.current += (want - pull.current) * Math.min(1, d * 1.6);
    goal.copy(home);
    // Steer the destination clear of the island first, so the fish curves
    // around it instead of driving into the shore and sliding along it.
    pushOutOfIsland(goal, girth);
    if (target && pull.current > 0.001) goal.lerp(target, pull.current);

    // Chase at a bounded speed. Interpolating position straight to the
    // goal instead makes the fish arrive the moment the weight rises,
    // which reads as a teleport and empties the water almost instantly.
    if (!started.current) {
      cur.copy(goal);
    } else {
      step.subVectors(goal, cur);
      const max = maxSpeed * d;
      if (step.lengthSq() > max * max) step.setLength(max);
      cur.add(step);
    }
    // Backstop: the goal being clear does not guarantee the path to it is,
    // and a lure or pellet can sit inside the island.
    pushOutOfIsland(cur, girth);
    g.current.position.copy(cur);

    if (!upright) {
      if (!started.current) prev.copy(cur);
      vel.subVectors(cur, prev).divideScalar(Math.max(d, 1e-4));

      // Heading comes from where the fish actually went, not from the
      // path derivative — while chasing food the two diverge, and using
      // the path would leave the fish swimming sideways.
      //
      // Below MIN_SPEED the frame-to-frame delta is float noise, so the
      // last good direction is held instead. Steering straight from the
      // raw velocity is what made a fish twitch and spin once it slowed
      // down near the cursor.
      const sp = vel.length();
      if (sp > MIN_SPEED) {
        vel.divideScalar(sp);
        dir.lerp(vel, Math.min(1, d * 5)).normalize();
      }

      aim.copy(cur).add(dir);
      // matches Object3D.lookAt's argument order for non-camera objects
      basis.lookAt(aim, cur, UP);
      qWant.setFromRotationMatrix(basis);
      if (!started.current) qLevel.copy(qWant);
      qLevel.slerp(qWant, Math.min(1, d * 6));

      g.current.quaternion.copy(qLevel);
      // Banking is applied to a copy of the level orientation each frame.
      // Slerping an already-banked quaternion toward an unbanked target
      // and re-banking would compound the roll every frame.
      g.current.rotateZ(Math.sin(t * 0.7) * 0.16);

      prev.copy(cur);
    }
    started.current = true;
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

/**
 * Well-fed fish are visibly bigger; ailing ones shrink back a little and
 * lose their colour, so trouble is legible in the tank itself rather than
 * only in a notice you might miss.
 */
function Vitals({ placed, children }: { placed: PlacedItem; children: React.ReactNode }) {
  const grown = 1 + (placed.growth ?? 0) * 0.75;
  const scale = placed.ailing ? grown * 0.88 : grown;
  const ref = useRef<THREE.Group>(null!);

  useEffect(() => {
    if (!ref.current || !placed.ailing) return;
    // desaturate toward a sickly pale, and remember nothing — the clone
    // is rebuilt whenever the model changes, so this cannot leak
    ref.current.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && m.color) m.color.lerp(new THREE.Color("#cfd6d2"), 0.55);
    });
  }, [placed.ailing]);

  return (
    <group ref={ref} scale={scale}>
      {children}
    </group>
  );
}

/** Body half-width per species, for clearing solid ground. */
const GIRTH: Record<string, number> = {
  ray: 0.34, jelly: 0.2, tall: 0.2, medium: 0.18, seahorse: 0.12, small: 0.12,
};

export function Fish({ item, placed }: P) {
  const seed = placed.seed;
  const v = item.variant;

  // modelled species keep the procedural swim path, only the body changes.
  // jelly and seahorse hold themselves upright instead of steering.
  if (MODELLED.has(item.id)) {
    const motion =
      v === "jelly"
        ? { band: 0.9 + rand(seed, 5) * 0.7, speed: 0.13, upright: true, appetite: 0 }
        : v === "seahorse"
          ? { band: -0.2 + rand(seed, 5) * 0.5, speed: 0.09, upright: true, appetite: 0.45 }
          : v === "ray"
            ? { band: DEEP + rand(seed, 5) * 0.5, speed: 0.16, upright: false, appetite: 0.7 }
            : {
                band: DEEP + rand(seed, 5) * (HIGH - DEEP),
                speed: v === "small" ? 0.42 : 0.3,
                upright: false,
                appetite: 1,
              };
    return (
      <Swimmer
        seed={seed}
        band={motion.band}
        speed={motion.speed}
        upright={motion.upright}
        appetite={motion.appetite}
        girth={GIRTH[v] ?? 0.16}
        ailing={!!placed.ailing}
      >
        <Vitals placed={placed}>
          <ReefModel id={item.id} swim seed={seed} />
        </Vitals>
      </Swimmer>
    );
  }

  if (v === "jelly") {
    return (
      <Swimmer seed={seed} band={0.9 + rand(seed, 5) * 0.7} speed={0.13} upright appetite={0} ailing={!!placed.ailing}>
        <Vitals placed={placed}>
          <Jelly item={item} placed={placed} />
        </Vitals>
      </Swimmer>
    );
  }
  if (v === "seahorse") {
    return (
      <Swimmer seed={seed} band={-0.2 + rand(seed, 5) * 0.5} speed={0.09} upright appetite={0.45} ailing={!!placed.ailing}>
        <Vitals placed={placed}>
          <Seahorse item={item} placed={placed} />
        </Vitals>
      </Swimmer>
    );
  }
  if (v === "ray") {
    return (
      <Swimmer seed={seed} band={DEEP + rand(seed, 5) * 0.5} speed={0.16} appetite={0.7} ailing={!!placed.ailing}>
        <Vitals placed={placed}>
          <Ray item={item} placed={placed} />
        </Vitals>
      </Swimmer>
    );
  }

  const band = DEEP + rand(seed, 5) * (HIGH - DEEP);
  const scale = v === "small" ? 0.78 : v === "tall" ? 1.0 : 1.12;
  const speed = v === "small" ? 0.42 : 0.3;

  return (
    <Swimmer seed={seed} band={band} speed={speed} ailing={!!placed.ailing}>
      <Vitals placed={placed}>
        <BodyFish item={item} scale={scale} tall={v === "tall"} />
      </Vitals>
    </Swimmer>
  );
}
