"use client";

import { useEffect, useRef, useState } from "react";
import { HeartIcon } from "./icons";

type Trail = {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  rot: number;
};

const TRAIL_COLORS = ["#ff9eaf", "#ffb6c1", "#ffe4ec", "#ff6f91"];

export default function CursorTrail({ active }: { active: boolean }) {
  const [trails, setTrails] = useState<Trail[]>([]);
  const lastSpawn = useRef(0);
  const seq = useRef(0);

  useEffect(() => {
    if (!active) return;

    const spawn = (x: number, y: number) => {
      const now = performance.now();
      if (now - lastSpawn.current < 60) return;
      lastSpawn.current = now;
      const id = ++seq.current;
      const trail: Trail = {
        id,
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 8,
        size: 8 + Math.random() * 12,
        color: TRAIL_COLORS[(Math.random() * TRAIL_COLORS.length) | 0],
        rot: Math.random() * 360,
      };
      setTrails((t) => {
        const next = [...t, trail];
        return next.length > 12 ? next.slice(next.length - 12) : next;
      });
      window.setTimeout(() => setTrails((t) => t.filter((i) => i.id !== id)), 1400);
    };

    const onMove = (e: PointerEvent) => spawn(e.clientX, e.clientY);
    const onDown = (e: PointerEvent) => spawn(e.clientX, e.clientY);

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      setTrails([]);
    };
  }, [active]);

  return (
    <div className="trail-layer" aria-hidden="true">
      {trails.map((t) => (
        <span
          key={t.id}
          className="trail-heart"
          style={{
            left: t.x,
            top: t.y,
            width: t.size,
            height: t.size,
            color: t.color,
            ["--rot" as string]: `${t.rot}deg`,
          }}
        >
          <HeartIcon className="trail-shape" />
        </span>
      ))}
    </div>
  );
}
