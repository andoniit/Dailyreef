"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * A procedural environment map for the tank.
 *
 * Reflections are what actually make a fish look wet — low roughness on
 * its own only produces a single specular dot from each directional
 * light. This builds the environment in-process rather than fetching an
 * HDR from a CDN, so the tank still looks right offline and there is no
 * network dependency in the render path.
 *
 * The gradient is deliberately reef-coloured: bright sky overhead, warm
 * sand low down, teal around the horizon. A fish rolling through it picks
 * up the tank's own palette instead of a grey studio sheen.
 */
const VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  varying vec3 vDir;
  void main() {
    float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 sand    = vec3(0.85, 0.75, 0.56);
    vec3 horizon = vec3(0.30, 0.72, 0.80);
    vec3 sky     = vec3(0.92, 0.98, 1.00);
    vec3 c = h < 0.5
      ? mix(sand, horizon, smoothstep(0.0, 0.5, h))
      : mix(horizon, sky, smoothstep(0.5, 1.0, h));
    // a bright patch overhead standing in for the sun through the surface
    float sun = pow(max(vDir.y, 0.0), 8.0);
    c += vec3(1.0, 0.97, 0.9) * sun * 0.55;
    gl_FragColor = vec4(c, 1.0);
  }
`;

export function TankEnv() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    pmrem.compileEquirectangularShader();

    const box = new THREE.BoxGeometry(2, 2, 2);
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(box, mat));

    const rt = pmrem.fromScene(envScene, 0.04);
    const prev = scene.environment;
    scene.environment = rt.texture;

    return () => {
      scene.environment = prev;
      rt.dispose();
      pmrem.dispose();
      box.dispose();
      mat.dispose();
    };
  }, [gl, scene]);

  return null;
}
