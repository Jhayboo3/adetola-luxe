"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

type AnimatedTextProps = {
  text: string;
  as?: "span" | "p" | "h1" | "h2" | "h3" | "div";
  className?: string;
  style?: CSSProperties;
  mode?: "words" | "letters";
  delay?: number;
  step?: number;
  onComplete?: () => void;
};

export default function AnimatedText({
  text,
  as: Tag = "span",
  className,
  style,
  mode = "words",
  delay = 0,
  step = 60,
  onComplete,
}: AnimatedTextProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [started, setStarted] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setStarted(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    const units = mode === "letters" ? Array.from(text) : text.split(/\s+/);
    const timer = window.setTimeout(() => {
      setComplete(true);
      onComplete?.();
    }, delay + units.length * step + step * 2);
    return () => window.clearTimeout(timer);
  }, [started, mode, text, delay, step, onComplete]);

  const units = mode === "letters" ? Array.from(text) : text.split(/\s+/);
  const nodes = units.map((unit, i) => {
    const key = `${unit}-${i}`;
    if (mode === "letters") {
      if (unit === " ") {
        return <span key={key} className="at-space" />;
      }
      return (
        <span key={key} className="at-letter" style={{ transitionDelay: `${delay + i * step}ms` }}>
          {unit}
        </span>
      );
    }
    return (
      <span key={key} className="at-word" style={{ transitionDelay: `${delay + i * step}ms` }}>
        {unit}
        {i < units.length - 1 ? "\u00A0" : ""}
      </span>
    );
  });

  return (
    <Tag
      ref={ref as never}
      className={`at-text${started ? " at-started" : ""}${complete ? " at-complete" : ""}${className ? ` ${className}` : ""}`}
      style={style}
      aria-label={text}
    >
      {nodes}
    </Tag>
  );
}
