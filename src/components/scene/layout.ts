import * as THREE from "three";

// Shared world layout for Swarm OS: mission routes, beacons and the moving
// PSO hotspot. Pure data and helpers so the markers and the swarm agree on
// where things are.

export const BLOCK = 2.2; // grid spacing that mission routes snap to
export const LOGO_POSITION = new THREE.Vector3(0, 8.6, 0);
export const SKY_CENTER = new THREE.Vector3(0, 8, -2);

const grid = (points: [number, number][], y: number) => points.map(([x, z]) => new THREE.Vector3(x * BLOCK, y, z * BLOCK));

// ACO: the route the colony settles on, plus two longer routes scouts still try.
// Waypoints are in grid units.
export const ACO_HUB: [number, number] = [-5, 4];
export const ACO_DROP: [number, number] = [5, -4];
export const ACO_BEST = grid([ACO_HUB, [-5, 1], [-1, 1], [-1, -2], [3, -2], [3, -4], ACO_DROP], 1.6);
export const ACO_SCOUTS = [
  grid([ACO_HUB, [0, 4], [0, 3], [4, 3], [4, -1], [6, -1], [6, -4], ACO_DROP], 2.4),
  grid([ACO_HUB, [-7, 4], [-7, -5], [2, -5], [2, -4], ACO_DROP], 2.0),
];

// Point at fraction u (0..1) along a polyline, by length.
export function alongPath(path: THREE.Vector3[], u: number, out: THREE.Vector3) {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += path[i].distanceTo(path[i - 1]);
  let d = THREE.MathUtils.euclideanModulo(u, 1) * total;
  for (let i = 1; i < path.length; i++) {
    const seg = path[i].distanceTo(path[i - 1]);
    if (d <= seg) return out.lerpVectors(path[i - 1], path[i], d / seg);
    d -= seg;
  }
  return out.copy(path[path.length - 1]);
}

// PSO: a wildfire hotspot that drifts across the city.
export function hotspot(t: number, out: THREE.Vector3) {
  return out.set(Math.sin(t * 0.23) * 7, 0, Math.cos(t * 0.17) * 6 - 2);
}

// Chapter 1: the bridge's two anchor towers.
export const BRIDGE_ENDS = [new THREE.Vector3(-8.8, 0, -2.2), new THREE.Vector3(8.8, 0, -2.2)];
