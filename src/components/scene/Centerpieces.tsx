"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import LogoReveal from "./LogoReveal";

// One glowing object per chamber. Each sits in a local frame whose -z faces
// the approaching camera, so +x reads as "screen right" and +y as "up".

const AMBER = new THREE.Color("#ffb347");
const TEAL = new THREE.Color("#3ef0d0");
const HOT = new THREE.Color("#ffe2a8");

function glow(color: THREE.Color, k = 2.2) {
  return color.clone().multiplyScalar(k);
}

function seeded(n: number, seed = 1) {
  let s = seed;
  return Array.from({ length: n }, () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  });
}

function Spin({ speed = 0.3, children }: { speed?: number; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * speed;
  });
  return <group ref={ref}>{children}</group>;
}

function OrbitDust({ count = 400, radius = 1.6, color = AMBER, size = 0.04 }) {
  const ref = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const r = seeded(count * 3, 7);
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = r[i * 3] * Math.PI * 2;
      const rad = radius * (0.8 + r[i * 3 + 1] * 0.5);
      pos[i * 3] = Math.cos(a) * rad;
      pos[i * 3 + 1] = (r[i * 3 + 2] - 0.5) * 0.4;
      pos[i * 3 + 2] = Math.sin(a) * rad;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, [count, radius]);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.4;
  });
  return (
    <points ref={ref} geometry={geometry} rotation={[0.45, 0, 0.2]}>
      <pointsMaterial color={glow(color)} size={size} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  );
}

// 1 · Who we are: industry and campus joined by a stream of ants.
function Bridge() {
  const ref = useRef<THREE.Points>(null);
  const count = 260;
  const { geometry, phase } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    return { geometry: g, phase: seeded(count, 3) };
  }, []);
  useFrame(({ clock }) => {
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const t = clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      const f = (phase[i] + t * 0.18) % 1;
      const dir = i % 2 ? f : 1 - f;
      const x = -1.5 + dir * 3;
      pos.setXYZ(i, x, Math.sin(dir * Math.PI) * 0.9 + (phase[i] - 0.5) * 0.15, (phase[(i + 7) % count] - 0.5) * 0.3);
    }
    pos.needsUpdate = true;
  });
  return (
    <group>
      <mesh position={[-1.5, 0, 0]}>
        <octahedronGeometry args={[0.45]} />
        <meshBasicMaterial color={glow(AMBER)} wireframe toneMapped={false} />
      </mesh>
      <mesh position={[1.5, 0, 0]}>
        <dodecahedronGeometry args={[0.45]} />
        <meshBasicMaterial color={glow(TEAL)} wireframe toneMapped={false} />
      </mesh>
      <points ref={ref} geometry={geometry}>
        <pointsMaterial color={glow(HOT, 1.8)} size={0.05} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </points>
    </group>
  );
}

// 2 · Three pillars orbiting together.
function Pillars() {
  const colors = [AMBER, TEAL, HOT];
  return (
    <Spin speed={0.35}>
      {colors.map((c, i) => {
        const a = (i / 3) * Math.PI * 2;
        return (
          <group key={i} position={[Math.cos(a) * 1.25, 0, Math.sin(a) * 1.25]}>
            <Spin speed={1.2}>
              <mesh>
                <cylinderGeometry args={[0.18, 0.3, 1.6, 6]} />
                <meshBasicMaterial color={glow(c, 1.8)} wireframe toneMapped={false} />
              </mesh>
            </Spin>
          </group>
        );
      })}
      <OrbitDust count={300} radius={1.25} color={TEAL} size={0.03} />
    </Spin>
  );
}

// 3 · A murmuration: every particle follows a shared flow, the swarm emerges.
const swarmVertex = /* glsl */ `
  attribute vec3 seed;
  uniform float uTime;
  void main() {
    float t = uTime * 0.35 + seed.x * 6.2831;
    vec3 p;
    p.x = sin(t * 1.3 + seed.y * 3.0) * 1.6 + sin(t * 0.4) * 0.5;
    p.y = sin(t * 1.7 + seed.z * 2.0) * 0.8 * cos(t * 0.3);
    p.z = cos(t * 1.1 + seed.y * 2.5) * 1.2;
    p += (seed - 0.5) * 0.35;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = 34.0 / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
const dotFragment = /* glsl */ `
  uniform vec3 uColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(uColor * a, a);
  }
`;
function Murmuration() {
  const count = 1400;
  const { geometry, material } = useMemo(() => {
    const r = seeded(count * 3, 11);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute("seed", new THREE.BufferAttribute(new Float32Array(r), 3));
    const m = new THREE.ShaderMaterial({
      vertexShader: swarmVertex,
      fragmentShader: dotFragment,
      uniforms: { uTime: { value: 0 }, uColor: { value: glow(HOT, 1.6) } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry: g, material: m };
  }, []);
  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
  });
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

// 4 · ACO: a graph whose best path glows like a pheromone trail.
function AntGraph() {
  const { nodes, edges, best } = useMemo(() => {
    const r = seeded(40, 23);
    const nodes = Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2 + r[i] * 0.5;
      const rad = 0.5 + r[i + 12] * 1.3;
      return new THREE.Vector3(Math.cos(a) * rad, Math.sin(a) * rad * 0.75, (r[i + 24] - 0.5) * 0.6);
    });
    const edges: [number, number][] = [];
    nodes.forEach((n, i) => {
      nodes
        .map((m, j) => ({ j, d: n.distanceTo(m) }))
        .filter((e) => e.j > i)
        .sort((a, b) => a.d - b.d)
        .slice(0, 3)
        .forEach((e) => edges.push([i, e.j]));
    });
    return { nodes, edges, best: [0, 1, 2, 3] };
  }, []);
  const lineGeo = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints(edges.flatMap(([a, b]) => [nodes[a], nodes[b]]));
    return g;
  }, [edges, nodes]);
  const bestGeo = useMemo(() => new THREE.BufferGeometry().setFromPoints(best.map((i) => nodes[i])), [best, nodes]);
  const bestLine = useMemo(
    () => new THREE.Line(bestGeo, new THREE.LineBasicMaterial({ color: glow(AMBER, 3), transparent: true, toneMapped: false })),
    [bestGeo]
  );
  useFrame(({ clock }) => {
    (bestLine.material as THREE.LineBasicMaterial).opacity = 0.6 + Math.sin(clock.elapsedTime * 3) * 0.4;
  });
  return (
    <Spin speed={0.15}>
      <lineSegments geometry={lineGeo}>
        <lineBasicMaterial color={glow(TEAL, 0.9)} transparent opacity={0.45} toneMapped={false} />
      </lineSegments>
      <primitive object={bestLine} />
      {nodes.map((n, i) => (
        <mesh key={i} position={n}>
          <sphereGeometry args={[i === 0 || i === 3 ? 0.12 : 0.06, 16, 16]} />
          <meshBasicMaterial color={glow(i === 0 || i === 3 ? AMBER : HOT, 2)} toneMapped={false} />
        </mesh>
      ))}
    </Spin>
  );
}

// 5 · PSO: particles sliding down a landscape to its deepest valley.
function Landscape() {
  const count = 160;
  const height = (x: number, z: number) =>
    -0.7 * Math.exp(-((x - 0.5) ** 2 + (z + 0.3) ** 2) * 1.4) + 0.18 * Math.sin(x * 3) * Math.cos(z * 3);
  const plane = useMemo(() => {
    const g = new THREE.PlaneGeometry(3.6, 3.6, 40, 40);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setY(i, height(p.getX(i), p.getZ(i)));
    return g;
  }, []);
  const { geometry, start } = useMemo(() => {
    const r = seeded(count * 2, 5);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    return { geometry: g, start: r.map((v) => (v - 0.5) * 3.4) };
  }, []);
  useFrame(({ clock }) => {
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const cycle = (clock.elapsedTime * 0.18) % 1;
    const k = THREE.MathUtils.smoothstep(cycle, 0.05, 0.75);
    for (let i = 0; i < count; i++) {
      const x = THREE.MathUtils.lerp(start[i * 2], 0.5, k * (0.85 + (i % 7) * 0.02));
      const z = THREE.MathUtils.lerp(start[i * 2 + 1], -0.3, k * (0.85 + (i % 5) * 0.03));
      pos.setXYZ(i, x, height(x, z) + 0.06, z);
    }
    pos.needsUpdate = true;
  });
  return (
    <group rotation={[0.45, 0, 0]} scale={0.85}>
      <Spin speed={0.12}>
        <mesh geometry={plane}>
          <meshBasicMaterial color={glow(TEAL, 0.7)} wireframe toneMapped={false} />
        </mesh>
        <points geometry={geometry}>
          <pointsMaterial color={glow(AMBER, 3)} size={0.07} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </points>
      </Spin>
    </group>
  );
}

// 6 · Applications: a drone fleet morphing between grid, ring and wave.
function DroneFleet() {
  const count = 36;
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    const phase = (t * 0.2) % 3;
    const stage = Math.floor(phase);
    const k = THREE.MathUtils.smoothstep(phase - stage, 0.2, 0.8);
    for (let i = 0; i < count; i++) {
      const shapes = [
        new THREE.Vector3((i % 6) * 0.5 - 1.25, Math.floor(i / 6) * 0.4 - 1, 0),
        new THREE.Vector3(Math.cos((i / count) * Math.PI * 2) * 1.4, Math.sin((i / count) * Math.PI * 2) * 1.1, 0),
        new THREE.Vector3((i / count) * 3 - 1.5, Math.sin(i * 0.6 + t * 2) * 0.5, Math.cos(i * 0.4) * 0.4),
      ];
      dummy.position.lerpVectors(shapes[stage], shapes[(stage + 1) % 3], k);
      dummy.rotation.set(0, t * 2 + i, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <boxGeometry args={[0.16, 0.04, 0.16]} />
      <meshBasicMaterial color={glow(HOT, 2.4)} toneMapped={false} />
    </instancedMesh>
  );
}

// 7 · Workshop: the session timeline as a rising helix.
function Helix() {
  const steps = 5;
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        Array.from({ length: 40 }, (_, i) => {
          const a = (i / 39) * Math.PI * 3;
          return new THREE.Vector3(Math.cos(a) * 1.1, (i / 39) * 2.6 - 1.3, Math.sin(a) * 1.1);
        })
      ),
    []
  );
  return (
    <Spin speed={0.3}>
      <mesh>
        <tubeGeometry args={[curve, 120, 0.02, 8, false]} />
        <meshBasicMaterial color={glow(TEAL, 1.5)} toneMapped={false} />
      </mesh>
      {Array.from({ length: steps }, (_, i) => (
        <mesh key={i} position={curve.getPointAt(i / (steps - 1))}>
          <sphereGeometry args={[0.13, 20, 20]} />
          <meshBasicMaterial color={glow(AMBER, 2.4)} toneMapped={false} />
        </mesh>
      ))}
    </Spin>
  );
}

// 8 · Internship: a glowing zero for "zero fee".
function Zero() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.6) * 0.6;
  });
  return (
    <group ref={ref}>
      <mesh scale={[0.78, 1.1, 1]}>
        <torusGeometry args={[1, 0.11, 24, 96]} />
        <meshBasicMaterial color={glow(AMBER, 2.4)} toneMapped={false} />
      </mesh>
      <OrbitDust count={500} radius={1.7} color={TEAL} size={0.035} />
    </group>
  );
}

// 9 · Careers: a twinkling constellation.
function Constellation() {
  const stars = useMemo(() => {
    const r = seeded(18, 41);
    return Array.from({ length: 6 }, (_, i) => new THREE.Vector3((r[i] - 0.5) * 3, (r[i + 6] - 0.5) * 2.2, (r[i + 12] - 0.5) * 0.8));
  }, []);
  const line = useMemo(
    () =>
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([...stars, stars[0]]),
        new THREE.LineBasicMaterial({ color: glow(TEAL, 1.2), transparent: true, opacity: 0.6, toneMapped: false })
      ),
    [stars]
  );
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    group.current?.children.forEach((c, i) => {
      if (c instanceof THREE.Mesh) c.scale.setScalar(0.8 + Math.sin(clock.elapsedTime * 2 + i * 1.7) * 0.3);
    });
  });
  return (
    <group ref={group}>
      <primitive object={line} />
      {stars.map((s, i) => (
        <mesh key={i} position={s}>
          <octahedronGeometry args={[0.11]} />
          <meshBasicMaterial color={glow(HOT, 3)} toneMapped={false} />
        </mesh>
      ))}
      <OrbitDust count={300} radius={2} color={HOT} size={0.02} />
    </group>
  );
}

// 10 · The ask: a portal back to the surface.
function Portal() {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ring.current) ring.current.rotation.z = clock.elapsedTime * 0.4;
  });
  return (
    <group>
      <mesh ref={ring}>
        <torusGeometry args={[1.5, 0.05, 16, 120]} />
        <meshBasicMaterial color={glow(AMBER, 3)} toneMapped={false} />
      </mesh>
      <mesh>
        <circleGeometry args={[1.42, 64]} />
        <meshBasicMaterial color={glow(HOT, 0.6)} transparent opacity={0.35} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <OrbitDust count={700} radius={1.9} color={TEAL} size={0.03} />
    </group>
  );
}

export const centerpieces = [LogoReveal, Bridge, Pillars, Murmuration, AntGraph, Landscape, DroneFleet, Helix, Zero, Constellation, Portal];
