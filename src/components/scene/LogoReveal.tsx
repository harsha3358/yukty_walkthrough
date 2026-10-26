"use client";

import { Suspense, useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { LOGO_SETTLED_EVENT } from "@/lib/scrollState";

// Chamber 0 intro: the gold Yukty "Y" swoops in from above and behind the viewer
// while a cloud of sparks converges onto its silhouette. On landing a shockwave
// ring fires, the sparks burst into orbit and the page reveals "Welcome to Yukty AI".

const LOGO_URL = "/yukty-logo.jpg";
const LOGO_HEIGHT = 2.9;
const LOGO_ASPECT = 853 / 1280;
const ARRIVE = 2.4; // seconds until the logo lands
const SPARKS = 1100;

const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3);
const easeOutBack = (k: number) => 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);

const logoVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// The logo ships on black, so brightness becomes alpha. A diagonal sheen sweeps across it.
const logoFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uOpacity;
  uniform float uSheen;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(uMap, vUv);
    float m = max(c.r, max(c.g, c.b));
    float a = smoothstep(0.06, 0.24, m) * uOpacity;
    float band = exp(-pow(vUv.x * 0.8 + vUv.y * 0.6 - uSheen, 2.0) * 120.0);
    vec3 col = c.rgb * 1.08 + vec3(1.0, 0.92, 0.7) * band * 1.4;
    gl_FragColor = vec4(col, a);
  }
`;

const sparkVertex = /* glsl */ `
  attribute vec3 aStart;
  attribute vec3 aTarget;
  attribute float aDelay;
  attribute float aRand;
  uniform float uT;
  uniform float uArrive;
  varying float vAlpha;
  void main() {
    float k = clamp((uT - aDelay) / (uArrive - aDelay), 0.0, 1.0);
    float e = 1.0 - pow(1.0 - k, 3.0);
    // Swirl in on the way so the sparks spiral rather than fly straight.
    float swirl = (1.0 - e) * 2.4;
    vec3 from = aStart;
    from.xz = mat2(cos(swirl), -sin(swirl), sin(swirl), cos(swirl)) * from.xz;
    vec3 p = mix(from, aTarget, e);

    float b = max(uT - uArrive, 0.0);
    vec3 dir = normalize(aTarget + vec3(0.0, 0.0, 0.4) + 0.001);
    p += dir * (1.0 - exp(-b * 1.8)) * (0.6 + aRand * 1.6);
    p.y += sin(uT * 1.5 + aRand * 20.0) * 0.04 * step(0.0, b);

    vAlpha = mix(1.0, 0.28, smoothstep(0.0, 1.6, b)) * (0.6 + 0.4 * sin(uT * 6.0 + aRand * 40.0)) * step(aDelay, uT);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (18.0 + aRand * 18.0) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const sparkFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vAlpha;
    gl_FragColor = vec4(vec3(1.0, 0.78, 0.36) * 2.2 * a, a);
  }
`;

// Points on the bright (gold) pixels of the logo, in the logo plane's local units.
function silhouettePoints(image: HTMLImageElement, count: number) {
  const w = 64;
  const h = Math.round(w / LOGO_ASPECT);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const bright: [number, number][] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4;
      if (Math.max(data[k], data[k + 1], data[k + 2]) > 90) bright.push([x, y]);
    }
  }
  const width = LOGO_HEIGHT * LOGO_ASPECT;
  return Array.from({ length: count }, () => {
    const [x, y] = bright[Math.floor(Math.random() * bright.length)] ?? [w / 2, h / 2];
    return new THREE.Vector3(((x + Math.random()) / w - 0.5) * width, (0.5 - (y + Math.random()) / h) * LOGO_HEIGHT, 0.02);
  });
}

function Reveal() {
  const texture = useLoader(THREE.TextureLoader, LOGO_URL);
  const logo = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const start = useRef<number | null>(null);
  const announced = useRef(false);

  const skipIntro = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const logoMaterial = useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.ShaderMaterial({
      vertexShader: logoVertex,
      fragmentShader: logoFragment,
      uniforms: { uMap: { value: texture }, uOpacity: { value: 0 }, uSheen: { value: -1 } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
  }, [texture]);

  const sparks = useMemo(() => {
    const targets = silhouettePoints(texture.image as HTMLImageElement, SPARKS);
    const start = new Float32Array(SPARKS * 3);
    const target = new Float32Array(SPARKS * 3);
    const delay = new Float32Array(SPARKS);
    const rand = new Float32Array(SPARKS);
    targets.forEach((t, i) => {
      // Sparks gather from a wide cloud above and behind the viewer.
      start.set([(Math.random() - 0.5) * 14, 2 + Math.random() * 7, 2 + Math.random() * 10], i * 3);
      target.set([t.x, t.y, t.z], i * 3);
      delay[i] = Math.random() * 0.9;
      rand[i] = Math.random();
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3));
    geometry.setAttribute("aStart", new THREE.BufferAttribute(start, 3));
    geometry.setAttribute("aTarget", new THREE.BufferAttribute(target, 3));
    geometry.setAttribute("aDelay", new THREE.BufferAttribute(delay, 1));
    geometry.setAttribute("aRand", new THREE.BufferAttribute(rand, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: sparkVertex,
      fragmentShader: sparkFragment,
      uniforms: { uT: { value: 0 }, uArrive: { value: ARRIVE } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry, material };
  }, [texture]);

  useFrame(({ clock }) => {
    if (start.current === null) start.current = clock.elapsedTime - (skipIntro ? ARRIVE + 3 : 0);
    const t = clock.elapsedTime - start.current;
    sparks.material.uniforms.uT.value = t;

    const g = logo.current;
    if (g) {
      // Swoop: from above and behind the camera, spinning, down onto its mark.
      const k = Math.min(Math.max((t - 0.2) / (ARRIVE - 0.2), 0), 1);
      const e = easeOutCubic(k);
      g.position.set(Math.sin((1 - e) * 2.2) * 2.2, THREE.MathUtils.lerp(5.5, 0, e), THREE.MathUtils.lerp(10, 0, e));
      g.rotation.set((1 - e) * -0.9, (1 - e) * Math.PI * 3, (1 - e) * 0.4);
      g.scale.setScalar(THREE.MathUtils.lerp(0.35, 1, easeOutBack(k)));
      if (k >= 1) {
        // Settled: breathe gently.
        g.position.y = Math.sin((t - ARRIVE) * 1.2) * 0.06;
        g.rotation.y = Math.sin((t - ARRIVE) * 0.6) * 0.12;
      }
      logoMaterial.uniforms.uOpacity.value = THREE.MathUtils.smoothstep(t, 0.2, 0.9);
      // Sheen sweeps once on landing, then every 6 seconds.
      const since = t - ARRIVE;
      logoMaterial.uniforms.uSheen.value = since < 0 ? -1 : -0.4 + ((since % 6) / 1.1) * 2.2;
    }

    const r = ring.current;
    if (r) {
      const s = Math.max(t - ARRIVE + 0.05, 0);
      r.scale.setScalar(0.6 + s * 4.5);
      (r.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - s * 1.1);
      r.visible = s > 0 && s < 1;
    }

    if (!announced.current && t >= ARRIVE) {
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
      <points geometry={sparks.geometry} material={sparks.material} frustumCulled={false} />
      <mesh ref={ring} visible={false}>
        <ringGeometry args={[0.95, 1, 96]} />
        <meshBasicMaterial color={new THREE.Color("#ffd27a").multiplyScalar(3)} transparent toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
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
