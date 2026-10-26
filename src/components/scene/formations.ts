import * as THREE from "three";
import { ACO_BEST, ACO_SCOUTS, BRIDGE_ENDS, SKY_CENTER, alongPath, hotspot } from "./layout";

// One formation per mission. Each writes drone i's target position for time t
// into `out`. Drones spring toward their target, so switching missions makes
// the whole swarm flow organically from one shape to the next.

export type Drone = { r1: number; r2: number; r3: number };
export type Formation = (i: number, n: number, t: number, d: Drone, out: THREE.Vector3) => void;
export type Tint = "cyan" | "gold" | "fire";

const TAU = Math.PI * 2;
const C = SKY_CENTER;

// 00 · Standby: a long line of hovering lights far out over the water,
// mirrored in the lake, while the logo swarm takes the stage.
const standby: Formation = (i, n, t, d, out) => {
  out.set((i / n - 0.5) * 46, 0.7 + (i % 3) * 0.35 + Math.sin(t * 1.2 + d.r1 * TAU) * 0.05, -30 - (i % 3) * 1.6);
};

// 01 · Link: a living bridge streaming between the industry and campus towers.
const bridge: Formation = (i, n, t, d, out) => {
  const u = THREE.MathUtils.euclideanModulo(i / n + t * 0.04 * (i % 2 ? 1 : -1), 1);
  out.lerpVectors(BRIDGE_ENDS[0], BRIDGE_ENDS[1], u);
  out.y = 5 + Math.sin(u * Math.PI) * 4.5 + (d.r1 - 0.5) * 0.5;
  out.z += (d.r2 - 0.5) * 1.4;
};

// 02 · Core: three helix columns, one per pillar.
const pillars: Formation = (i, n, t, d, out) => {
  const col = i % 3;
  const k = Math.floor(i / 3) / (n / 3);
  const a = k * TAU * 5 + t * 1.2 + col;
  out.set((col - 1) * 7 + Math.cos(a) * 1.2, 0.8 + k * 9, -4 + Math.sin(a) * 1.2);
};

// 03 · Flock: free murmuration over the skyline.
const flock: Formation = (_i, _n, t, d, out) => {
  out.set(
    C.x + Math.sin(t * 0.5 + d.r1 * TAU) * 6 + Math.sin(t * 0.21 + d.r2 * 3) * 2.5 + (d.r3 - 0.5) * 0.8,
    C.y + Math.sin(t * 0.7 + d.r2 * TAU) * 2.2 * Math.cos(t * 0.13 + d.r3),
    C.z + Math.cos(t * 0.4 + d.r3 * TAU) * 4 + (d.r1 - 0.5) * 0.8
  );
};

// 04 · Route (ACO): most of the colony streams down the best route; scouts still probe longer ones.
const route: Formation = (i, n, t, d, out) => {
  const scout = i % 4 === 0;
  const path = scout ? ACO_SCOUTS[i % 8 === 0 ? 0 : 1] : ACO_BEST;
  alongPath(path, d.r1 + t * (scout ? 0.035 : 0.06), out);
  out.x += (d.r2 - 0.5) * 0.35;
  out.z += (d.r3 - 0.5) * 0.35;
  out.y += Math.sin(t * 3 + d.r1 * TAU) * 0.08;
};

// 05 · Seek (PSO): scatter across the lake, then converge on the drifting hotspot.
const fire = new THREE.Vector3();
const seek: Formation = (i, n, t, d, out) => {
  const cycle = THREE.MathUtils.euclideanModulo(t / 7 + d.r3 * 0.08, 1);
  const k = THREE.MathUtils.smoothstep(cycle, 0.2, 0.7);
  hotspot(t, fire);
  const scatterX = (d.r1 - 0.5) * 36;
  const scatterZ = (d.r2 - 0.5) * 30 - 2;
  const a = (i / n) * TAU * 7 + t;
  const ring = 0.6 + d.r3 * 1.6;
  out.set(
    THREE.MathUtils.lerp(scatterX, fire.x + Math.cos(a) * ring, k),
    THREE.MathUtils.lerp(5 + d.r3 * 3, 2.2 + d.r1 * 2.5, k),
    THREE.MathUtils.lerp(scatterZ, fire.z + Math.sin(a) * ring, k)
  );
};

// 06 · Deploy: a drone light show cycling sphere → lattice → wave.
const showShape = (shape: number, i: number, n: number, t: number, out: THREE.Vector3) => {
  if (shape === 0) {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / n);
    const th = Math.PI * (1 + Math.sqrt(5)) * i + t * 0.3;
    return out.set(Math.sin(phi) * Math.cos(th) * 4, Math.cos(phi) * 4, Math.sin(phi) * Math.sin(th) * 4);
  }
  if (shape === 1) {
    const side = Math.ceil(Math.cbrt(n));
    const s = 7 / side;
    return out.set(((i % side) - side / 2) * s, ((Math.floor(i / side) % side) - side / 2) * s, (Math.floor(i / (side * side)) - side / 2) * s);
  }
  const side = Math.ceil(Math.sqrt(n));
  const gx = i % side;
  const gz = Math.floor(i / side);
  return out.set((gx - side / 2) * 0.5, Math.sin(gx * 0.45 + t * 2) * 1.2 + Math.cos(gz * 0.4 + t) * 0.8, (gz - side / 2) * 0.5);
};
const showA = new THREE.Vector3();
const showB = new THREE.Vector3();
const lightShow: Formation = (i, n, t, _d, out) => {
  const phase = t / 4.5;
  const shape = Math.floor(phase) % 3;
  const k = THREE.MathUtils.smoothstep(phase % 1, 0.65, 1);
  showShape(shape, i, n, t, showA);
  showShape((shape + 1) % 3, i, n, t, showB);
  out.lerpVectors(showA, showB, k).add(C);
};

// 07 · Train: five stacked counter-rotating rings, one per workshop session.
const sessions: Formation = (i, n, t, _d, out) => {
  const ring = i % 5;
  const a = (Math.floor(i / 5) / (n / 5)) * TAU + t * (ring % 2 ? 0.5 : -0.5);
  const r = 2.2 + Math.sin(ring * 1.3) * 0.4;
  out.set(C.x + Math.cos(a) * r, 2.4 + ring * 1.9, C.z + Math.sin(a) * r);
};

// 08 · Enlist: a giant flowing "0" for the zero participation fee.
const zero: Formation = (i, n, t, d, out) => {
  const a = (i / n) * TAU + t * 0.25;
  const thick = (d.r1 - 0.5) * 0.7;
  out.set(C.x + Math.cos(a) * (3 + thick), C.y + 0.5 + Math.sin(a) * (4.2 + thick), C.z + (d.r2 - 0.5) * 0.6);
};

// 09 · Launch: a constellation of six career stars joined by streams of drones.
const STARS = [
  [-6, 10, -4],
  [-2.5, 6, -1],
  [1.5, 11, -5],
  [5.5, 7.5, -2],
  [-4, 4, 1],
  [3, 3.5, 1.5],
].map(([x, y, z]) => new THREE.Vector3(x, y, z));
const constellation: Formation = (i, _n, t, d, out) => {
  const s = i % STARS.length;
  if (i % 3 === 0) {
    // Streams between consecutive stars.
    const u = THREE.MathUtils.euclideanModulo(d.r1 + t * 0.12, 1);
    out.lerpVectors(STARS[s], STARS[(s + 1) % STARS.length], u);
  } else {
    const a = d.r1 * TAU + t * 0.8;
    const b = Math.acos(2 * d.r2 - 1);
    const r = 0.35 + d.r3 * 0.45;
    out.set(Math.sin(b) * Math.cos(a) * r, Math.cos(b) * r, Math.sin(b) * Math.sin(a) * r).add(STARS[s]);
  }
};

// 10 · Connect: the swarm spells YUKTY AI in the sky.
let textSlots: THREE.Vector3[] | null = null;
function spell(n: number) {
  if (textSlots && textSlots.length === n) return textSlots;
  const w = 220;
  const h = 60;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.font = "900 44px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("YUKTY AI", w / 2, h / 2);
  const data = ctx.getImageData(0, 0, w, h).data;
  const lit: [number, number][] = [];
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (data[(y * w + x) * 4] > 128) lit.push([x, y]);
  const step = lit.length / n;
  textSlots = Array.from({ length: n }, (_, i) => {
    const [x, y] = lit[Math.floor(i * step)] ?? [w / 2, h / 2];
    return new THREE.Vector3((x / w - 0.5) * 15, (0.5 - y / h) * 4.1, 0);
  });
  return textSlots;
}
const connect: Formation = (i, n, t, d, out) => {
  out.copy(spell(n)[i]).add(C);
  out.y += 1 + Math.sin(t * 1.5 + out.x * 0.4) * 0.15;
  out.z += Math.sin(t * 2 + d.r1 * TAU) * 0.05;
};

export const formations: { shape: Formation; tint: Tint }[] = [
  { shape: standby, tint: "cyan" },
  { shape: bridge, tint: "cyan" },
  { shape: pillars, tint: "gold" },
  { shape: flock, tint: "cyan" },
  { shape: route, tint: "gold" },
  { shape: seek, tint: "fire" },
  { shape: lightShow, tint: "cyan" },
  { shape: sessions, tint: "gold" },
  { shape: zero, tint: "gold" },
  { shape: constellation, tint: "cyan" },
  { shape: connect, tint: "gold" },
];
