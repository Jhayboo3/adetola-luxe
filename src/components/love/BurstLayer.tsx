"use client";

import { useEffect, useState } from "react";
import { onBurst, type BurstSpec } from "./loveEvents";
import { HeartIcon, SparkleIcon } from "./icons";

type Particle = {
  id: string;
  dx: number;
  dy: number;
  rot: number;
  size: number;
  dur: number;
  delay: number;
  color: string;
  shape: "heart" | "dot" | "sparkle";
};

type Burst = {
  id: number;
  x: number;
  y: number;
  particles: Particle[];
};

const ROSE = ["#ff6f91", "#ff9eaf", "#ffb6c1", "#ffe4ec", "#e56b8f", "#ffd1dc"];

let burstSeq = 0;

function makeParticles(spec: BurstSpec): Particle[] {
  const count = spec.count ?? 26;
  const spread = spec.spread ?? 220;
  const kind = spec.kind ?? "mix";
  const colors = spec.colors ?? ROSE;
  const scale = spec.scale ?? 1;
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = (0.3 + Math.random() * 0.7) * spread;
    const roll = Math.random();
    const shape: Particle["shape"] =
      kind === "hearts" ? "heart" : kind === "glow" ? (roll < 0.5 ? "dot" : "sparkle") : roll < 0.55 ? "heart" : roll < 0.82 ? "dot" : "sparkle";
    particles.push({
      id: `${burstSeq}-${i}`,
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist - (kind === "hearts" ? 46 : 12) * scale,
      rot: Math.random() * 360,
      size: (shape === "dot" ? 6 + Math.random() * 12 : 10 + Math.random() * 24) * scale,
      dur: 0.7 + Math.random() * 0.85,
      delay: Math.random() * 90,
      color: colors[(Math.random() * colors.length) | 0],
      shape,
    });
  }
  return particles;
}

export default function BurstLayer() {
  const [bursts, setBursts] = useState<Burst[]>([]);

  useEffect(() => {
    return onBurst((spec) => {
      const id = ++burstSeq;
      setBursts((b) => [...b, { id, x: spec.x, y: spec.y, particles: makeParticles(spec) }]);
      window.setTimeout(() => {
        setBursts((b) => b.filter((x) => x.id !== id));
      }, 2100);
    });
  }, []);

  return (
    <div className="burst-layer" aria-hidden="true">
      {bursts.map((b) => (
        <div key={b.id} className="burst-origin" style={{ left: b.x, top: b.y }}>
          {b.particles.map((p) => (
            <span
              key={p.id}
              className={`burst-particle burst-particle--${p.shape}`}
              style={{
                width: p.size,
                height: p.size,
                color: p.color,
                ["--dx" as string]: `${p.dx}px`,
                ["--dy" as string]: `${p.dy}px`,
                ["--rot" as string]: `${p.rot}deg`,
                animationDuration: `${p.dur}s`,
                animationDelay: `${p.delay}ms`,
              }}
            >
              {p.shape === "heart" ? <HeartIcon className="burst-shape" /> : p.shape === "sparkle" ? <SparkleIcon className="burst-shape" /> : null}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
