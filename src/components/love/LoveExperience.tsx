"use client";

import { useEffect, useState } from "react";
import RomanticCanvas from "./RomanticCanvas";
import PasswordGate from "./PasswordGate";
import LoveStory from "./LoveStory";
import BurstLayer from "./BurstLayer";
import CursorTrail from "./CursorTrail";
import AudioPlayer from "./AudioPlayer";

export function LoveExperience() {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    const prevHtmlBg = document.documentElement.style.backgroundColor;
    const prevBodyBg = document.body.style.backgroundColor;
    document.documentElement.style.backgroundColor = "#0b0612";
    document.body.style.backgroundColor = "#0b0612";
    document.body.classList.add("love-mode");
    return () => {
      document.documentElement.style.backgroundColor = prevHtmlBg;
      document.body.style.backgroundColor = prevBodyBg;
      document.body.classList.remove("love-mode");
    };
  }, []);

  useEffect(() => {
    if (unlocked) {
      document.body.style.overflow = "";
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    } else {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [unlocked]);

  return (
    <div className="love-experience">
      <RomanticCanvas />
      <div className="love-vignette" aria-hidden="true" />

      {!unlocked ? <PasswordGate onUnlocked={() => setUnlocked(true)} /> : <LoveStory />}

      <CursorTrail active={unlocked} />
      {unlocked && <AudioPlayer />}
      <BurstLayer />
    </div>
  );
}
