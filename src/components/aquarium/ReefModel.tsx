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
 * Renders one node from the shared glb. Every instance gets its own clone
 * so the same model can appear many times.
 */
export function ReefModel({
  id,
  swim = false,
  seed = 0,
}: {
  id: string;
  swim?: boolean;
  seed?: number;
}) {
  const { scene } = useGLTF(MODEL_URL);
  const clock = useRef({ value: 0 });

  const object = useMemo<THREE.Object3D | null>(() => {
    const source = scene.getObjectByName(id);
    if (!source) return null;
    const clone = source.clone(true);
    if (swim) {
      applySwim(clone, clock.current, seed * Math.PI * 2, 2.6 + seed * 1.4);
    }
    return clone;
  }, [scene, id, swim, seed]);

  useFrame((_, delta) => {
    if (swim) clock.current.value += delta;
  });

  if (!object) return null;
  return <primitive object={object} />;
}

useGLTF.preload(MODEL_URL);
