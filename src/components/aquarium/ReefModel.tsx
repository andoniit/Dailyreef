"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

export const MODEL_URL = "/models/reef.glb";

/**
 * Catalog ids that have a Blender-authored mesh inside reef.glb.
 * Anything not listed keeps its procedural fallback.
 */
export const MODELLED = new Set([
  // coral
  "brain", "staghorn", "pink-tube", "bubble",
  // plants
  "kelp", "seagrass", "teal-weed", "violet-fan", "anemone",
  // rocks
  "pebbles", "boulder", "slate", "arch",
  // decor
  "chest", "amphora", "wreck",
  // fish
  "guppy", "clownfish", "neon", "tang", "angel", "koi", "angler",
  "seahorse", "jelly", "ray",
]);

/** Stone stays honest — no saturation boost, no glow. */
const ROCKY = new Set(["pebbles", "boulder", "slate", "arch"]);

/**
 * Items that light themselves, and how hard. Each one glows in its own
 * colour rather than a shared tint, which is why the emissive is copied
 * from the material's own base colour below.
 */
export const GLOW: Record<string, number> = {
  bubble: 0.34,
  "pink-tube": 0.30,
  anemone: 0.26,
  "violet-fan": 0.14,
  "teal-weed": 0.11,
};

/** Catalog ids that are fish — these get the wet, glossy treatment. */
const FISHY = new Set([
  "guppy", "clownfish", "neon", "tang", "angel", "koi", "angler",
  "seahorse", "jelly", "ray",
]);

/**
 * Give the library its surface character, once.
 *
 * Materials inside the glb are shared between every instance of an item,
 * so this mutates them in place rather than cloning — cloning per instance
 * would multiply materials by the number of things in the tank for no
 * visual gain.
 *
 * Fish get low roughness, a touch of metalness and a strong environment
 * response, which together read as wet. Everything else stays matte and
 * takes only a hint of reflection, so rock and coral do not turn into
 * plastic alongside them.
 */
let tuned = false;
const hsl = { h: 0, s: 0, l: 0 };
function tuneLibrary(root: THREE.Object3D) {
  if (tuned) return;
  tuned = true;

  for (const node of root.children) {
    const fish = FISHY.has(node.name);
    node.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const mat = m as THREE.MeshStandardMaterial;
        if (!("roughness" in mat)) continue;
        if (fish) {
          mat.roughness = Math.min(mat.roughness ?? 1, 0.22);
          mat.metalness = Math.max(mat.metalness ?? 0, 0.20);
          mat.envMapIntensity = 1.35;
        } else {
          mat.envMapIntensity = 0.35;

          if (!ROCKY.has(node.name) && mat.color) {
            // Lift saturation rather than replacing the colour. Several
            // items carry more than one material — the chest's wood and
            // its gold, for instance — and assigning a flat colour per
            // item would collapse those into one.
            mat.color.getHSL(hsl);
            mat.color.setHSL(
              hsl.h,
              Math.min(1, hsl.s * 1.5 + 0.07),
              Math.min(0.68, hsl.l * 1.1),
            );
          }

          const glow = GLOW[node.name];
          if (glow !== undefined && mat.emissive) {
            mat.emissive.copy(mat.color);
            mat.emissiveIntensity = glow;
          }
        }
        mat.needsUpdate = true;
      }
    });
  }
}

/**
 * Travelling sine wave down the body, amplitude growing toward the tail.
 * The exported fish are rigid meshes with no rig, so this is what puts the
 * motion back — and because fins are part of the same mesh, they flex with
 * the body instead of needing separate animation.
 *
 * Injected at `#include <begin_vertex>`, which is stable across three
 * versions, rather than patching fragment output.
 */
function applySwim(
  root: THREE.Object3D,
  clock: { value: number },
  phase: number,
  speed: number,
) {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;

    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox!;
    const zMax = bb.max.z;
    const span = Math.max(1e-4, bb.max.z - bb.min.z);

    const wasArray = Array.isArray(mesh.material);
    const mats = wasArray
      ? (mesh.material as THREE.Material[])
      : [mesh.material as THREE.Material];

    const patched = mats.map((m) => {
      const mat = m.clone();                    // per-fish, so phases differ
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = clock;
        shader.uniforms.uPhase = { value: phase };
        shader.uniforms.uSpeed = { value: speed };
        shader.uniforms.uZMax = { value: zMax };
        shader.uniforms.uSpan = { value: span };
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            `#include <common>
             uniform float uTime;
             uniform float uPhase;
             uniform float uSpeed;
             uniform float uZMax;
             uniform float uSpan;`,
          )
          .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
             float swimT = clamp((uZMax - transformed.z) / uSpan, 0.0, 1.0);
             float swimAmp = pow(swimT, 1.9) * uSpan * 0.11;
             transformed.x += sin(swimT * 5.0 - uTime * uSpeed - uPhase) * swimAmp;
             // a little yaw into the stroke so it bends rather than shears
             transformed.z += cos(swimT * 5.0 - uTime * uSpeed - uPhase)
                              * swimAmp * 0.12;`,
          );
      };
      mat.needsUpdate = true;
      return mat;
    });

    mesh.material = wasArray ? patched : patched[0];
  });
}

/**
 * Bends a rooted mesh as though a current were pushing it: no displacement
 * at the base, growing toward the tip.
 *
 * Like the fish, the exported plants are rigid meshes, so without this the
 * whole reef is motionless — which is most of what made the tank read as a
 * dry diorama rather than water. Height is +Y here, not +Z: the glTF
 * exporter converts Blender's Z-up on the way out.
 */
function applySway(
  root: THREE.Object3D,
  clock: { value: number },
  phase: number,
  stiffness: number,
) {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;

    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox!;
    const yMin = bb.min.y;
    const span = Math.max(1e-4, bb.max.y - bb.min.y);

    const wasArray = Array.isArray(mesh.material);
    const mats = wasArray
      ? (mesh.material as THREE.Material[])
      : [mesh.material as THREE.Material];

    const patched = mats.map((m) => {
      const mat = m.clone();                    // per-plant, so phases differ
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = clock;
        shader.uniforms.uPhase = { value: phase };
        shader.uniforms.uYMin = { value: yMin };
        shader.uniforms.uSpan = { value: span };
        shader.uniforms.uStiff = { value: stiffness };
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            `#include <common>
             uniform float uTime;
             uniform float uPhase;
             uniform float uYMin;
             uniform float uSpan;
             uniform float uStiff;`,
          )
          .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
             float swayT = clamp((transformed.y - uYMin) / uSpan, 0.0, 1.0);
             // squared falloff pins the base to the sand — a linear one
             // makes the whole plant slide sideways instead of bending
             float swayAmp = swayT * swayT * uSpan * uStiff;
             // two incommensurate rates so the drift never visibly loops
             float w = uTime * 0.9 + uPhase;
             transformed.x += (sin(w + swayT * 1.6) * 0.75
                             + sin(w * 0.53 + swayT * 2.7) * 0.25) * swayAmp;
             transformed.z += (cos(w * 0.71 + swayT * 1.9) * 0.6) * swayAmp;`,
          );
      };
      mat.needsUpdate = true;
      return mat;
    });

    mesh.material = wasArray ? patched : patched[0];
  });
}

/**
 * Renders one node from the shared glb. Every instance gets its own clone
 * so the same model can appear many times.
 */
export function ReefModel({
  id,
  swim = false,
  sway = 0,
  seed = 0,
}: {
  id: string;
  swim?: boolean;
  /** current-driven bend, as a fraction of the model's height; 0 = rigid */
  sway?: number;
  seed?: number;
}) {
  const { scene } = useGLTF(MODEL_URL);
  const clock = useRef({ value: 0 });
  tuneLibrary(scene);

  const object = useMemo<THREE.Object3D | null>(() => {
    const source = scene.getObjectByName(id);
    if (!source) return null;
    const clone = source.clone(true);
    if (swim) {
      applySwim(clone, clock.current, seed * Math.PI * 2, 2.6 + seed * 1.4);
    } else if (sway > 0) {
      applySway(clone, clock.current, seed * Math.PI * 2, sway);
    }
    return clone;
  }, [scene, id, swim, sway, seed]);

  useFrame((_, delta) => {
    if (swim || sway > 0) clock.current.value += delta;
  });

  if (!object) return null;
  return <primitive object={object} />;
}

useGLTF.preload(MODEL_URL);
