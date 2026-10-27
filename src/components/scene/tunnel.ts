import * as THREE from "three";

// Builds the winding colony tunnel: a curve through one chamber per chapter,
// a tube whose radius swells into a round chamber at each stop, and lookup
// tables that let ants and the camera move along it cheaply.

export const SEGMENTS = 900;
const RADIAL = 56;
const BASE_RADIUS = 1.7;
const CHAMBER_RADIUS = 5.2;
const CHAMBER_WIDTH = 5.5;

export type Tunnel = {
  curve: THREE.CatmullRomCurve3;
  length: number;
  chamberU: number[];
  radiusAt: (u: number) => number;
  points: THREE.Vector3[];
  normals: THREE.Vector3[];
  binormals: THREE.Vector3[];
  tangents: THREE.Vector3[];
  geometry: THREE.BufferGeometry;
};

export function buildTunnel(chamberCount: number): Tunnel {
  const spacing = 20;
  const control: THREE.Vector3[] = [new THREE.Vector3(0, 2, 14)];
  for (let i = 0; i < chamberCount; i++) {
    const last = i === chamberCount - 1;
    // Descend into the colony, then climb back to the surface for the final ask.
    const depth = last ? -10 : -i * 3.2;
    control.push(new THREE.Vector3(Math.sin(i * 1.1) * 9, depth, -i * spacing));
  }
  control.push(new THREE.Vector3(0, 6, -(chamberCount - 1) * spacing - 16));

  const curve = new THREE.CatmullRomCurve3(control, false, "centripetal");
  const length = curve.getLength();

  // Arc-length position (0..1) of each chamber = closest sample to its control point.
  const samples = curve.getSpacedPoints(4000);
  const chamberU = control.slice(1, -1).map((p) => {
    let best = 0;
    let bestD = Infinity;
    samples.forEach((s, idx) => {
      const d = s.distanceToSquared(p);
      if (d < bestD) {
        bestD = d;
        best = idx;
      }
    });
    return best / 4000;
  });

  const radiusAt = (u: number) => {
    let bulge = 0;
    for (const c of chamberU) {
      const d = ((u - c) * length) / CHAMBER_WIDTH;
      bulge = Math.max(bulge, Math.exp(-d * d));
    }
    return BASE_RADIUS + CHAMBER_RADIUS * bulge;
  };

  const frames = curve.computeFrenetFrames(SEGMENTS, false);
  const points: THREE.Vector3[] = [];
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const v = new THREE.Vector3();

  for (let i = 0; i <= SEGMENTS; i++) {
    const u = i / SEGMENTS;
    const p = curve.getPointAt(u);
    points.push(p);
    const r = radiusAt(u);
    const n = frames.normals[i];
    const b = frames.binormals[i];
    for (let j = 0; j <= RADIAL; j++) {
      const a = (j / RADIAL) * Math.PI * 2;
      v.copy(p)
        .addScaledVector(n, Math.cos(a) * r)
        .addScaledVector(b, Math.sin(a) * r);
      positions.push(v.x, v.y, v.z);
      uvs.push(u, j / RADIAL);
    }
  }
  for (let i = 0; i < SEGMENTS; i++) {
    for (let j = 0; j < RADIAL; j++) {
      const a = i * (RADIAL + 1) + j;
      const b = a + RADIAL + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);

  return {
    curve,
    length,
    chamberU,
    radiusAt,
    points,
    normals: frames.normals,
    binormals: frames.binormals,
    tangents: frames.tangents,
    geometry,
  };
}

// Maps a continuous chapter index onto arc-length along the tunnel.
export function chapterToU(tunnel: Tunnel, chapter: number) {
  const c = tunnel.chamberU;
  const i = Math.min(Math.max(Math.floor(chapter), 0), c.length - 1);
  const next = Math.min(i + 1, c.length - 1);
  const f = Math.min(Math.max(chapter - i, 0), 1);
  return c[i] + (c[next] - c[i]) * f;
}

export const wallVertex = /* glsl */ `
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

export const wallFragment = /* glsl */ `
  uniform float uTime;
  uniform float uLength;
  uniform vec3 uEarth;
  uniform vec3 uAmber;
  uniform vec3 uTeal;
  varying vec2 vUv;
  varying float vDepth;

  void main() {
    float s = vUv.x * uLength;
    float a = vUv.y * 6.28318;

    // Organic veins carved into the soil.
    float n1 = sin(s * 0.9 + sin(a * 3.0 + s * 0.15) * 1.8) * sin(a * 7.0 + sin(s * 0.45) * 2.2);
    float veins = smoothstep(0.94, 1.0, abs(n1));
    float n2 = sin(s * 2.3 + a * 5.0 + sin(s * 0.3));
    float fine = smoothstep(0.97, 1.0, abs(n2)) * 0.35;

    // Pheromone pulses flowing deeper into the colony.
    float band = fract(s * 0.035 - uTime * 0.12);
    float pulse = exp(-pow(band - 0.5, 2.0) * 260.0);
    float trail = smoothstep(0.985, 1.0, sin(a * 2.0 + s * 0.05)) * (0.6 + 0.4 * sin(s * 0.8 - uTime * 3.0));

    vec3 col = uEarth * (0.55 + 0.45 * sin(a * 2.0 + s * 0.2));
    col += uAmber * (veins * 0.55 + fine * 0.6);
    col += uTeal * pulse * (0.12 + veins * 0.9);
    col += uAmber * trail * 0.7;

    float fog = exp(-vDepth * 0.055);
    gl_FragColor = vec4(col * fog, 1.0);
  }
`;
