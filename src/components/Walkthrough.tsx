"use client";

import dynamic from "next/dynamic";
import { Fragment, useEffect, useRef, useState } from "react";
import { chapters, company, isPlaceholder, programme, socials } from "@/config/yukty";
import { LOGO_SETTLED_EVENT, scrollState } from "@/lib/scrollState";
import AcoDemo from "./demos/AcoDemo";
import PsoDemo from "./demos/PsoDemo";

const SwarmScene = dynamic(() => import("./scene/SwarmScene"), { ssr: false });

const AGENTS = 480;
const TYPE_MS = 22;
// Reveal the hero text anyway if the 3D intro never reports in (no WebGL, slow load).
const INTRO_FALLBACK_MS = 9000;

function Value({ text }: { text: string }) {
  return isPlaceholder(text) ? <span className="placeholder">{text}</span> : <>{text}</>;
}

function SocialLinks() {
  return (
    <ul className="socials">
      {socials.map((s) => {
        const content = (
          <>
            <span className="social-label">{s.label}</span>
            <Value text={s.handle} />
          </>
        );
        return (
          <li key={s.label}>
            {isPlaceholder(s.url) ? (
              <span className="social-card" title={`Placeholder — set ${s.label} URL in src/config/yukty.ts`}>
                {content}
              </span>
            ) : (
              <a className="social-card" href={s.url} target="_blank" rel="noreferrer">
                {content}
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Ask() {
  const mail = isPlaceholder(company.email)
    ? undefined
    : `mailto:${company.email}?subject=${encodeURIComponent("Swarm Intelligence workshop — meeting request")}`;
  return (
    <>
      <div className="cta-row">
        <a className="cta" href={mail} aria-disabled={!mail}>
          Schedule a meeting with our team
        </a>
        <a className="cta ghost" href={company.website} target="_blank" rel="noreferrer">
          Visit yukty.com
        </a>
      </div>
      <dl className="contact">
        <div>
          <dt>Email</dt>
          <dd>
            <Value text={company.email} />
          </dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>
            <Value text={company.phone} />
          </dd>
        </div>
        <div>
          <dt>Office</dt>
          <dd>
            <Value text={company.address} />
          </dd>
        </div>
      </dl>
      <SocialLinks />
    </>
  );
}

export default function Walkthrough() {
  const sections = useRef<(HTMLElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [introDone, setIntroDone] = useState(false);
  const [sync, setSync] = useState("99.8");
  // [mission, characters typed]: a new mission restarts the typing from zero.
  const [typing, setTyping] = useState<[number, number]>([0, 0]);

  // Live-looking telemetry for the HUD.
  useEffect(() => {
    const id = window.setInterval(() => setSync((99.2 + Math.random() * 0.79).toFixed(1)), 1400);
    return () => window.clearInterval(id);
  }, []);

  // Type out the active mission's terminal log.
  const log = chapters[active].log.map((line) => `> ${line}`).join("\n");
  useEffect(() => {
    const id = window.setInterval(() => setTyping((prev) => {
          const [m, n] = prev;
          if (m !== active) return [active, 1];
          return n >= log.length ? prev : [m, n + 1];
        }), TYPE_MS);
    return () => window.clearInterval(id);
  }, [active, log.length]);
  const typed = typing[0] === active ? typing[1] : 0;

  useEffect(() => {
    const done = () => setIntroDone(true);
    const fallback = window.setTimeout(done, INTRO_FALLBACK_MS);
    window.addEventListener(LOGO_SETTLED_EVENT, done);
    return () => {
      window.clearTimeout(fallback);
      window.removeEventListener(LOGO_SETTLED_EVENT, done);
    };
  }, []);

  useEffect(() => {
    const update = () => {
      // Continuous chapter index from where each section sits relative to the viewport.
      const y = window.scrollY + window.innerHeight * 0.35;
      const tops = sections.current.map((el) => el?.offsetTop ?? 0);
      let i = 0;
      while (i < tops.length - 1 && y >= tops[i + 1]) i++;
      const span = i < tops.length - 1 ? tops[i + 1] - tops[i] : window.innerHeight;
      const f = Math.min(Math.max((y - tops[i]) / span, 0), 1);
      // Hold still on each mission, then glide quickly to the next.
      const eased = f < 0.45 ? 0 : (f - 0.45) / 0.55;
      const chapter = Math.min(i + eased * eased * (3 - 2 * eased), chapters.length - 1);
      scrollState.chapter = chapter;
      setActive(Math.round(chapter));
    };
    const pointer = (e: PointerEvent) => {
      scrollState.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      scrollState.pointerY = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    // Presenter mode: arrow keys / clicker jump mission by mission.
    const keys = (e: KeyboardEvent) => {
      const next = ["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key);
      const prev = ["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key);
      if (!next && !prev) return;
      if ((e.target as HTMLElement)?.closest("button, a, input")) return;
      e.preventDefault();
      const target = Math.min(Math.max(Math.round(scrollState.chapter) + (next ? 1 : -1), 0), chapters.length - 1);
      sections.current[target]?.scrollIntoView({ behavior: "smooth" });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    window.addEventListener("pointermove", pointer);
    window.addEventListener("keydown", keys);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("pointermove", pointer);
      window.removeEventListener("keydown", keys);
    };
  }, []);

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <>
      <div className="stage" aria-hidden>
        <SwarmScene />
      </div>

      <header className="hud-top">
        <a className="brand" href={company.website} target="_blank" rel="noreferrer">
          <span className="brand-mark" />
          {company.shortName}
          <small>Swarm OS v1.0</small>
        </a>
        <dl className="hud-stats" aria-label="Swarm telemetry">
          <div>
            <dt>Agents</dt>
            <dd>{AGENTS}</dd>
          </div>
          <div>
            <dt>Mission</dt>
            <dd>
              {pad(active)}/{pad(chapters.length - 1)}
            </dd>
          </div>
          <div>
            <dt>Sync</dt>
            <dd>{sync}%</dd>
          </div>
        </dl>
        <span className="live">
          <i /> Live
        </span>
      </header>

      <nav className="missions" aria-label="Missions">
        <ol>
          {chapters.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                className={i === active ? "on" : undefined}
                aria-current={i === active ? "step" : undefined}
                onClick={() => sections.current[i]?.scrollIntoView({ behavior: "smooth" })}
              >
                <span className="mission-dot" />
                <span className="mission-label">
                  {pad(i)} {c.code}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <pre className="terminal" aria-hidden>
        <span className="terminal-title">swarm@yukty:~$ mission_{pad(active)}.{chapters[active].code.toLowerCase()}</span>
        {"\n"}
        {log.slice(0, typed)}
        <span className="caret" />
      </pre>

      <main className="chapters">
        {chapters.map((c, i) => (
          <section
            key={c.id}
            id={c.id}
            ref={(el) => {
              sections.current[i] = el;
            }}
            className={`chapter${c.demo ? " has-demo" : ""}${i === 0 ? ` is-hero${introDone ? " intro-done" : ""}` : ""}${i === active ? " is-active" : ""}`}
          >
            <div className="panel">
              <div className="window-bar" aria-hidden>
                <span className="window-dots">
                  <i />
                  <i />
                  <i />
                </span>
                mission_{pad(i)}.{c.code.toLowerCase()}
              </div>
              <p className="kicker">
                <span>Mission {pad(i)}</span>
                {c.kicker}
              </p>
              {i === 0 ? (
                <h2 className="welcome">
                  {c.title.split(" ").map((word, w) => (
                    <Fragment key={w}>
                      {w > 0 && " "}
                      <span style={{ "--w": w } as React.CSSProperties}>{word}</span>
                    </Fragment>
                  ))}
                </h2>
              ) : (
                <h2>{c.title}</h2>
              )}
              <p className="lead">{c.lead}</p>
              {c.points && (
                <ul className="points">
                  {c.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              )}
              {c.id === "internship" && (
                <div className="fee-badge">
                  <strong>{programme.participationFee}</strong>
                  <span>participation fee for students</span>
                </div>
              )}
              {c.demo === "aco" && <AcoDemo />}
              {c.demo === "pso" && <PsoDemo />}
              {c.id === "ask" && <Ask />}
              {i === 0 && <p className="scroll-cue">Scroll to run the missions ↓</p>}
            </div>
          </section>
        ))}
      </main>

      <footer className="site-footer">
        <span>© {company.name}</span>
        <a href={company.website} target="_blank" rel="noreferrer">
          yukty.com
        </a>
      </footer>
    </>
  );
}
