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

// "Circuit hive": a honeycomb of hex cells (the swarm's home) etched with
// circuit traces like the ones in the Yukty logo. Gold cells light up in waves
// racing down the tunnel while data pulses run along the traces.
export const wallFragment = /* glsl */ `
  uniform float uTime;
  uniform float uLength;
  uniform vec3 uBase;
  uniform vec3 uEdge;
  uniform vec3 uGold;
  uniform vec3 uCyan;
  varying vec2 vUv;
  varying float vDepth;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // Returns (distance to cell edge, cell id).
  vec3 hexCell(vec2 uv) {
    const vec2 r = vec2(1.0, 1.7320508);
    vec2 h = r * 0.5;
    vec2 a = mod(uv, r) - h;
    vec2 b = mod(uv - h, r) - h;
    vec2 gv = dot(a, a) < dot(b, b) ? a : b;
    vec2 q = abs(gv);
    float edge = 0.5 - max(dot(q, normalize(r)), q.x);
    return vec3(edge, uv - gv);
  }

  void main() {
    float s = vUv.x * uLength;
    // 26 cells around: an integer count so the honeycomb wraps without a seam.
    vec2 uv = vec2(vUv.y * 26.0, s * 0.75);
    vec3 cell = hexCell(uv);
    float edge = cell.x;
    vec2 id = cell.yz;
    float rnd = hash(id);

    float rim = smoothstep(0.045, 0.0, edge);
    float rimGlow = smoothstep(0.16, 0.0, edge) * 0.35;

    // Waves of gold cells racing deeper into the tunnel.
    float wave = sin(id.y * 0.22 - uTime * 2.2 + rnd * 1.5);
    float lit = smoothstep(0.93, 1.0, wave) * step(0.55, rnd);
    float sparkle = step(0.985, hash(id + floor(uTime * 3.0)));
    float fill = (lit + sparkle * 0.6) * smoothstep(0.0, 0.25, edge);

    // Circuit traces running along the tunnel, with packets of light on them.
    float lane = vUv.y * 13.0;
    float laneId = floor(lane);
    float onLane = step(0.6, hash(vec2(laneId, floor(s * 0.08))));
    float trace = smoothstep(0.06, 0.0, abs(fract(lane) - 0.5)) * onLane;
    float packet = smoothstep(0.94, 1.0, fract(s * 0.05 - uTime * (0.35 + hash(vec2(laneId, 3.0)) * 0.4)));
    float node = smoothstep(0.18, 0.12, length(vec2(fract(lane) - 0.5, (fract(s * 0.3) - 0.5) * 0.6))) * onLane * step(0.7, hash(vec2(laneId, floor(s * 0.3))));

    vec3 col = uBase * (0.7 + 0.3 * rnd);
    col += uEdge * (rim * 0.55 + rimGlow * 0.4);
    col += uGold * fill * 0.9;
    col += uCyan * trace * (0.18 + packet * 1.6);
    col += uGold * node * 0.8;

    float fog = exp(-vDepth * 0.05);
    gl_FragColor = vec4(col * fog, 1.0);
  }
`;
