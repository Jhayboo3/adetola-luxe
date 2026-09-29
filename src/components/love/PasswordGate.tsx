"use client";

import { useRef, useState, type FormEvent } from "react";
import { emitBurst } from "./loveEvents";
import { HeartIcon, SparkleIcon } from "./icons";

// The secret words are verified through FNV-1a hashes so the plain words never
// appear in source. Case-insensitive by construction (hashed lowercase).
const SECRETS: { length: number; hash: number }[] = [
  { length: 10, hash: 430965363 },
  { length: 8, hash: 748361661 },
  { length: 6, hash: 3282855721 },
];

function fnv1a(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function isSecret(input: string): boolean {
  const value = input.trim().toLowerCase();
  const hash = value.length > 0 ? fnv1a(value) : 0;
  return SECRETS.some((secret) => value.length === secret.length && hash === secret.hash);
}

export default function PasswordGate({ onUnlocked }: { onUnlocked: () => void }) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "wrong" | "unlocking">("idle");
  const [message, setMessage] = useState("");
  const [wrong, setWrong] = useState(false);
  const wrongTimer = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (status === "unlocking") return;

    if (!isSecret(value)) {
      const rect = cardRef.current?.getBoundingClientRect();
      const x = (rect?.left ?? window.innerWidth / 2) + (rect?.width ?? 0) / 2;
      const y = (rect?.top ?? window.innerHeight / 2) + (rect?.height ?? 0) / 2;
      setStatus("wrong");
      setMessage("Hmm... that's not the secret word \u2764\uFE0F Try again.");
      if (wrongTimer.current) window.clearTimeout(wrongTimer.current);
      setWrong(false);
      requestAnimationFrame(() => setWrong(true));
      wrongTimer.current = window.setTimeout(() => setWrong(false), 620);
      emitBurst({ x, y, count: 10, spread: 70, kind: "glow", scale: 0.55 });
      return;
    }

    if (wrongTimer.current) window.clearTimeout(wrongTimer.current);
    setWrong(false);
    setStatus("unlocking");
    setMessage("");
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    emitBurst({
      x: cx,
      y: cy,
      count: 70,
      spread: Math.max(window.innerWidth, window.innerHeight) * 0.55,
      kind: "hearts",
      scale: 1.2,
    });
    window.setTimeout(() => onUnlocked(), 1350);
  };

  return (
    <div className="gate" role="presentation">
      <div className="gate-blob gate-blob--a" aria-hidden="true" />
      <div className="gate-blob gate-blob--b" aria-hidden="true" />

      <div className="gate-sparkle gate-sparkle--1" aria-hidden="true">
        <SparkleIcon />
      </div>
      <div className="gate-sparkle gate-sparkle--2" aria-hidden="true">
        <SparkleIcon />
      </div>
      <div className="gate-sparkle gate-sparkle--3" aria-hidden="true">
        <SparkleIcon />
      </div>
      <div className="gate-sparkle gate-sparkle--4" aria-hidden="true">
        <SparkleIcon />
      </div>

      {status === "unlocking" && <div className="gate-flash" aria-hidden="true" />}

      <div className="gate-content" role="main" aria-label="Unlock your surprise">
        <div ref={cardRef} className={`gate-card${status === "unlocking" ? " is-unlocking" : ""}`}>
          <div className="gate-glow" aria-hidden="true" />
          <p className="gate-eyebrow">
            <span className="gate-eyebrow-heart">
              <HeartIcon />
            </span>
            for my love
          </p>

          <h1 className="gate-title">
            <span className="gate-title-line">A little surprise</span>
            <span className="gate-title-line gate-title-line--accent">for you</span>
            <span className="gate-title-heart" aria-hidden="true">
              <HeartIcon />
            </span>
          </h1>

          <p className="gate-subtitle">Enter the secret word to unlock it.</p>

          <form className="gate-form" onSubmit={handleSubmit} noValidate>
            <div className={`gate-input-wrap${wrong ? " is-wrong" : ""}`}>
              <span className="gate-input-icon" aria-hidden="true">
                <HeartIcon />
              </span>
              <input
                className="gate-input"
                type="password"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (message) setMessage("");
                }}
                placeholder="the secret word..."
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                aria-label="Secret word"
                disabled={status === "unlocking"}
              />
              <button type="submit" className="gate-submit" disabled={status === "unlocking"} aria-label="Unlock">
                <HeartIcon />
              </button>
            </div>

            <div className={`gate-message${message ? " is-shown" : ""}`} role="alert">
              {message && <span>{message}</span>}
            </div>
          </form>

          <p className="gate-hint">only you have this key</p>
        </div>
      </div>
    </div>
  );
}
