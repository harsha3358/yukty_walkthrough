"use client";

import { useRef, useState } from "react";
import { DemoFrame, useDemoCanvas } from "./useDemoCanvas";

// Particle Swarm Optimization over a bumpy 2D landscape. Each particle is pulled
// toward its own best position (cognitive) and the swarm's best (social).

const PARTICLES = 46;
const INERTIA = 0.72;
const COGNITIVE = 1.4;
const SOCIAL = 1.6;
const GRID = 72;

type Particle = { x: number; y: number; vx: number; vy: number; bx: number; by: number; bv: number };

function landscape(x: number, y: number, gx: number, gy: number) {
  const valley = -1.4 * Math.exp(-((x - gx) ** 2 + (y - gy) ** 2) / 0.012);
  const ripples = 0.25 * Math.sin(x * 14) * Math.cos(y * 12) + 0.2 * Math.sin((x + y) * 9);
  const decoy = -0.55 * Math.exp(-((x - (1 - gx)) ** 2 + (y - (1 - gy)) ** 2) / 0.02);
  return valley + ripples + decoy;
}

function scatter(): Particle[] {
  return Array.from({ length: PARTICLES }, () => {
    const x = Math.random();
    const y = Math.random();
    return { x, y, vx: (Math.random() - 0.5) * 0.02, vy: (Math.random() - 0.5) * 0.02, bx: x, by: y, bv: Infinity };
  });
}

export default function PsoDemo() {
  const [iteration, setIteration] = useState(0);
  const sim = useRef({
    goal: { x: 0.68, y: 0.38 },
    // Scattered on the first client frame so the prerender stays deterministic.
    particles: [] as Particle[],
    best: { x: 0.5, y: 0.5, v: Infinity },
    heat: null as HTMLCanvasElement | null,
    tick: 0,
    acc: 0,
  });

  const drawHeat = () => {
    const s = sim.current;
    const c = document.createElement("canvas");
    c.width = GRID;
    c.height = GRID;
    const g = c.getContext("2d")!;
    const img = g.createImageData(GRID, GRID);
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const v = landscape(i / GRID, j / GRID, s.goal.x, s.goal.y);
        const t = Math.min(Math.max((v + 1.4) / 1.9, 0), 1);
        const k = (j * GRID + i) * 4;
        // Low = glowing teal valley, high = dark earth.
        img.data[k] = 20 + 60 * t;
        img.data[k + 1] = 230 * (1 - t) + 20 * t;
        img.data[k + 2] = 200 * (1 - t) + 30 * t;
        img.data[k + 3] = 40 + 120 * (1 - t);
      }
    }
    g.putImageData(img, 0, 0);
    s.heat = c;
  };

  const frame = useRef<DemoFrame>((ctx, w, h, dt) => {
    const s = sim.current;
    if (!s.particles.length) s.particles = scatter();
    if (!s.heat) drawHeat();

    // Step the swarm at a fixed 20 Hz so the motion stays readable.
    s.acc += dt;
    while (s.acc > 0.05) {
      s.acc -= 0.05;
      s.tick++;
      for (const p of s.particles) {
        const v = landscape(p.x, p.y, s.goal.x, s.goal.y);
        if (v < p.bv) Object.assign(p, { bx: p.x, by: p.y, bv: v });
        if (v < s.best.v) s.best = { x: p.x, y: p.y, v };
      }
      for (const p of s.particles) {
        const r1 = Math.random();
        const r2 = Math.random();
        p.vx = INERTIA * p.vx + COGNITIVE * r1 * (p.bx - p.x) * 0.05 + SOCIAL * r2 * (s.best.x - p.x) * 0.05;
        p.vy = INERTIA * p.vy + COGNITIVE * r1 * (p.by - p.y) * 0.05 + SOCIAL * r2 * (s.best.y - p.y) * 0.05;
        p.x = Math.min(Math.max(p.x + p.vx, 0), 1);
        p.y = Math.min(Math.max(p.y + p.vy, 0), 1);
      }
      if (s.tick % 10 === 0) setIteration(s.tick);
    }

    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    if (s.heat) ctx.drawImage(s.heat, 0, 0, w, h);

    ctx.strokeStyle = "rgba(255, 226, 168, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(s.best.x * w, s.best.y * h, 14, 0, Math.PI * 2);
    ctx.stroke();

    for (const p of s.particles) {
      ctx.strokeStyle = "rgba(255, 179, 71, 0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x * w, p.y * h);
      ctx.lineTo((p.x - p.vx * 4) * w, (p.y - p.vy * 4) * h);
      ctx.stroke();
      ctx.fillStyle = "#ffcf85";
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  const canvasRef = useDemoCanvas(frame);

  const moveGoal = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = sim.current;
    const rect = e.currentTarget.getBoundingClientRect();
    s.goal = { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
    // The landscape changed, so every remembered "best" is stale.
    s.best = { x: 0.5, y: 0.5, v: Infinity };
    for (const p of s.particles) p.bv = Infinity;
    s.heat = null;
    s.tick = 0;
    setIteration(0);
  };

  const rescatter = () => {
    const s = sim.current;
    s.particles = scatter();
    s.best = { x: 0.5, y: 0.5, v: Infinity };
    s.tick = 0;
    setIteration(0);
  };

  return (
    <div className="demo">
      <canvas ref={canvasRef} className="demo-canvas" onPointerDown={moveGoal} aria-label="Particle swarm optimization simulation. Tap to move the target valley." />
      <div className="demo-bar">
        <span>Iteration {iteration}</span>
        <button type="button" onClick={rescatter}>
          Scatter swarm
        </button>
      </div>
    </div>
  );
}
