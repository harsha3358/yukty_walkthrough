"use client";

import { Suspense, useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { LOGO_SETTLED_EVENT } from "@/lib/scrollState";

// Chamber 0 intro, staged like a drone light show:
//   1. A swarm of drones dives out of the sky and locks into a grid that draws the Y.
//   2. A light wave ripples up through the formation.
//   3. The gold logo is scanned in, bottom to top, behind the drones.
//   4. The drones peel away into a rotating halo around the logo,
//      and the page reveals "Welcome to Yukty AI".

const LOGO_URL = "/yukty-logo.jpg";
const LOGO_HEIGHT = 2.9;
const LOGO_ASPECT = 853 / 1280;
const GRID_COLS = 30;
const MAX_DRONES = 480;

const FLY_TIME = 1.9;
const FORMED = 3.8;
const FLASH_END = 4.4;
const REVEAL_END = 5.4;
const SETTLED = 5.1;
const HALO_START = 5.6;
const HALO_TIME = 1.6;

const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

const logoVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// The logo ships on black, so brightness becomes alpha. uReveal scans it in
// from the bottom with a cyan scan line; uSheen sweeps a highlight across it.
const logoFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uReveal;
  uniform float uSheen;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(uMap, vUv);
    float m = max(c.r, max(c.g, c.b));
    float shape = smoothstep(0.06, 0.24, m);
    float shown = 1.0 - smoothstep(uReveal - 0.04, uReveal, vUv.y);
    float scan = exp(-pow((vUv.y - uReveal) * 38.0, 2.0)) * step(uReveal, 1.02);
    float band = exp(-pow(vUv.x * 0.8 + vUv.y * 0.6 - uSheen, 2.0) * 120.0);
    vec3 col = c.rgb * 1.08 + vec3(1.0, 0.92, 0.7) * band * 1.4 + vec3(0.4, 0.95, 1.0) * scan * 2.5;
    float a = shape * max(shown, scan);
    gl_FragColor = vec4(col, a);
  }
`;

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
    float core = smoothstep(0.18, 0.0, d);
    float halo = smoothstep(0.5, 0.0, d) * 0.45;
    float a = core + halo;
    gl_FragColor = vec4(vColor * a, a);
  }
`;

// A regular grid of formation slots covering the gold part of the logo, the
// way a drone show pixelates an image. Coordinates are in the logo plane.
function formationSlots(image: HTMLImageElement) {
  const cols = GRID_COLS;
  const rows = Math.round(cols / LOGO_ASPECT);
  const canvas = document.createElement("canvas");
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, 0, 0, cols, rows);
  const data = ctx.getImageData(0, 0, cols, rows).data;
  const width = LOGO_HEIGHT * LOGO_ASPECT;
  const slots: { x: number; y: number; ny: number }[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const k = (y * cols + x) * 4;
      if (Math.max(data[k], data[k + 1], data[k + 2]) > 70) {
        slots.push({ x: ((x + 0.5) / cols - 0.5) * width, y: (0.5 - (y + 0.5) / rows) * LOGO_HEIGHT, ny: 1 - y / rows });
      }
    }
  }
  // Thin evenly if the logo is denser than the swarm.
  const step = Math.max(1, slots.length / MAX_DRONES);
  return slots.filter((_, i) => Math.floor(i % step) === 0).slice(0, MAX_DRONES);
}

function Reveal() {
  const texture = useLoader(THREE.TextureLoader, LOGO_URL);
  const bodies = useRef<THREE.InstancedMesh>(null);
  const logo = useRef<THREE.Group>(null);
  const start = useRef<number | null>(null);
  const announced = useRef(false);

  const skipIntro = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const logoMaterial = useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.ShaderMaterial({
      vertexShader: logoVertex,
      fragmentShader: logoFragment,
      uniforms: { uMap: { value: texture }, uReveal: { value: -0.1 }, uSheen: { value: -1 } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
  }, [texture]);

  const swarm = useMemo(() => {
    const slots = formationSlots(texture.image as HTMLImageElement);
    const count = slots.length;
    const drones = slots.map((slot, i) => ({
      target: new THREE.Vector3(slot.x, slot.y, 0.05),
      ny: slot.ny,
      // Launch points high in the sky, above and behind the formation.
      from: new THREE.Vector3(slot.x * 0.5 + (Math.random() - 0.5) * 12, 9 + Math.random() * 7, -3 - Math.random() * 7),
      // The top of the Y fills first, as if the swarm pours down from above.
      delay: 0.15 + (1 - slot.ny) * 0.7 + Math.random() * 1.0,
      swirl: (Math.random() - 0.5) * 3,
      haloAngle: (i / count) * Math.PI * 2 * 3,
      haloY: (Math.random() - 0.5) * 2.8,
      haloR: 1.7 + Math.random() * 0.5,
      gold: Math.random() < 0.35,
      phase: Math.random() * Math.PI * 2,
      pos: new THREE.Vector3(),
      prev: new THREE.Vector3(),
    }));
    drones.forEach((d) => {
      d.pos.copy(d.from);
      d.prev.copy(d.from);
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(new Float32Array(count), 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: lightVertex,
      fragmentShader: lightFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { drones, count, geometry, material };
  }, [texture]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const cyan = useMemo(() => new THREE.Color("#8ff3ff").multiplyScalar(2.4), []);
  const white = useMemo(() => new THREE.Color("#fff6dc").multiplyScalar(3.2), []);
  const gold = useMemo(() => new THREE.Color("#ffc247").multiplyScalar(2.6), []);
  const tmp = useMemo(() => new THREE.Color(), []);
  const halo = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    if (start.current === null) start.current = clock.elapsedTime - (skipIntro ? HALO_START + HALO_TIME + 1 : 0);
    const t = clock.elapsedTime - start.current;

    const pos = swarm.geometry.attributes.position as THREE.BufferAttribute;
    const col = swarm.geometry.attributes.color as THREE.BufferAttribute;
    const size = swarm.geometry.attributes.size as THREE.BufferAttribute;
    const h = easeInOut(THREE.MathUtils.clamp((t - HALO_START) / HALO_TIME, 0, 1));

    swarm.drones.forEach((d, i) => {
      d.prev.copy(d.pos);

      // Dive from the sky along an arc that swings toward the viewer.
      const k = THREE.MathUtils.clamp((t - d.delay) / FLY_TIME, 0, 1);
      const e = easeInOut(k);
      d.pos.lerpVectors(d.from, d.target, e);
      const arc = Math.sin(k * Math.PI);
      d.pos.x += arc * d.swirl;
      d.pos.z += arc * 2.2;

      // Hovering in formation: tiny station-keeping drift.
      if (k >= 1) {
        d.pos.x += Math.sin(t * 2.1 + d.phase) * 0.012;
        d.pos.y += Math.cos(t * 1.7 + d.phase) * 0.012;
      }

      // Peel off into a rotating halo around the logo.
      if (h > 0) {
        const a = d.haloAngle + (t - HALO_START) * 0.45;
        halo.set(Math.cos(a) * d.haloR, d.haloY + Math.sin(a * 2 + d.phase) * 0.15, Math.sin(a) * d.haloR * 0.7);
        d.pos.lerp(halo, h);
      }

      pos.setXYZ(i, d.pos.x, d.pos.y, d.pos.z);

      // Lights: cyan in flight, a white wave through the formation, then gold/cyan in the halo.
      let glow = 1;
      if (k < 1) tmp.copy(cyan);
      else {
        const wave = Math.exp(-Math.pow((t - FORMED) * 2.2 - d.ny, 2) * 40) * (t < FLASH_END + 0.5 ? 1 : 0);
        tmp.copy(gold).lerp(white, Math.min(1, wave + (t < FORMED ? 0 : 0.25)));
        glow = 1 + wave * 1.6;
        if (h > 0) tmp.lerp(d.gold ? gold : cyan, h);
      }
      const blink = h > 0 ? 0.7 + 0.3 * Math.sin(t * 5 + d.phase) : 1;
      col.setXYZ(i, tmp.r * blink, tmp.g * blink, tmp.b * blink);
      size.setX(i, (k < 1 ? 30 : 26) * glow * (h > 0 ? 0.75 : 1));

      // Drone bodies bank into their turns.
      dummy.position.copy(d.pos);
      const vx = d.pos.x - d.prev.x;
      dummy.rotation.set(0, d.phase, THREE.MathUtils.clamp(-vx * 18, -0.6, 0.6));
      dummy.updateMatrix();
      bodies.current?.setMatrixAt(i, dummy.matrix);
    });
    pos.needsUpdate = true;
    col.needsUpdate = true;
    size.needsUpdate = true;
    if (bodies.current) bodies.current.instanceMatrix.needsUpdate = true;

    // Scan the logo in once the light wave has passed, then let it breathe.
    logoMaterial.uniforms.uReveal.value = THREE.MathUtils.mapLinear(THREE.MathUtils.clamp(t, FLASH_END, REVEAL_END), FLASH_END, REVEAL_END, -0.05, 1.08);
    const since = t - REVEAL_END;
    logoMaterial.uniforms.uSheen.value = since < 0 ? -1 : -0.4 + ((since % 6) / 1.1) * 2.2;
    if (logo.current && since > 0) {
      logo.current.position.y = Math.sin(since * 1.2) * 0.06;
      logo.current.rotation.y = Math.sin(since * 0.6) * 0.12;
    }

    if (!announced.current && t >= SETTLED) {
      announced.current = true;
      window.dispatchEvent(new Event(LOGO_SETTLED_EVENT));
    }
  });

  return (
    <group>
      <group ref={logo}>
        <mesh material={logoMaterial}>
          <planeGeometry args={[LOGO_HEIGHT * LOGO_ASPECT, LOGO_HEIGHT]} />
        </mesh>
      </group>
      <instancedMesh ref={bodies} args={[undefined, undefined, swarm.count]} frustumCulled={false}>
        <boxGeometry args={[0.07, 0.016, 0.07]} />
        <meshBasicMaterial color="#2a3150" />
      </instancedMesh>
      <points geometry={swarm.geometry} material={swarm.material} frustumCulled={false} />
    </group>
  );
}

export default function LogoReveal() {
  return (
    <Suspense fallback={null}>
      <Reveal />
    </Suspense>
  );
}
