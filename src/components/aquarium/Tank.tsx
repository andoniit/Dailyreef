"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { BY_ID } from "@/lib/catalog";
import { TANK, useReef } from "@/lib/store";
import type { PlacedItem } from "@/lib/types";
import { Scenery } from "./scenery";
import { buildBlock, floorAt } from "./terrain";
import { Fish } from "./fish";

const W = 6;
const { floorY, sandBottom, waterTop, half } = TANK;
const WATER_FLOOR = -1.62;            // below the deepest point of the seabed
const WATER_H = waterTop - WATER_FLOOR;

/* ── Diorama block ──────────────────────────────────────────────── */

/**
 * Sloped seabed, banded strata walls and base as a single flat-shaded
 * mesh. Rebuilt only when the equipped sand style changes.
 */
function Block({ top, deep }: { top: string; deep: string }) {
  const geo = useMemo(() => buildBlock(top, deep), [top, deep]);
  useEffect(() => () => geo.dispose(), [geo]);

  return (
    <mesh geometry={geo}>
      <meshStandardMaterial vertexColors roughness={0.95} metalness={0} />
    </mesh>
  );
}

/* ── Water ──────────────────────────────────────────────────────── */

function WaterVolume() {
  const geo = useMemo(() => {
    // inset so the sunken lower half hides behind the block's opaque
    // walls instead of tinting the strata
    const g = new THREE.BoxGeometry(W - 0.05, WATER_H, W - 0.05);
    // strip the +Y and -Y faces: the surface plane is the lid and the
    // sand is the floor, so those quads would only fight for depth
    const idx = Array.from(g.getIndex()!.array);
    g.setIndex([...idx.slice(0, 12), ...idx.slice(24)]);
    const pos = g.attributes.position;
    const shallow = new THREE.Color("#4fb0f2");
    const deep = new THREE.Color("#1354ba");
    const c = new THREE.Color();
    const arr = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const k = (pos.getY(i) + WATER_H / 2) / WATER_H;
      c.copy(deep).lerp(shallow, Math.pow(k, 1.25));
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);

  return (
    <mesh geometry={geo} position={[0, WATER_FLOOR + WATER_H / 2, 0]} renderOrder={20}>
      <meshStandardMaterial
        vertexColors
        transparent
        opacity={0.44}
        depthWrite={false}
        side={THREE.DoubleSide}
        roughness={0.15}
        metalness={0.1}
      />
    </mesh>
  );
}

function Surface() {
  const ref = useRef<THREE.Mesh>(null!);
  const base = useRef<Float32Array | null>(null);
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(W, W, 28, 28);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);

  useFrame(({ clock }) => {
    const pos = geo.attributes.position;
    if (!base.current) base.current = Float32Array.from(pos.array as Float32Array);
    const t = clock.elapsedTime * 0.7;
    for (let i = 0; i < pos.count; i++) {
      const x = base.current[i * 3];
      const z = base.current[i * 3 + 2];
      pos.setY(
        i,
        Math.sin(x * 1.5 + t) * 0.055 +
          Math.cos(z * 1.2 - t * 0.8) * 0.05 +
          Math.sin((x + z) * 2.1 + t * 1.4) * 0.03
      );
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  });

  return (
    <mesh ref={ref} geometry={geo} position={[0, waterTop, 0]} renderOrder={22}>
      <meshStandardMaterial
        color="#22a8b4"
        emissive="#0a5f70"
        emissiveIntensity={0.35}
        transparent
        opacity={0.94}
        roughness={0.42}
        metalness={0.1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function LightShafts() {
  const shafts = useMemo(
    () => [
      { x: -1.6, z: -1.0, w: 1.1, r: 0.2 },
      { x: 0.6, z: 1.0, w: 1.5, r: -0.14 },
    ],
    []
  );
  return (
    <group renderOrder={21}>
      {shafts.map((s, i) => (
        <mesh key={i} position={[s.x, WATER_FLOOR + WATER_H * 0.45, s.z]} rotation={[0, -0.6, s.r]}>
          <planeGeometry args={[s.w, WATER_H * 0.88]} />
          <meshBasicMaterial
            color="#bfe9ff"
            transparent
            opacity={0.035}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ── Placeable item ─────────────────────────────────────────────── */

function FloorItem({
  placed,
  selected,
  onSelect,
  onDragStart,
}: {
  placed: PlacedItem;
  selected: boolean;
  onSelect: (uid: string) => void;
  onDragStart: (uid: string) => void;
}) {
  const item = BY_ID[placed.itemId];
  if (!item) return null;
  return (
    <group
      position={[placed.x, floorAt(placed.x, placed.z) + 0.01, placed.z]}
      rotation={[0, placed.rot, 0]}
      scale={placed.scale}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
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
}: {
  placed: PlacedItem;
  onSelect: (uid: string) => void;
}) {
  const item = BY_ID[placed.itemId];
  if (!item) return null;
  return (
    <group
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
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
}: {
  selected: string | null;
  onSelect: (uid: string | null) => void;
}) {
  const items = useReef((s) => s.items);
  const sandId = useReef((s) => s.sand);
  const moveItem = useReef((s) => s.moveItem);
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
      <directionalLight position={[6, 9, 5]} intensity={1.45} />
      <directionalLight position={[-6, 4, -5]} intensity={0.4} color="#8ec9ff" />

      <Block top={sand.colors[0]} deep={sand.colors[1]} />

      {floorItems.map((p) => (
        <FloorItem
          key={p.uid}
          placed={p}
          selected={selected === p.uid}
          onSelect={onSelect}
          onDragStart={setDragging}
        />
      ))}
      {swimmers.map((p) => (
        <SwimmingItem key={p.uid} placed={p} onSelect={onSelect} />
      ))}

      <LightShafts />
      <WaterVolume />
      <Surface />

      {/* invisible catcher: drag target + click-away */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, floorY, 0]}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          if (!dragging) return;
          e.stopPropagation();
          const x = THREE.MathUtils.clamp(e.point.x, -half, half);
          const z = THREE.MathUtils.clamp(e.point.z, -half, half);
          moveItem(dragging, x, z);
        }}
        onPointerDown={() => onSelect(null)}
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
}: {
  selected: string | null;
  onSelect: (uid: string | null) => void;
}) {
  return (
    <Canvas
      flat
      dpr={[1, 2]}
      orthographic
      camera={{ position: [9, 7, 9], zoom: 70, near: -50, far: 100 }}
      style={{ touchAction: "none" }}
    >
      <Scene selected={selected} onSelect={onSelect} />
    </Canvas>
  );
}
