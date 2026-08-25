"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { buildFloorOverlay } from "./terrain";

const VERT = /* glsl */ `
  varying vec2 vXZ;
  varying float vY;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vXZ = world.xz;
    vY = world.y;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uStrength;
  uniform vec3  uShallow;
  uniform vec3  uBright;
  varying vec2 vXZ;
  varying float vY;

  // The domain shift is load-bearing: folding into mod(TAU) and offsetting
  // far from the origin is what resolves this into thin filaments rather
  // than a flat wash.
  float caustics(vec2 uv, float t) {
    vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
    vec2 i = p;
    float c = 1.0;
    const float inten = 0.0055;
    for (int n = 0; n < 3; n++) {
      float tt = t * (1.0 - (3.5 / float(n + 1)));
      i = p + vec2(cos(tt - i.x) + sin(tt + i.y),
                   sin(tt - i.y) + cos(tt + i.x));
      c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten),
                             p.y / (cos(i.y + tt) / inten)));
    }
    c /= 3.0;
    c = 1.17 - pow(c, 1.4);
    return clamp(pow(abs(c), 8.0), 0.0, 1.0);
  }

  void main() {
    // two scales so the pattern never reads as tiled
    float c = clamp(caustics(vXZ * 0.46, uTime * 0.38), 0.0, 1.0);

    // brighter in the shallows
    float depthFade = smoothstep(-1.65, -0.35, vY) * 0.6 + 0.4;

    // soften at the walls so the pattern doesn't cut off hard
    vec2 d = abs(vXZ) / 3.0;
    float edge = 1.0 - smoothstep(0.80, 1.0, max(d.x, d.y));

    float amt = c * uStrength * depthFade * edge;
    vec3 col = mix(uShallow, uBright, c);
    gl_FragColor = vec4(col * amt, amt);
  }
`;

export function Caustics({ strength = 2.4 }: { strength?: number }) {
  const geo = useMemo(() => buildFloorOverlay(), []);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uTime: { value: 0 },
          uStrength: { value: strength },
          uShallow: { value: new THREE.Color("#2fd0e8") },
          uBright: { value: new THREE.Color("#e8ffff") },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [strength],
  );

  const t = useRef(0);
  useFrame((_, delta) => {
    t.current += delta;
    mat.uniforms.uTime.value = t.current;
  });

  return <mesh geometry={geo} material={mat} renderOrder={15} />;
}
