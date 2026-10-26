"use client";

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshReflectorMaterial } from "@react-three/drei";
import * as THREE from "three";
import { scrollState } from "@/lib/scrollState";

// A still, glassy lake at night: a real planar mirror (so every drone light,
// trail and beam is reflected), gently broken up by drifting ripples. A faint
// radar sweep and a shockwave on every mission change skim across the surface.

// Tileable ripple texture drawn once on a canvas: soft overlapping rings.
function rippleTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 8 + Math.random() * 40;
    for (const [dx, dy] of [
      [0, 0],
      [size, 0],
      [-size, 0],
      [0, size],
      [0, -size],
    ]) {
      const g = ctx.createRadialGradient(x + dx, y + dy, r * 0.6, x + dx, y + dy, r);
      const light = Math.random() < 0.5;
      g.addColorStop(0, "rgba(128,128,128,0)");
      g.addColorStop(0.5, light ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.18)");
      g.addColorStop(1, "rgba(128,128,128,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(36, 36);
  return texture;
}

const sheenVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const sheenFragment = /* glsl */ `
  uniform float uTime;
  uniform float uBurst;
  varying vec3 vWorld;
  void main() {
    float d = length(vWorld.xz);
    float sweep = exp(-pow(d - mod(uTime * 7.0, 60.0), 2.0) * 0.12) * 0.06;
    float burst = exp(-pow(d - uBurst * 30.0, 2.0) * 0.08) * exp(-uBurst * 1.2) * 0.9;
    float fade = smoothstep(55.0, 10.0, d);
    vec3 col = vec3(0.3, 0.85, 1.0) * (sweep + burst) * fade;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export default function Water({ lowPower }: { lowPower: boolean }) {
  const ripples = useMemo(() => rippleTexture(), []);
  const sheen = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: sheenVertex,
        fragmentShader: sheenFragment,
        uniforms: { uTime: { value: 0 }, uBurst: { value: 10 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  );
  const burst = useMemo(() => ({ mission: 0, at: -10 }), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // Two slow drifts read as wind moving over still water.
    ripples.offset.set(Math.sin(t * 0.05) * 0.4 + t * 0.012, t * 0.008);
    const mission = Math.round(scrollState.chapter);
    if (mission !== burst.mission) {
      burst.mission = mission;
      burst.at = t;
    }
    sheen.uniforms.uTime.value = t;
    sheen.uniforms.uBurst.value = t - burst.at;
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[600, 600]} />
        <MeshReflectorMaterial
          resolution={lowPower ? 512 : 1024}
          mirror={1}
          mixStrength={1.6}
          mixContrast={1.1}
          mixBlur={1.4}
          blur={[220, 60]}
          roughness={0.35}
          metalness={0}
          color="#ffffff"
          distortion={0.35}
          distortionMap={ripples}
          normalMap={ripples}
          normalScale={new THREE.Vector2(0.25, 0.25)}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} material={sheen}>
        <planeGeometry args={[140, 140]} />
      </mesh>
    </group>
  );
}
