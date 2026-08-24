"use client";

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import type { Object3D } from "three";

export const MODEL_URL = "/models/reef.glb";

/**
 * Catalog ids that have a Blender-authored mesh inside reef.glb.
 * Anything not listed here keeps rendering its procedural fallback,
 * so the tank works whether or not an item has been modelled yet.
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
  "guppy", "clownfish", "neon", "tang", "angel", "koi",
  "seahorse", "jelly", "ray",
]);

/**
 * Renders one node from the shared glb. Every instance gets its own clone
 * (geometry and materials stay shared), so the same model can appear many
 * times in the tank.
 */
export function ReefModel({ id }: { id: string }) {
  const { scene } = useGLTF(MODEL_URL);

  const object = useMemo<Object3D | null>(() => {
    const source = scene.getObjectByName(id);
    return source ? source.clone(true) : null;
  }, [scene, id]);

  if (!object) return null;
  return <primitive object={object} />;
}

useGLTF.preload(MODEL_URL);
