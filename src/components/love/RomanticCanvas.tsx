"use client";

import { useEffect, useRef } from "react";

type HeartLayer = {
  sprite: HTMLCanvasElement;
  x: number;
  y: number;
  vy: number;
  vx: number;
  sway: number;
  swaySpeed: number;
  rot: number;
  rotSpeed: number;
  alpha: number;
  fadeIn: number;
  fadeOut: number;
  scale: number;
  depth: number;
};

type GlowLayer = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  baseAlpha: number;
  twinkleSpeed: number;
  phase: number;
  depth: number;
};

type Sparkle = {
  x: number;
  y: number;
  size: number;
  baseAlpha: number;
  speed: number;
  phase: number;
  kind: "twinkle" | "shooting";
  vx: number;
  vy: number;
};

const PALETTE = ["#ff6f91", "#ff9eaf", "#ffb6c1", "#ffe4ec", "#e56b8f", "#ffd1dc"];

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function pick<T>(arr: T[]): T {
  return arr[(Math.random() * arr.length) | 0];
}

function drawHeart(size: number, color: string): HTMLCanvasElement {
  const s = size * 4;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const ctx = c.getContext("2d")!;
  ctx.translate(s / 2, s / 2 + s * 0.06);
  const r = size / 2;
  ctx.beginPath();
  ctx.moveTo(0, r * 0.35);
  ctx.bezierCurveTo(r * 0.5, -r * 0.55, r * 1.7, -r * 0.4, r * 0.4, r * 0.45);
  ctx.bezierCurveTo(0, r * 0.75, -r * 0.4, r * 0.45, -r * 1.7, -r * 0.4);
  ctx.bezierCurveTo(-r * 1.7, -r * 0.4, -r * 0.5, -r * 0.55, 0, r * 0.35);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = s * 0.12;
  ctx.fill();
  ctx.shadowBlur = 0;
  const glow = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.5);
  glow.addColorStop(0, color + "22");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s * 0.5, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

function drawGlow(size: number, color: string): HTMLCanvasElement {
  const s = size;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, rgba(color, 0.85));
  g.addColorStop(0.4, rgba(color, 0.35));
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return c;
}

function rgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function RomanticCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.matchMedia("(max-width: 768px), (max-height: 640px)").matches;
    const density = reduced ? 0 : small ? 0.6 : 1;

    const heartCount = Math.round((small ? 12 : 20) * density);
    const glowCount = Math.round((small ? 55 : 95) * density);
    const sparkleCount = Math.round((small ? 18 : 34) * density);

    const hearts: HeartLayer[] = [];
    const glows: GlowLayer[] = [];
    const sparkles: Sparkle[] = [];

    const heartSprites: HTMLCanvasElement[] = [];
    [10, 16, 24, 34, 48].forEach((size) => {
      heartSprites.push(drawHeart(size, pick(PALETTE)));
      heartSprites.push(drawHeart(size, pick(PALETTE)));
    });
    const glowSprites: HTMLCanvasElement[] = [6, 10, 16].map((size) => drawGlow(size, pick(PALETTE)));

    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let running = true;

    const pointer = { x: -9999, y: -9999, tx: 0, ty: 0, has: false };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawnHeart = (reset: boolean): HeartLayer => {
      const sprite = pick(heartSprites);
      const depth = rand(0.25, 1);
      const size = sprite.width / 4;
      return {
        sprite,
        x: rand(0, w),
        y: reset ? h + size : rand(-40, h),
        vy: rand(0.12, 0.55) * (size / 16) * (0.6 + depth * 0.7),
        vx: rand(-0.08, 0.08),
        sway: rand(14, 40) * depth,
        swaySpeed: rand(0.0006, 0.0016) * depth,
        rot: rand(-0.4, 0.4),
        rotSpeed: rand(-0.001, 0.001),
        alpha: reset ? 0 : rand(0.35, 1),
        fadeIn: reset ? rand(0.5, 1.4) : 0,
        fadeOut: rand(1.2, 2.4),
        scale: depth,
        depth,
      };
    };

    const spawnGlow = (): GlowLayer => ({
      x: rand(0, w),
      y: rand(0, h),
      vx: rand(-0.12, 0.12),
      vy: rand(-0.12, 0.12),
      size: pick([6, 10, 16]),
      baseAlpha: rand(0.08, 0.28),
      twinkleSpeed: rand(0.002, 0.006),
      phase: rand(0, Math.PI * 2),
      depth: rand(0.2, 0.8),
    });

    const spawnSparkle = (shooting = false): Sparkle => ({
      x: rand(0, w),
      y: shooting ? rand(0, h * 0.6) : rand(0, h),
      size: rand(6, 14),
      baseAlpha: shooting ? 0.5 : rand(0.15, 0.6),
      speed: rand(0.002, 0.006),
      phase: rand(0, Math.PI * 2),
      kind: shooting ? "shooting" : "twinkle",
      vx: rand(0.3, 0.9),
      vy: rand(-0.9, -0.3),
    });

    for (let i = 0; i < heartCount; i++) hearts.push(spawnHeart(false));
    for (let i = 0; i < glowCount; i++) glows.push(spawnGlow());
    for (let i = 0; i < sparkleCount; i++) sparkles.push(spawnSparkle());

    const onPointer = (e: PointerEvent) => {
      pointer.has = true;
      pointer.tx = e.clientX;
      pointer.ty = e.clientY;
    };

    const onPointerLeave = () => {
      pointer.has = false;
      pointer.x = -9999;
      pointer.y = -9999;
    };

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerdown", onPointer, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave);

    resize();

    let last = performance.now();
    const frame = (now: number) => {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 16.667, 3);
      last = now;

      ctx.clearRect(0, 0, w, h);

      pointer.x += (pointer.tx - pointer.x) * 0.06;
      pointer.y += (pointer.ty - pointer.y) * 0.06;
      const px = pointer.has ? pointer.x : w / 2;
      const py = pointer.has ? pointer.y : h / 2;

      // Ambient soft light blobs (very cheap large gradients, moved slowly).
      const t = now * 0.00008;
      const blobA = { x: w * (0.25 + 0.1 * Math.sin(t)), y: h * (0.25 + 0.1 * Math.cos(t * 0.8)) };
      const blobB = { x: w * (0.75 + 0.12 * Math.cos(t * 0.7)), y: h * (0.7 + 0.12 * Math.sin(t * 0.9)) };
      ctx.fillStyle = "rgba(255,111,145,0.05)";
      ctx.beginPath();
      ctx.arc(blobA.x, blobA.y, Math.min(w, h) * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,182,193,0.045)";
      ctx.beginPath();
      ctx.arc(blobB.x, blobB.y, Math.min(w, h) * 0.5, 0, Math.PI * 2);
      ctx.fill();

      // Glow particles
      for (const g of glows) {
        g.x += g.vx * dt;
        g.y += g.vy * dt;
        if (g.x < -20) g.x = w + 20;
        if (g.x > w + 20) g.x = -20;
        if (g.y < -20) g.y = h + 20;
        if (g.y > h + 20) g.y = -20;
        const tw = 0.5 + 0.5 * Math.sin(now * g.twinkleSpeed + g.phase);
        const par = g.depth * 26;
        const gx = g.x + (px - w / 2) * 0.01 * par * 0.1;
        const gy = g.y + (py - h / 2) * 0.01 * par * 0.1;
        const sprite = g.size === 6 ? glowSprites[0] : g.size === 10 ? glowSprites[1] : glowSprites[2];
        ctx.globalAlpha = g.baseAlpha * (0.35 + 0.65 * tw);
        ctx.drawImage(sprite, gx - g.size / 2, gy - g.size / 2, g.size, g.size);
      }
      ctx.globalAlpha = 1;

      // Sparkles
      for (const s of sparkles) {
        s.phase += s.speed * dt;
        if (s.kind === "shooting") {
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          if (s.y < -30 || s.x > w + 30) Object.assign(s, spawnSparkle(true));
        }
        const tw = 0.5 + 0.5 * Math.sin(s.phase);
        const alpha = s.baseAlpha * (0.3 + 0.7 * tw);
        const pxo = (px - w / 2) * 0.02;
        const pyo = (py - h / 2) * 0.02;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = "#ffd9e3";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(s.x + pxo - s.size / 2, s.y + pyo);
        ctx.lineTo(s.x + pxo + s.size / 2, s.y + pyo);
        ctx.moveTo(s.x + pxo, s.y + pyo - s.size / 2);
        ctx.lineTo(s.x + pxo, s.y + pyo + s.size / 2);
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(s.x + pxo, s.y + pyo, s.size * 0.09, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Hearts
      for (const hr of hearts) {
        hr.y -= hr.vy * dt;
        hr.x += hr.vx * dt + Math.sin(now * hr.swaySpeed + hr.sway) * 0.35 * hr.sway * 0.01 * dt;
        hr.rot += hr.rotSpeed * dt;
        hr.alpha = Math.min(1, hr.alpha + (hr.fadeIn > 0 ? 0.016 * dt : 0));
        hr.fadeIn = Math.max(0, hr.fadeIn - 0.016 * dt);

        if (hr.y < -60) {
          Object.assign(hr, spawnHeart(true));
          continue;
        }

        const size = hr.sprite.width / 4 * hr.scale;
        const par = hr.depth * 34;
        const hx = hr.x + (px - w / 2) * 0.01 * par;
        const hy = hr.y + (py - h / 2) * 0.01 * par;
        const fadeOut = hr.y > h - 160 ? Math.max(0, (h - hr.y) / 160) : 1;
        const a = hr.alpha * fadeOut;

        ctx.globalAlpha = a;
        ctx.translate(hx, hy);
        ctx.rotate(hr.rot);
        ctx.drawImage(hr.sprite, -size / 2, -size / 2, size, size);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      ctx.globalAlpha = 1;
    };

    raf = requestAnimationFrame(frame);

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="romantic-canvas" aria-hidden="true" />;
}

export { rgba };
