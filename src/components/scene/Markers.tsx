"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { scrollState } from "@/lib/scrollState";
import { ACO_BEST, ACO_DROP, ACO_HUB, BLOCK, BRIDGE_ENDS, hotspot } from "./layout";

// Mission markers that fade in only while their mission is on screen:
// tower beacons for the bridge, hub/drop beacons and the pheromone trail for
// ACO, and the drifting wildfire hotspot for PSO.

const beamVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const beamFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    float fade = pow(1.0 - vUv.y, 1.6);
    float flow = 0.75 + 0.25 * sin(vUv.y * 30.0 - uTime * 6.0);
    float a = fade * flow * uOpacity;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

function weight(mission: number) {
  return THREE.MathUtils.clamp(1 - Math.abs(scrollState.chapter - mission) * 1.4, 0, 1);
}

function useBeam(color: string) {
  return useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: beamVertex,
        fragmentShader: beamFragment,
        uniforms: { uColor: { value: new THREE.Color(color).multiplyScalar(2.2) }, uOpacity: { value: 0 }, uTime: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [color]
  );
}

function Beacon({ position, material, ring }: { position: THREE.Vector3; material: THREE.ShaderMaterial; ring: THREE.MeshBasicMaterial }) {
  const ringMesh = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ringMesh.current) ringMesh.current.scale.setScalar(1 + ((clock.elapsedTime * 0.8) % 1) * 1.6);
  });
  return (
    <group position={position}>
      <mesh material={material} position={[0, 7, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 14, 16, 1, true]} />
      </mesh>
      <mesh ref={ringMesh} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} material={ring}>
        <ringGeometry args={[0.55, 0.68, 48]} />
      </mesh>
    </group>
  );
}

const ringMaterial = (color: string) =>
  new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.2), transparent: true, opacity: 0, depthWrite: false, toneMapped: false });

export default function Markers() {
  const cyanBeam = useBeam("#5fe7ff");
  const goldBeam = useBeam("#ffc247");
  const fireBeam = useBeam("#ff6a3d");
  const rings = useMemo(() => ({ cyan: ringMaterial("#5fe7ff"), gold: ringMaterial("#ffc247"), fire: ringMaterial("#ff6a3d") }), []);

  const hub = useMemo(() => new THREE.Vector3(ACO_HUB[0] * BLOCK, 0, ACO_HUB[1] * BLOCK), []);
  const drop = useMemo(() => new THREE.Vector3(ACO_DROP[0] * BLOCK, 0, ACO_DROP[1] * BLOCK), []);

  const trail = useMemo(() => {
    const path = new THREE.CurvePath<THREE.Vector3>();
    const ground = ACO_BEST.map((p) => new THREE.Vector3(p.x, 0.05, p.z));
    for (let i = 1; i < ground.length; i++) path.add(new THREE.LineCurve3(ground[i - 1], ground[i]));
    const geometry = new THREE.TubeGeometry(path, 200, 0.09, 6, false);
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffc247").multiplyScalar(2.4), transparent: true, opacity: 0, toneMapped: false, depthWrite: false });
    return { geometry, material };
  }, []);

  const fire = useRef<THREE.Group>(null);
  const firePos = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const bridge = weight(1);
    const aco = weight(4);
    const pso = weight(5);
    for (const m of [cyanBeam, goldBeam, fireBeam]) m.uniforms.uTime.value = t;
    cyanBeam.uniforms.uOpacity.value = Math.max(bridge, aco) * 0.9;
    goldBeam.uniforms.uOpacity.value = aco * 0.9;
    fireBeam.uniforms.uOpacity.value = pso;
    rings.cyan.opacity = Math.max(bridge, aco) * 0.8;
    rings.gold.opacity = aco * 0.8;
    rings.fire.opacity = pso * 0.9;
    trail.material.opacity = aco * (0.7 + 0.3 * Math.sin(t * 4));
    if (fire.current) fire.current.position.copy(hotspot(t, firePos));
  });

  return (
    <group>
      {BRIDGE_ENDS.map((p, i) => (
        <Beacon key={i} position={p} material={cyanBeam} ring={rings.cyan} />
      ))}
      <Beacon position={hub} material={cyanBeam} ring={rings.cyan} />
      <Beacon position={drop} material={goldBeam} ring={rings.gold} />
      <mesh geometry={trail.geometry} material={trail.material} />
      <group ref={fire}>
        <Beacon position={new THREE.Vector3()} material={fireBeam} ring={rings.fire} />
      </group>
    </group>
  );
}
