"use client";

import { useEffect, useRef, useState } from "react";

// Streamed from R2 via /api/love-song (byte-range friendly for mobile).
// Override with NEXT_PUBLIC_LOVE_SONG_URL at build time if you prefer a
// different hosted file.
const SONG_SRC = process.env.NEXT_PUBLIC_LOVE_SONG_URL || "/api/love-song";
const TARGET_VOLUME = 0.7;

export default function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const clearFade = () => {
    if (fadeRef.current !== null) {
      window.clearInterval(fadeRef.current);
      fadeRef.current = null;
    }
  };

  const fadeTo = (target: number, done?: () => void) => {
    const audio = audioRef.current;
    if (!audio) return;
    clearFade();
    const step = (target - audio.volume) / 18;
    if (Math.abs(step) < 0.001) {
      audio.volume = target;
      done?.();
      return;
    }
    fadeRef.current = window.setInterval(() => {
      const a = audioRef.current;
      if (!a) {
        clearFade();
        return;
      }
      const next = a.volume + step;
      if ((step > 0 && next >= target) || (step < 0 && next <= target)) {
        a.volume = target;
        clearFade();
        done?.();
      } else {
        a.volume = Math.max(0, Math.min(1, next));
      }
    }, 40);
  };

  const start = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    setUnavailable(false);
    try {
      audio.volume = 0;
      await audio.play();
      setPlaying(true);
      fadeTo(TARGET_VOLUME);
    } catch {
      setUnavailable(true);
      setPlaying(false);
    }
  };

  const stop = () => {
    const audio = audioRef.current;
    if (!audio) return;
    fadeTo(0, () => audio.pause());
    setPlaying(false);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onError = () => {
      setUnavailable(true);
      setPlaying(false);
    };
    const onPause = () => setPlaying(false);
    audio.addEventListener("error", onError);
    audio.addEventListener("pause", onPause);
    return () => {
      clearFade();
      audio.removeEventListener("error", onError);
      audio.removeEventListener("pause", onPause);
    };
  }, []);

  const label = unavailable ? "add our song" : playing ? "our song" : "Play our song";

  return (
    <>
      <audio ref={audioRef} src={SONG_SRC} loop playsInline preload="metadata" aria-hidden="true" />
      <button
        type="button"
        onClick={() => (playing ? stop() : void start())}
        className={`love-audio${playing ? " is-playing" : ""}${unavailable ? " is-unavailable" : ""}`}
        aria-label={unavailable ? "Our song is not available yet" : playing ? "Pause our song" : "Play our song"}
        title={unavailable ? "Add public/girls-like-you.mp3 to enable the music" : undefined}
      >
        <span className="love-audio-bars" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="love-audio-label">{label}</span>
        <span className="love-audio-note" aria-hidden="true">
          {unavailable ? "♪" : "♫"}
        </span>
      </button>
    </>
  );
}
