"use client";

import { useRef, useState } from "react";
import { DemoFrame, useDemoCanvas } from "./useDemoCanvas";

// Ant Colony Optimization on a small graph. Ants leave the nest, pick edges in
// proportion to pheromone^ALPHA × (1/length)^BETA, and on reaching food lay
// pheromone inversely proportional to their path length. Evaporation does the rest.

const NODE_COUNT = 18;
const ANTS = 40;
const ALPHA = 1.2;
const BETA = 2.5;
const EVAPORATION = 0.35; // per second
const SPEED = 0.55; // graph units per second

type Node = { x: number; y: number };
type Ant = { path: number[]; from: number; to: number; t: number; returning: boolean };

function makeGraph() {
  const nodes: Node[] = [];
  while (nodes.length < NODE_COUNT) {
    const n = { x: 0.06 + Math.random() * 0.88, y: 0.08 + Math.random() * 0.84 };
    if (nodes.every((m) => Math.hypot(m.x - n.x, m.y - n.y) > 0.14)) nodes.push(n);
  }
  nodes.sort((a, b) => a.x - b.x);
  const dist = nodes.map((a) => nodes.map((b) => Math.hypot(a.x - b.x, a.y - b.y)));
  const adj: number[][] = nodes.map(() => []);
  nodes.forEach((_, i) => {
    dist[i]
      .map((d, j) => ({ d, j }))
      .filter((e) => e.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 4)
      .forEach(({ j }) => {
        if (!adj[i].includes(j)) adj[i].push(j);
        if (!adj[j].includes(i)) adj[j].push(i);
      });
  });
  const pher = nodes.map(() => nodes.map(() => 0.1));
  return { nodes, dist, adj, pher };
}

export default function AcoDemo() {
  const [best, setBest] = useState<number | null>(null);
  // Built lazily on the client: the random map must not be baked into the prerender.
  const sim = useRef<ReturnType<typeof createSim> | null>(null);

  function createSim() {
    const g = makeGraph();
    return { ...g, nest: 0, food: NODE_COUNT - 1, ants: [] as Ant[], bestPath: [] as number[], bestLen: Infinity, lastReport: 0 };
  }

  const getSim = () => (sim.current ??= createSim());

  const spawn = (s = getSim()): Ant => ({ path: [s.nest], from: s.nest, to: s.nest, t: 1, returning: false });

  const choose = (ant: Ant) => {
    const s = getSim();
    const here = ant.to;
    const options = s.adj[here].filter((j) => !ant.path.includes(j));
    if (!options.length) return -1;
    const weights = options.map((j) => Math.pow(s.pher[here][j], ALPHA) * Math.pow(1 / s.dist[here][j], BETA));
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let k = 0; k < options.length; k++) {
      r -= weights[k];
      if (r <= 0) return options[k];
    }
    return options[options.length - 1];
  };

  const frame = useRef<DemoFrame>((ctx, w, h, dt) => {
    const s = getSim();
    while (s.ants.length < ANTS) s.ants.push(spawn());

    // Evaporate.
    const keep = Math.exp(-EVAPORATION * dt);
    for (const row of s.pher) for (let j = 0; j < row.length; j++) row[j] = Math.max(row[j] * keep, 0.05);

    for (const ant of s.ants) {
      const len = s.dist[ant.from][ant.to] || 0.0001;
      ant.t += (SPEED * dt) / len;
      if (ant.t < 1) continue;

      if (ant.returning) {
        // Walk the found path back to the nest, then start over.
        const idx = ant.path.indexOf(ant.to);
        if (idx <= 0) Object.assign(ant, spawn());
        else Object.assign(ant, { from: ant.to, to: ant.path[idx - 1], t: 0 });
        continue;
      }
      if (ant.to === s.food) {
        let total = 0;
        for (let k = 1; k < ant.path.length; k++) total += s.dist[ant.path[k - 1]][ant.path[k]];
        const deposit = 0.9 / total;
        for (let k = 1; k < ant.path.length; k++) {
          const a = ant.path[k - 1];
          const b = ant.path[k];
          s.pher[a][b] += deposit;
          s.pher[b][a] += deposit;
        }
        if (total < s.bestLen) {
          s.bestLen = total;
          s.bestPath = [...ant.path];
        }
        Object.assign(ant, { returning: true, from: ant.to, to: ant.path[ant.path.length - 2], t: 0 });
        continue;
      }
      const next = choose(ant);
      if (next < 0) {
        Object.assign(ant, spawn());
        continue;
      }
      ant.path.push(next);
      Object.assign(ant, { from: ant.to, to: next, t: 0 });
    }

    // Draw.
    ctx.clearRect(0, 0, w, h);
    const X = (n: Node) => n.x * w;
    const Y = (n: Node) => n.y * h;
    const maxP = Math.max(...s.pher.flat());

    s.adj.forEach((list, i) =>
      list.forEach((j) => {
        if (j < i) return;
        const p = s.pher[i][j] / maxP;
        ctx.strokeStyle = `rgba(255, 179, 71, ${0.08 + p * 0.9})`;
        ctx.lineWidth = 1 + p * 5;
        ctx.beginPath();
        ctx.moveTo(X(s.nodes[i]), Y(s.nodes[i]));
        ctx.lineTo(X(s.nodes[j]), Y(s.nodes[j]));
        ctx.stroke();
      })
    );

    if (s.bestPath.length > 1) {
      ctx.strokeStyle = "rgba(62, 240, 208, 0.9)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      s.bestPath.forEach((k, idx) => (idx ? ctx.lineTo(X(s.nodes[k]), Y(s.nodes[k])) : ctx.moveTo(X(s.nodes[k]), Y(s.nodes[k]))));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    s.nodes.forEach((n, i) => {
      const special = i === s.nest || i === s.food;
      ctx.fillStyle = i === s.nest ? "#3ef0d0" : i === s.food ? "#ffe2a8" : "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.arc(X(n), Y(n), special ? 8 : 4, 0, Math.PI * 2);
      ctx.fill();
      if (special) {
        ctx.font = "600 11px var(--font-mono), monospace";
        ctx.fillText(i === s.nest ? "NEST" : "FOOD", X(n) + 12, Y(n) + 4);
      }
    });

    ctx.fillStyle = "#ffcf85";
    for (const ant of s.ants) {
      const a = s.nodes[ant.from];
      const b = s.nodes[ant.to];
      const t = Math.min(ant.t, 1);
      ctx.beginPath();
      ctx.arc(X(a) + (X(b) - X(a)) * t, Y(a) + (Y(b) - Y(a)) * t, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    s.lastReport += dt;
    if (s.lastReport > 0.5 && Number.isFinite(s.bestLen)) {
      s.lastReport = 0;
      setBest(Math.round(s.bestLen * 1000) / 10);
    }
  });

  const canvasRef = useDemoCanvas(frame);

  const moveFood = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = getSim();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    let nearest = s.food;
    let bestD = Infinity;
    s.nodes.forEach((n, i) => {
      const d = Math.hypot(n.x - x, n.y - y);
      if (i !== s.nest && d < bestD) {
        bestD = d;
        nearest = i;
      }
    });
    s.food = nearest;
    s.bestLen = Infinity;
    s.bestPath = [];
    s.ants = [];
    setBest(null);
  };

  const reset = () => {
    sim.current = createSim();
    setBest(null);
  };

  return (
    <div className="demo">
      <canvas ref={canvasRef} className="demo-canvas" onPointerDown={moveFood} aria-label="Ant colony optimization simulation. Tap a node to move the food." />
      <div className="demo-bar">
        <span>Best route: {best === null ? "searching…" : `${best} units`}</span>
        <button type="button" onClick={reset}>
          New map
        </button>
      </div>
    </div>
  );
}
