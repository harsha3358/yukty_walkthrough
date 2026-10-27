"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { scrollState } from "@/lib/scrollState";
import { buildTunnel, chapterToU, SEGMENTS, Tunnel, wallFragment, wallVertex } from "./tunnel";
import { centerpieces } from "./Centerpieces";

const CAMERA_LAG = 5.5; // world units the camera trails behind the point it looks at

function sampleIndex(u: number) {
  return Math.min(Math.max(Math.round(u * SEGMENTS), 0), SEGMENTS);
}

function Walls({ tunnel }: { tunnel: Tunnel }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: wallVertex,
        fragmentShader: wallFragment,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uLength: { value: tunnel.length },
          uEarth: { value: new THREE.Color("#2a190d") },
          uAmber: { value: new THREE.Color("#ffb347").multiplyScalar(1.3) },
          uTeal: { value: new THREE.Color("#3ef0d0").multiplyScalar(1.5) },
        },
      }),
    [tunnel]
  );
  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
  });
  return <mesh geometry={tunnel.geometry} material={material} />;
}

const antVertex = /* glsl */ `
  attribute vec3 color;
  varying vec3 vColor;
  void main() {
    vColor = color;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = 26.0 / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
const antFragment = /* glsl */ `
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d);
    gl_FragColor = vec4(vColor * a, a);
  }
`;

// Ants crawling over the tunnel walls in both directions, in single-file trails.
function Ants({ tunnel, count }: { tunnel: Tunnel; count: number }) {
  const state = useMemo(() => {
    const u = new Float32Array(count);
    const angle = new Float32Array(count);
    const speed = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    const amber = new THREE.Color("#ffb347").multiplyScalar(2.2);
    const teal = new THREE.Color("#3ef0d0").multiplyScalar(2.2);
    const trails = 14;
    for (let i = 0; i < count; i++) {
      u[i] = Math.random();
      // Most ants march along shared trails; a few wander as scouts.
      const trail = i % trails;
      angle[i] = (trail / trails) * Math.PI * 2 + (Math.random() - 0.5) * 0.08;
      speed[i] = (trail % 2 ? 1 : -1) * (1.2 + Math.random() * 0.8);
      const c = i % 9 === 0 ? teal : amber;
      colors.set([c.r, c.g, c.b], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const material = new THREE.ShaderMaterial({
      vertexShader: antVertex,
      fragmentShader: antFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { u, angle, speed, geometry, material };
  }, [count]);

  useFrame((_, dt) => {
    const pos = state.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const step = Math.min(dt, 0.05) / tunnel.length;
    for (let i = 0; i < count; i++) {
      let u = state.u[i] + state.speed[i] * step;
      if (u > 1) u -= 1;
      if (u < 0) u += 1;
      state.u[i] = u;
      const k = sampleIndex(u);
      const p = tunnel.points[k];
      const n = tunnel.normals[k];
      const b = tunnel.binormals[k];
      const r = tunnel.radiusAt(u) * 0.985;
      const a = state.angle[i] + Math.sin(u * 400 + i) * 0.02;
      const ca = Math.cos(a) * r;
      const sa = Math.sin(a) * r;
      arr[i * 3] = p.x + n.x * ca + b.x * sa;
      arr[i * 3 + 1] = p.y + n.y * ca + b.y * sa;
      arr[i * 3 + 2] = p.z + n.z * ca + b.z * sa;
    }
    pos.needsUpdate = true;
  });

  return <points geometry={state.geometry} material={state.material} frustumCulled={false} />;
}

// Places each chamber's centerpiece just to the side of the camera's line of sight.
function Chambers({ tunnel }: { tunnel: Tunnel }) {
  const { size } = useThree();
  const portrait = size.width < size.height;
  const frames = useMemo(() => {
    const lag = CAMERA_LAG / tunnel.length;
    return tunnel.chamberU.map((u) => {
      const target = tunnel.curve.getPointAt(u);
      const eye = tunnel.curve.getPointAt(Math.max(u - lag, 0));
      const forward = target.clone().sub(eye).normalize();
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
      return { target, eye, right };
    });
  }, [tunnel]);

  return (
    <>
      {frames.map(({ target, eye, right }, i) => {
        const Piece = centerpieces[i];
        const pos = portrait
          ? target.clone().add(new THREE.Vector3(0, 1.1, 0))
          : target.clone().addScaledVector(right, 2.1).add(new THREE.Vector3(0, 0.15, 0));
        const m = new THREE.Matrix4().lookAt(eye, pos, new THREE.Vector3(0, 1, 0));
        const q = new THREE.Quaternion().setFromRotationMatrix(m);
        return (
          <group key={i} position={pos} quaternion={q} scale={portrait ? 0.5 : 1}>
            {Piece && <Piece />}
          </group>
        );
      })}
    </>
  );
}

function CameraRig({ tunnel }: { tunnel: Tunnel }) {
  const smooth = useRef(0);
  const look = useMemo(() => new THREE.Vector3(), []);
  const eye = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }, dt) => {
    smooth.current = THREE.MathUtils.damp(smooth.current, scrollState.chapter, 3.2, dt);
    const u = chapterToU(tunnel, smooth.current);
    const lag = CAMERA_LAG / tunnel.length;
    tunnel.curve.getPointAt(Math.min(Math.max(u - lag, 0), 1), eye);
    tunnel.curve.getPointAt(Math.min(u, 1), look);
    eye.y += scrollState.pointerY * 0.35;
    camera.position.copy(eye);
    look.x += scrollState.pointerX * 0.8;
    look.y += scrollState.pointerY * 0.5;
    camera.lookAt(look);
  });
  return null;
}

export default function ColonyScene() {
  const tunnel = useMemo(() => buildTunnel(centerpieces.length), []);
  const lowPower = typeof window !== "undefined" && (window.innerWidth < 768 || navigator.hardwareConcurrency <= 4);
  return (
    <Canvas
      dpr={lowPower ? 1 : [1, 1.75]}
      camera={{ fov: 62, near: 0.05, far: 120 }}
      gl={{ antialias: false, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#050307"]} />
      <Walls tunnel={tunnel} />
      <Ants tunnel={tunnel} count={lowPower ? 1800 : 4200} />
      <Chambers tunnel={tunnel} />
      <CameraRig tunnel={tunnel} />
      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur luminanceThreshold={0.45} intensity={lowPower ? 0.9 : 1.25} radius={0.7} />
        <Vignette offset={0.25} darkness={0.85} />
      </EffectComposer>
    </Canvas>
  );
}
