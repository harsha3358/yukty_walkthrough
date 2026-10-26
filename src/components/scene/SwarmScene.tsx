"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";
import { scrollState } from "@/lib/scrollState";
import LogoReveal from "./LogoReveal";
import Markers from "./Markers";
import Swarm from "./Swarm";
import Water from "./Water";
import { LOGO_POSITION, SKY_CENTER } from "./layout";

// Swarm OS: a drone swarm over a glassy lake at night, seen through a
// mission-control camera. Each mission has a camera pose; scrolling flies the
// camera between them.

type Pose = { focus: THREE.Vector3; distance: number; yaw: number; pitch: number };

const pose = (focus: THREE.Vector3, distance: number, yaw: number, pitch: number): Pose => ({ focus, distance, yaw, pitch });
const FOV = 50;
const ground = new THREE.Vector3(0, 0, -1);

const POSES: Pose[] = [
  pose(LOGO_POSITION, 8, 0, 0.05), // 00 boot: the logo
  pose(new THREE.Vector3(0, 6, -2), 19, 0.25, 0.25), // 01 bridge
  pose(new THREE.Vector3(0, 5.5, -4), 17, -0.4, 0.3), // 02 pillars
  pose(SKY_CENTER, 16, 0.6, 0.15), // 03 flock
  pose(ground, 23, 0.2, 0.95), // 04 ACO, near top-down
  pose(new THREE.Vector3(0, 0, -2), 22, -0.3, 0.8), // 05 PSO
  pose(SKY_CENTER, 15, 0.9, 0.2), // 06 light show
  pose(new THREE.Vector3(0, 6, -2), 15, -0.7, 0.15), // 07 sessions
  pose(new THREE.Vector3(0, 7, -2), 13, 0, 0.1), // 08 zero
  pose(new THREE.Vector3(0, 7, -2), 18, 0.4, 0.3), // 09 constellation
  pose(SKY_CENTER.clone().setY(9), 17, 0, 0.12), // 10 YUKTY AI
];

function CameraRig() {
  const { size } = useThree();
  const portrait = size.width < size.height;
  const state = useMemo(() => ({ chapter: 0, focus: new THREE.Vector3(), eye: new THREE.Vector3(), look: new THREE.Vector3(), right: new THREE.Vector3() }), []);

  useFrame(({ camera, clock }, dt) => {
    state.chapter = THREE.MathUtils.damp(state.chapter, scrollState.chapter, 2.6, dt);
    const i = Math.min(Math.floor(state.chapter), POSES.length - 1);
    const a = POSES[i];
    const b = POSES[Math.min(i + 1, POSES.length - 1)];
    const f = THREE.MathUtils.smootherstep(state.chapter - i, 0, 1);

    const distance = THREE.MathUtils.lerp(a.distance, b.distance, f) * (portrait ? 1.45 : 1);
    const yaw = THREE.MathUtils.lerp(a.yaw, b.yaw, f) + Math.sin(clock.elapsedTime * 0.08) * 0.05 + scrollState.pointerX * 0.06;
    const pitch = THREE.MathUtils.lerp(a.pitch, b.pitch, f) + scrollState.pointerY * 0.03;
    state.focus.lerpVectors(a.focus, b.focus, f);

    state.eye.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(distance).add(state.focus);
    // Frame the subject in the open space right of the text panel (or above it on phones).
    state.right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    state.look.copy(state.focus);
    if (portrait) state.look.y -= distance * 0.2;
    else {
      const panel = Math.min(640, size.width * 0.62);
      const ndc = ((panel + size.width) / 2 / size.width) * 2 - 1;
      const halfWidth = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * (size.width / size.height) * distance;
      state.look.addScaledVector(state.right, -ndc * halfWidth);
    }

    camera.position.copy(state.eye);
    camera.lookAt(state.look);
  });
  return null;
}

// The logo owns mission 00. It lifts away so it doesn't crowd the other
// missions, then returns above the swarm's "YUKTY AI" sign-off in mission 10.
function LogoStage() {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const c = scrollState.chapter;
    const intro = 1 - THREE.MathUtils.smoothstep(c, 0.25, 0.85);
    const finale = THREE.MathUtils.smoothstep(c, 9.2, 9.9);
    const scale = Math.max(intro, finale * 0.8);
    g.scale.setScalar(Math.max(scale, 0.001));
    g.visible = scale > 0.01;
    g.position.copy(LOGO_POSITION);
    g.position.y += (1 - intro) * (1 - finale) * 6 + finale * 4.8;
  });
  return (
    <group ref={ref}>
      <LogoReveal />
    </group>
  );
}

// Night sky dome: deep navy overhead, a faint violet-teal glow at the horizon.
const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const skyFragment = /* glsl */ `
  varying vec3 vDir;
  void main() {
    float h = max(vDir.y, 0.0);
    vec3 top = vec3(0.003, 0.004, 0.012);
    vec3 horizon = vec3(0.025, 0.022, 0.06);
    vec3 col = mix(horizon, top, pow(h, 0.35));
    col += vec3(0.02, 0.07, 0.09) * exp(-h * 22.0);
    gl_FragColor = vec4(col, 1.0);
  }
`;

function Sky() {
  const material = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: skyVertex, fragmentShader: skyFragment, side: THREE.BackSide, depthWrite: false }),
    []
  );
  return (
    <mesh material={material}>
      <sphereGeometry args={[280, 32, 16]} />
    </mesh>
  );
}

export default function SwarmScene() {
  const lowPower = typeof window !== "undefined" && (window.innerWidth < 768 || navigator.hardwareConcurrency <= 4);
  return (
    <Canvas dpr={lowPower ? 1 : [1, 1.75]} camera={{ fov: FOV, near: 0.1, far: 700, position: [0, 9, 12] }} gl={{ antialias: false, powerPreference: "high-performance" }}>
      <color attach="background" args={["#03040b"]} />
      <Stars radius={120} depth={40} count={lowPower ? 1500 : 3000} factor={3} saturation={0} fade speed={0.6} />
      <Sky />
      {/* Ambient light at π cancels the Lambert 1/π, so the lake shows its mirror
          image at full strength while the water itself stays black. */}
      <ambientLight intensity={Math.PI} />
      <Water lowPower={lowPower} />
      <Markers />
      <LogoStage />
      <Swarm count={lowPower ? 260 : 420} />
      <CameraRig />
      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur luminanceThreshold={0.4} intensity={lowPower ? 0.9 : 1.2} radius={0.7} />
        {/* Slight lens fringing and sensor grain sell the "live camera feed" look. */}
        <ChromaticAberration offset={new THREE.Vector2(0.0007, 0.0005)} radialModulation modulationOffset={0.35} />
        <Noise premultiply blendFunction={BlendFunction.ADD} opacity={0.35} />
        <Vignette offset={0.25} darkness={0.8} />
      </EffectComposer>
    </Canvas>
  );
}
