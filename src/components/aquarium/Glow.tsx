"use client";

import { useMemo } from "react";
import * as THREE from "three";

/**
 * Soft additive halo around a self-lit item.
 *
 * Emissive materials make a surface look lit, but they cannot spill light
 * past their own silhouette — that normally takes a bloom pass. Rather
 * than pull in a post-processing pipeline (which would also sit between
 * the water shader and the screen), this fakes the spill with one
 * camera-facing sprite per glowing item. It is a single transparent quad,
 * so it costs almost nothing next to a real bloom.
 */
let sharedTexture: THREE.Texture | null = null;

function radialTexture(): THREE.Texture {
  if (sharedTexture) return sharedTexture;

  const S = 128;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  // eased falloff: a linear ramp reads as a hard-edged disc
  g.addColorStop(0.0, "rgba(255,255,255,1)");
  g.addColorStop(0.22, "rgba(255,255,255,0.55)");
  g.addColorStop(0.5, "rgba(255,255,255,0.16)");
  g.addColorStop(1.0, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  sharedTexture = tex;
  return tex;
}

export function Glow({
  color,
  radius = 0.55,
  strength = 0.5,
  y = 0.22,
}: {
  color: string;
  radius?: number;
  strength?: number;
  y?: number;
}) {
  const tex = useMemo(() => radialTexture(), []);
  const mat = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: tex,
        color: new THREE.Color(color),
        transparent: true,
        opacity: strength,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        // additive over the reef, but the water still draws on top
        depthTest: true,
      }),
    [tex, color, strength],
  );

  return (
    <sprite position={[0, y, 0]} scale={[radius * 2, radius * 2, 1]} material={mat} />
  );
}
