"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { scrollState } from "@/lib/scrollState";
import { Drone, formations, Tint } from "./formations";

// The mission swarm: every drone springs toward its slot in the active
// mission's formation. Each drone has its own responsiveness, so a mission
// change ripples through the swarm instead of snapping.
//
// VFX: each drone is a bright light with a comet trail that stretches with
// speed, and neighbouring drones are joined by a faint "swarm mesh" — the
// communication links that make it a swarm rather than a crowd.

const TRAIL = 5; // light samples per drone: the head plus a fading tail
const TRAIL_SPACING = 0.045; // seconds of motion between tail samples
const LINK_RANGE = 1.5; // drones closer than this are drawn as linked

const lightVertex = /* glsl */ `
  attribute vec3 color;
  attribute float size;
  varying vec3 vColor;
  void main() {
    vColor = color;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const lightFragment = /* glsl */ `
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = (exp(-d * d * 90.0) + exp(-d * d * 14.0) * 0.35) * smoothstep(0.5, 0.42, d);
    gl_FragColor = vec4(vColor * a, a);
  }
`;

const TINTS: Record<Tint, THREE.Color> = {
  cyan: new THREE.Color("#8ff3ff").multiplyScalar(2.3),
  gold: new THREE.Color("#ffc247").multiplyScalar(2.5),
  fire: new THREE.Color("#ff6a3d").multiplyScalar(2.6),
};
const ACCENT = new THREE.Color("#fff6dc").multiplyScalar(2.6);

type SwarmDrone = Drone & {
  pos: THREE.Vector3;
  prev: THREE.Vector3;
  target: THREE.Vector3;
  vel: THREE.Vector3;
  agility: number;
  color: THREE.Color;
};

export default function Swarm({ count }: { count: number }) {
  const bodies = useRef<THREE.InstancedMesh>(null);

  const swarm = useMemo(() => {
    const rand = Math.random;
    const drones: SwarmDrone[] = Array.from({ length: count }, () => ({
      r1: rand(),
      r2: rand(),
      r3: rand(),
      pos: new THREE.Vector3((rand() - 0.5) * 46, 0.7, -30),
      prev: new THREE.Vector3(),
      target: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      agility: 1.4 + rand() * 1.8,
      color: TINTS.cyan.clone(),
    }));

    const lights = new THREE.BufferGeometry();
    lights.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * TRAIL * 3), 3));
    lights.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * TRAIL * 3), 3));
    lights.setAttribute("size", new THREE.BufferAttribute(new Float32Array(count * TRAIL), 1));
    const lightMaterial = new THREE.ShaderMaterial({
      vertexShader: lightVertex,
      fragmentShader: lightFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const links = new THREE.BufferGeometry();
    links.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 6), 3));
    links.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * 6), 3));
    const linkLines = new THREE.LineSegments(
      links,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
    );
    linkLines.frustumCulled = false;

    return { drones, lights, lightMaterial, links, linkLines };
  }, [count]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const want = useMemo(() => new THREE.Color(), []);
  const step = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.elapsedTime;
    const mission = THREE.MathUtils.clamp(Math.round(scrollState.chapter), 0, formations.length - 1);
    const { shape, tint } = formations[mission];
    const pos = swarm.lights.attributes.position as THREE.BufferAttribute;
    const col = swarm.lights.attributes.color as THREE.BufferAttribute;
    const size = swarm.lights.attributes.size as THREE.BufferAttribute;
    const linkPos = swarm.links.attributes.position as THREE.BufferAttribute;
    const linkCol = swarm.links.attributes.color as THREE.BufferAttribute;

    swarm.drones.forEach((d, i) => {
      shape(i, count, t, d, d.target);
      d.prev.copy(d.pos);
      d.pos.lerp(d.target, 1 - Math.exp(-dt * d.agility));
      step.subVectors(d.pos, d.prev).divideScalar(Math.max(dt, 1e-3));
      d.vel.lerp(step, 1 - Math.exp(-dt * 10));
      const speed = d.vel.length();

      want.copy(i % 11 === 0 ? ACCENT : TINTS[tint]);
      d.color.lerp(want, 1 - Math.exp(-dt * 3));
      const blink = 0.8 + 0.2 * Math.sin(t * 5 + d.r1 * 30);
      const boost = 1 + Math.min(speed * 0.05, 0.8);

      // Head light, then a tail that trails back along the velocity.
      for (let k = 0; k < TRAIL; k++) {
        const j = i * TRAIL + k;
        const back = k * TRAIL_SPACING;
        pos.setXYZ(j, d.pos.x - d.vel.x * back, d.pos.y - d.vel.y * back, d.pos.z - d.vel.z * back);
        const fade = k === 0 ? 1 : (1 - k / TRAIL) * 0.55 * Math.min(speed * 0.25, 1);
        col.setXYZ(j, d.color.r * blink * boost * fade, d.color.g * blink * boost * fade, d.color.b * blink * boost * fade);
        size.setX(j, k === 0 ? 150 : 110 * (1 - k / TRAIL));
      }

      // Swarm mesh: link each drone to its formation neighbour when they fly close.
      const n = swarm.drones[(i + 1) % count].pos;
      const dist = d.pos.distanceTo(n);
      const link = dist < LINK_RANGE ? (1 - dist / LINK_RANGE) * 0.5 : 0;
      linkPos.setXYZ(i * 2, d.pos.x, d.pos.y, d.pos.z);
      linkPos.setXYZ(i * 2 + 1, n.x, n.y, n.z);
      linkCol.setXYZ(i * 2, d.color.r * link, d.color.g * link, d.color.b * link);
      linkCol.setXYZ(i * 2 + 1, d.color.r * link, d.color.g * link, d.color.b * link);

      dummy.position.copy(d.pos);
      dummy.rotation.set(0, d.r2 * 6.28, THREE.MathUtils.clamp(-d.vel.x * 0.25, -0.6, 0.6));
      dummy.updateMatrix();
      bodies.current?.setMatrixAt(i, dummy.matrix);
    });
    pos.needsUpdate = true;
    col.needsUpdate = true;
    size.needsUpdate = true;
    linkPos.needsUpdate = true;
    linkCol.needsUpdate = true;
    if (bodies.current) bodies.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={bodies} args={[undefined, undefined, count]} frustumCulled={false}>
        <boxGeometry args={[0.12, 0.025, 0.12]} />
        <meshBasicMaterial color="#2a3150" />
      </instancedMesh>
      <primitive object={swarm.linkLines} />
      <points geometry={swarm.lights} material={swarm.lightMaterial} frustumCulled={false} />
    </group>
  );
}
