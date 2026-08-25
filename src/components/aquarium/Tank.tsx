"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { BY_ID } from "@/lib/catalog";
import { TANK, useReef } from "@/lib/store";
import type { PlacedItem } from "@/lib/types";
import { Scenery } from "./scenery";
import {
  buildEmbeddedStones,
  buildPebbleField,
  buildSeabed,
  buildWalls,
  floorAt,
} from "./terrain";
import { Caustics } from "./Caustics";
import {
  LURE_Y,
  POOL,
  clearFood,
  dropFood,
  lure,
  pellets,
  stepPellets,
} from "./interaction";
import { WaterSurface } from "./WaterSurface";
import { Fish } from "./fish";

const W = 6;
const { floorY, half } = TANK;

/** Where a pointer ray crosses a horizontal plane, or null if it never does. */
const _hit = new THREE.Vector3();
function rayToPlane(ray: THREE.Ray, y: number): THREE.Vector3 | null {
  if (Math.abs(ray.direction.y) < 1e-6) return null;
  const t = (y - ray.origin.y) / ray.direction.y;
  if (t < 0) return null;
  return _hit.copy(ray.direction).multiplyScalar(t).add(ray.origin);
}

/* ── Diorama block ──────────────────────────────────────────────── */

/**
 * Seabed and walls are separate meshes on purpose: the seabed is
 * indexed and smooth-shaded (that soft shading is most of what made the
 * Cycles study read as real), while the walls stay flat-shaded so the
 * strata bands keep hard edges.
 */
function Block({ top, deep }: { top: string; deep: string }) {
  const seabed = useMemo(() => buildSeabed(top), [top]);
  const walls = useMemo(() => buildWalls(deep), [deep]);
  // neither stone field changes with the sand style, so both are built once
  const pebbles = useMemo(() => buildPebbleField(), []);
  const embedded = useMemo(() => buildEmbeddedStones(), []);

  useEffect(() => {
    return () => {
      seabed.dispose();
      walls.dispose();
    };
  }, [seabed, walls]);

  return (
    <group>
      <mesh geometry={seabed}>
        <meshStandardMaterial vertexColors roughness={0.92} metalness={0} />
      </mesh>
      <mesh geometry={walls}>
        <meshStandardMaterial vertexColors roughness={0.95} metalness={0} />
      </mesh>
      <mesh geometry={pebbles}>
        <meshStandardMaterial vertexColors roughness={0.78} metalness={0} />
      </mesh>
      <mesh geometry={embedded}>
        <meshStandardMaterial vertexColors roughness={0.85} metalness={0} />
      </mesh>
    </group>
  );
}

/* ── Food ───────────────────────────────────────────────────────── */

/**
 * A constant pool of pellet meshes whose visibility is toggled, rather
 * than mounting and unmounting meshes as food is dropped and eaten.
 * Positions are written straight to the refs each frame, so dropping food
 * never triggers a React render.
 */
function FoodCloud() {
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const geo = useMemo(() => new THREE.SphereGeometry(0.055, 7, 6), []);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#f0a742",
        // self-lit, because the water tint and the near-opaque surface
        // both wash pellets out badly at this size
        emissive: "#7a4410",
        roughness: 0.8,
      }),
    [],
  );
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);

  useFrame((_, dt) => {
    stepPellets(dt);
    for (let i = 0; i < POOL; i++) {
      const m = meshes.current[i];
      if (!m) continue;
      const p = pellets[i];
      m.visible = p.alive;
      if (p.alive) m.position.copy(p.pos);
    }
  });

  return (
    <>
      {Array.from({ length: POOL }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshes.current[i] = el;
          }}
          geometry={geo}
          material={mat}
          visible={false}
        />
      ))}
    </>
  );
}

/* ── Water ──────────────────────────────────────────────────────── */

/* ── Placeable item ─────────────────────────────────────────────── */

function FloorItem({
  placed,
  selected,
  onSelect,
  onDragStart,
  feeding,
}: {
  placed: PlacedItem;
  selected: boolean;
  onSelect: (uid: string) => void;
  onDragStart: (uid: string) => void;
  feeding: boolean;
}) {
  const item = BY_ID[placed.itemId];
  if (!item) return null;
  return (
    <group
      position={[placed.x, floorAt(placed.x, placed.z) + 0.01, placed.z]}
      rotation={[0, placed.rot, 0]}
      scale={placed.scale}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        // While feeding, let the event fall through to the catcher plane
        // below. Swallowing it here means any click landing over a coral
        // or a fish silently drops no food.
        if (feeding) return;
        e.stopPropagation();
        onSelect(placed.uid);
        onDragStart(placed.uid);
      }}
    >
      <Scenery item={item} placed={placed} />
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.44, 0.52, 28]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.9}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-10}
            polygonOffsetUnits={-10}
          />
        </mesh>
      )}
    </group>
  );
}

function SwimmingItem({
  placed,
  onSelect,
  feeding,
}: {
  placed: PlacedItem;
  onSelect: (uid: string) => void;
  feeding: boolean;
}) {
  const item = BY_ID[placed.itemId];
  if (!item) return null;
  return (
    <group
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        if (feeding) return;
        e.stopPropagation();
        onSelect(placed.uid);
      }}
    >
      <Fish item={item} placed={placed} />
    </group>
  );
}

/* ── Scene ──────────────────────────────────────────────────────── */

function Rig() {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera;
    cam.zoom = Math.max(24, Math.min(size.width / 8.9, size.height / 9.2));
    cam.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

function Scene({
  selected,
  onSelect,
  feeding,
}: {
  selected: string | null;
  onSelect: (uid: string | null) => void;
  feeding: boolean;
}) {
  const items = useReef((s) => s.items);
  const sandId = useReef((s) => s.sand);
  const moveItem = useReef((s) => s.moveItem);
  const locked = useReef((s) => s.locked);
  const [dragging, setDragging] = useState<string | null>(null);
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null);

  const sand = BY_ID[sandId] ?? BY_ID["sand-shore"];

  useEffect(() => {
    const up = () => setDragging(null);
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  useEffect(() => {
    if (controls.current) controls.current.enabled = !dragging;
  }, [dragging]);

  // The cursor only lures fish while the pointer is actually over the
  // canvas; without the leave handler the last position keeps attracting
  // them after the pointer is long gone.
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    const leave = () => {
      lure.active = false;
    };
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointerleave", leave);
      lure.active = false;
    };
  }, [gl]);

  // leaving feed mode clears whatever is still in the water
  useEffect(() => {
    if (!feeding) clearFood();
  }, [feeding]);

  const swimmers = items.filter((i) => BY_ID[i.itemId]?.category === "fish");
  const floorItems = items.filter((i) => BY_ID[i.itemId]?.category !== "fish");

  return (
    <>
      <Rig />
      <OrbitControls
        ref={controls}
        makeDefault
        enablePan={false}
        enableZoom={false}
        minPolarAngle={Math.PI * 0.26}
        maxPolarAngle={Math.PI * 0.46}
        rotateSpeed={0.6}
      />

      <ambientLight intensity={1.0} />
      <hemisphereLight args={["#cfeaff", "#f6d9b0", 0.6]} />
      <directionalLight position={[6, 9, 5]} intensity={1.25} />
      {/* straight overhead: gives every fish a highlight along its
          back, so light reads as falling from the surface */}
      <directionalLight position={[0.4, 12, 0.6]} intensity={1.7} color="#ffffff" />
      <directionalLight position={[-6, 4, -5]} intensity={0.4} color="#8ec9ff" />

      <Block top={sand.colors[0]} deep={sand.colors[1]} />

      {floorItems.map((p) => (
        <FloorItem
          key={p.uid}
          placed={p}
          selected={selected === p.uid}
          onSelect={onSelect}
          feeding={feeding}
          onDragStart={(uid) => {
            // don't enter drag state while locked, or OrbitControls would
            // be suppressed for a drag that cannot move anything and the
            // tank would feel stuck instead of locked
            if (!locked && !feeding) setDragging(uid);
          }}
        />
      ))}
      {swimmers.map((p) => (
        <SwimmingItem key={p.uid} placed={p} onSelect={onSelect} feeding={feeding} />
      ))}

      <Caustics />
      <FoodCloud />
      <WaterSurface />

      {/* invisible catcher: drag target + click-away */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, floorY, 0]}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          // Project the cursor onto a mid-water plane rather than using
          // the hit point on this floor-level catcher. Under the angled
          // ortho camera the two are far apart, and lured fish would
          // gather well below where the cursor appears to be.
          const hit = rayToPlane(e.ray, LURE_Y);
          if (hit) {
            lure.pos.copy(hit);
            // Generous bound on purpose: each fish already fades its own
            // interest with distance, so this only needs to switch off
            // well clear of the tank. A tight bound flips the flag as the
            // cursor crosses the rim and every nearby fish jerks.
            lure.active =
              Math.abs(hit.x) < half + 1.4 && Math.abs(hit.z) < half + 1.4;
          } else {
            lure.active = false;
          }

          if (!dragging) return;
          e.stopPropagation();
          const x = THREE.MathUtils.clamp(e.point.x, -half, half);
          const z = THREE.MathUtils.clamp(e.point.z, -half, half);
          moveItem(dragging, x, z);
        }}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          if (feeding) {
            const hit = rayToPlane(e.ray, LURE_Y);
            if (!hit) return;
            dropFood(
              THREE.MathUtils.clamp(hit.x, -half - 0.4, half + 0.4),
              hit.y,
              THREE.MathUtils.clamp(hit.z, -half - 0.4, half + 0.4),
            );
            return;
          }
          onSelect(null);
        }}
      >
        <planeGeometry args={[40, 40]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </>
  );
}

export default function Tank({
  selected,
  onSelect,
  feeding,
}: {
  selected: string | null;
  onSelect: (uid: string | null) => void;
  feeding: boolean;
}) {
  return (
    <Canvas
      flat
      dpr={[1, 2]}
      orthographic
      camera={{ position: [9, 7, 9], zoom: 70, near: -50, far: 100 }}
      style={{ touchAction: "none" }}
    >
      <Scene selected={selected} onSelect={onSelect} feeding={feeding} />
    </Canvas>
  );
}
