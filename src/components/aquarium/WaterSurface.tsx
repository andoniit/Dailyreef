"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TANK } from "@/lib/store";
import { W } from "./terrain";

const { waterTop } = TANK;

/** Classic Perlin 3D noise (Stefan Gustavson / Ashima). */
const PERLIN = /* glsl */ `
  vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
  vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
  vec3 fade(vec3 t){ return t*t*t*(t*(t*6.0-15.0)+10.0); }

  float cnoise(vec3 P){
    vec3 Pi0 = floor(P); vec3 Pi1 = Pi0 + vec3(1.0);
    Pi0 = mod(Pi0, 289.0); Pi1 = mod(Pi1, 289.0);
    vec3 Pf0 = fract(P); vec3 Pf1 = Pf0 - vec3(1.0);
    vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
    vec4 iy = vec4(Pi0.yy, Pi1.yy);
    vec4 iz0 = Pi0.zzzz; vec4 iz1 = Pi1.zzzz;
    vec4 ixy = permute(permute(ix) + iy);
    vec4 ixy0 = permute(ixy + iz0);
    vec4 ixy1 = permute(ixy + iz1);
    vec4 gx0 = ixy0 / 7.0;
    vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
    gx0 = fract(gx0);
    vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
    vec4 sz0 = step(gz0, vec4(0.0));
    gx0 -= sz0 * (step(0.0, gx0) - 0.5);
    gy0 -= sz0 * (step(0.0, gy0) - 0.5);
    vec4 gx1 = ixy1 / 7.0;
    vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
    gx1 = fract(gx1);
    vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
    vec4 sz1 = step(gz1, vec4(0.0));
    gx1 -= sz1 * (step(0.0, gx1) - 0.5);
    gy1 -= sz1 * (step(0.0, gy1) - 0.5);
    vec3 g000 = vec3(gx0.x,gy0.x,gz0.x); vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
    vec3 g010 = vec3(gx0.z,gy0.z,gz0.z); vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
    vec3 g001 = vec3(gx1.x,gy1.x,gz1.x); vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
    vec3 g011 = vec3(gx1.z,gy1.z,gz1.z); vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);
    vec4 norm0 = taylorInvSqrt(vec4(dot(g000,g000), dot(g010,g010), dot(g100,g100), dot(g110,g110)));
    g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;
    vec4 norm1 = taylorInvSqrt(vec4(dot(g001,g001), dot(g011,g011), dot(g101,g101), dot(g111,g111)));
    g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;
    float n000 = dot(g000, Pf0);
    float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
    float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
    float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
    float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
    float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
    float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
    float n111 = dot(g111, Pf1);
    vec3 fade_xyz = fade(Pf0);
    vec4 n_z = mix(vec4(n000,n100,n010,n110), vec4(n001,n101,n011,n111), fade_xyz.z);
    vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
    float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
    return 2.2 * n_xyz;
  }
`;


const WATER_FLOOR = -1.62;          // below the deepest point of the seabed
const INSET = 0.02;

/**
 * Top surface and side walls as ONE mesh. Two attributes drive it:
 *   aWave — 1 where the wave displaces (top surface + the wall's top ring),
 *           0 further down, so the wall edge tracks the surface exactly.
 *   aTop  — 1 on the surface, 0 on the walls, so the fragment shader can
 *           shade them differently without a second material.
 * Building them separately is what left a seam: a wavy plane can never
 * meet a wall whose top edge is flat.
 */
function buildWaterBody(divisions = 128): THREE.BufferGeometry {
  const half = W / 2 - INSET;
  const step = (half * 2) / divisions;
  const row = divisions + 1;

  const pos: number[] = [];
  const wave: number[] = [];
  const top: number[] = [];
  const index: number[] = [];

  for (let j = 0; j < row; j++) {
    for (let i = 0; i < row; i++) {
      pos.push(-half + step * i, waterTop, -half + step * j);
      wave.push(1);
      top.push(1);
    }
  }
  for (let j = 0; j < divisions; j++) {
    for (let i = 0; i < divisions; i++) {
      const a = j * row + i;
      index.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
    }
  }

  // border ring of the top grid, walked in order
  const ring: number[] = [];
  for (let i = 0; i < divisions; i++) ring.push(i);
  for (let j = 0; j < divisions; j++) ring.push(j * row + divisions);
  for (let i = divisions; i > 0; i--) ring.push(divisions * row + i);
  for (let j = divisions; j > 0; j--) ring.push(j * row);

  // skirt: duplicate the ring at the top (wave-following) and at the floor
  const skirtTop = pos.length / 3;
  for (const r of ring) {
    pos.push(pos[r * 3], waterTop, pos[r * 3 + 2]);
    wave.push(1);
    top.push(0);
  }
  const skirtBottom = pos.length / 3;
  for (const r of ring) {
    pos.push(pos[r * 3], WATER_FLOOR, pos[r * 3 + 2]);
    wave.push(0);
    top.push(0);
  }
  for (let k = 0; k < ring.length; k++) {
    const k2 = (k + 1) % ring.length;
    const a = skirtTop + k, b = skirtTop + k2;
    const c = skirtBottom + k, d = skirtBottom + k2;
    index.push(a, b, c, b, d, c);   // outward-facing
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aWave", new THREE.Float32BufferAttribute(wave, 1));
  g.setAttribute("aTop", new THREE.Float32BufferAttribute(top, 1));
  g.setIndex(index);
  return g;
}

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uBigElevation;
  uniform vec2  uBigFrequency;
  uniform float uBigSpeed;
  uniform float uSmallElevation;
  uniform float uSmallFrequency;
  uniform float uSmallSpeed;
  uniform float uSmallIterations;

  attribute float aWave;
  attribute float aTop;

  varying float vElevation;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying float vTop;
  varying float vWorldY;
  varying vec2 vXZ;

  ${PERLIN}

  float bigWaves(vec2 p) {
    return sin(p.x * uBigFrequency.x + uTime * uBigSpeed)
         * sin(p.y * uBigFrequency.y + uTime * uBigSpeed)
         * uBigElevation;
  }

  // ITERS controls how much Perlin detail is summed. cnoise is a large
  // function and every call is inlined, so the displacement gets the full
  // 3 octaves while the two finite-difference samples used for the normal
  // get 1 — cutting cnoise from 9 calls per vertex to 5 with no visible
  // difference at this scale.
  // ITERS drives how many Perlin octaves are summed. cnoise is a large
  // function and every call is inlined, so the displacement gets the full
  // count while the two finite-difference samples for the normal get one.
  float elevationAt(vec2 p, float iters) {
    float e = bigWaves(p);
    for (float i = 1.0; i <= iters; i++) {
      e -= abs(cnoise(vec3(p * uSmallFrequency * i, uTime * uSmallSpeed))
               * uSmallElevation / i);
    }
    return e;
  }

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    float e = elevationAt(world.xz, uSmallIterations);
    world.y += e * aWave;      // walls below the rim stay put

    float d = 0.09;
    float base = elevationAt(world.xz, 1.0);
    float ex = elevationAt(world.xz + vec2(d, 0.0), 1.0);
    float ez = elevationAt(world.xz + vec2(0.0, d), 1.0);
    vec3 tx = normalize(vec3(d, ex - base, 0.0));
    vec3 tz = normalize(vec3(0.0, ez - base, d));
    vNormalW = normalize(cross(tz, tx));

    vElevation = e;
    vTop = aTop;
    vWorldY = world.y;
    vXZ = world.xz;
    vViewDir = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3  uDepthColor;
  uniform vec3  uSurfaceColor;
  uniform float uColorOffset;
  uniform float uColorMultiplier;
  uniform float uOpacity;
  uniform vec3  uSunDir;

  uniform vec3  uWallShallow;
  uniform vec3  uWallDeep;
  uniform float uWallOpacity;
  uniform float uWaterTop;
  uniform float uWaterFloor;

  varying float vElevation;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying float vTop;
  varying float vWorldY;
  varying vec2 vXZ;

  uniform vec3  uFoamColor;
  uniform float uFoamWidth;
  uniform float uRimWidth;
  uniform float uFloorY;
  uniform float uCrestStart;

  // Mirror of terrainHeight() in terrain.ts. The wall has to know where the
  // sand is to draw a shoreline against it; without this there is no
  // waterline in the tank at all, since the seabed never breaches the top.
  float seabedAt(vec2 p) {
    float u = (p.x + p.y) / 6.0;
    float slope = 0.34 * tanh(u * 1.6);
    float dunes = sin(p.x * 0.9 + 1.3) * 0.055
                + cos(p.y * 1.1 - 0.7) * 0.055
                + sin((p.x + p.y) * 0.55) * 0.045
                + sin(p.x * 2.1 - p.y * 1.7) * 0.02;
    return uFloorY + slope + dunes;
  }

  void main() {
    vec3 color;
    float alpha;

    if (vTop < 0.5) {
      // side wall: depth gradient, translucent so the reef shows through
      float k = clamp((vWorldY - uWaterFloor) / (uWaterTop - uWaterFloor), 0.0, 1.0);
      color = mix(uWallDeep, uWallShallow, pow(k, 0.85));
      alpha = uWallOpacity;

      // foam where the water meets the sand
      float bed = seabedAt(vXZ);
      float shore = 1.0 - smoothstep(0.0, uFoamWidth, abs(vWorldY - bed));
      // Bright lip along the top rim. This must track the LOCAL surface
      // height, not the flat uWaterTop — the wall's top edge is displaced
      // by the same wave, so a constant test drifts above the edge in a
      // trough and below it on a crest.
      float lip = uWaterTop + vElevation;
      float rim = 1.0 - smoothstep(0.0, uRimWidth, abs(vWorldY - lip));
      float foam = clamp(shore + rim * 0.85, 0.0, 1.0);
      color = mix(color, uFoamColor, foam);
      alpha = mix(alpha, min(1.0, alpha + 0.45), foam);
    } else {
      // The original leaves this unclamped. The high-end overshoot is
      // worth keeping — it's what makes crests brighter than the surface
      // colour — but a negative value extrapolates BELOW uDepthColor and
      // produced near-black troughs in a tank this size.
      float mixStrength = max((vElevation + uColorOffset) * uColorMultiplier, 0.0);
      color = mix(uDepthColor, uSurfaceColor, mixStrength);

      vec3 h = normalize(uSunDir + vViewDir);
      float spec = pow(max(dot(vNormalW, h), 0.0), 90.0);
      float fresnel = pow(1.0 - max(dot(vNormalW, vViewDir), 0.0), 3.0);
      // A whisker of foam on the true peaks only. The reference has none
      // at all; anything heavier here buries the depth gradient under a
      // flat white wash, which is exactly what it was doing before.
      float crest = smoothstep(uCrestStart, uCrestStart + 0.05, vElevation);
      color = mix(color, uFoamColor, crest * 0.3);

      color += vec3(1.0, 1.0, 0.96) * spec * 0.4;
      color += vec3(0.55, 0.90, 1.0) * fresnel * 0.10;
      alpha = uOpacity + fresnel * 0.06;
    }

    gl_FragColor = vec4(color, alpha);
    // without this the shader emits raw linear and every colour reads
    // wrong — ShaderMaterial does not apply the conversion for you
    #include <colorspace_fragment>
  }
`;

export function WaterSurface() {
  // the wave field lives on the GPU now, so this can be dense for free
  const geo = useMemo(() => buildWaterBody(128), []);

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uTime: { value: 0 },
          uBigElevation: { value: 0.105 },
          uBigFrequency: { value: new THREE.Vector2(1.33, 0.50) },
          uBigSpeed: { value: 0.75 },
          uSmallElevation: { value: 0.045 },
          uSmallFrequency: { value: 1.0 },
          uSmallSpeed: { value: 0.20 },
          uSmallIterations: { value: 4 },
          // The reference's own colours. Its gradient is calibrated so the
          // mean elevation lands at (or below) uDepthColor and only crests
          // climb to uSurfaceColor. Offset/multiplier below reproduce that
          // distribution for OUR elevation range, which is roughly half the
          // reference's because the tank is 6 units instead of 2.
          uDepthColor: { value: new THREE.Color("#35b3cc") },
          uSurfaceColor: { value: new THREE.Color("#86e2f2") },
          uColorOffset: { value: 0.035 },
          uColorMultiplier: { value: 9.0 },
          // Was 0.92, which meant anything seen through the surface —
          // every fish in the middle of the tank, the island's lower
          // half — contributed under a tenth of its own pixel and read
          // as dark blue water. The wave colour still carries; it just
          // no longer paints over the reef.
          uOpacity: { value: 0.78 },
          uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.35).normalize() },
          uWallShallow: { value: new THREE.Color("#6fe0e8") },
          uWallDeep: { value: new THREE.Color("#2a9ab8") },
          uWallOpacity: { value: 0.40 },
          uWaterTop: { value: waterTop },
          uWaterFloor: { value: WATER_FLOOR },
          uFoamColor: { value: new THREE.Color("#eaffff") },
          uFoamWidth: { value: 0.085 },
          uRimWidth: { value: 0.045 },
          uFloorY: { value: TANK.floorY },
          uCrestStart: { value: 0.075 },
        },
        transparent: true,
        depthWrite: false,
        // DoubleSide blended the far walls' inner faces over the reef
        // as a floating quad; only the outward faces should draw
        side: THREE.FrontSide,
      }),
    [],
  );

  const t = useRef(0);
  useFrame((_, delta) => {
    t.current += delta;
    mat.uniforms.uTime.value = t.current;
  });

  return (
    <mesh geometry={geo} material={mat} renderOrder={22} />
  );
}
