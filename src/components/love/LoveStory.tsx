"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Reveal from "./Reveal";
import AnimatedText from "./AnimatedText";
import { emitBurst } from "./loveEvents";
import { HeartIcon } from "./icons";

function useInView(threshold = 0.35) {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

function Ornament({ label }: { label: string }) {
  return (
    <div className="love-ornament" aria-hidden="true">
      <span className="love-ornament-line" />
      <span className="love-ornament-chap">{label}</span>
      <HeartIcon className="love-ornament-heart" />
      <span className="love-ornament-line" />
    </div>
  );
}

function StoryIntro() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const timers = [
      window.setTimeout(() => setStage(1), 500),
      window.setTimeout(() => setStage(2), 2900),
      window.setTimeout(() => setStage(3), 5700),
      window.setTimeout(() => setStage(4), 9000),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  const scrollToBegin = () => {
    document.getElementById("love-begin")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="love-intro">
      <div className="love-intro-inner">
        <p className={`intro-line intro-line--eyebrow${stage >= 1 ? " is-in" : ""}`}>a letter, written for you</p>

        <p className={`intro-line intro-line--title${stage >= 1 ? " is-in" : ""}`}>Hey, my love...</p>

        <p className={`intro-line intro-line--sub${stage >= 2 ? " is-in" : ""}`}>I made something just for you.</p>

        <p className={`intro-line intro-line--long${stage >= 3 ? " is-in" : ""}`}>
          Because sometimes, I don&apos;t think words are enough to explain how much you mean to me.
        </p>

        <button
          type="button"
          className={`intro-continue${stage >= 4 ? " is-in" : ""}`}
          onClick={scrollToBegin}
          aria-label="Continue to your letter"
        >
          <span className="intro-continue-text">keep reading</span>
          <span className="intro-continue-chevron" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4v16m0 0-6-6m6 6 6-6" />
            </svg>
          </span>
        </button>
      </div>
    </section>
  );
}

function SectionOne() {
  return (
    <section className="love-section">
      <div className="love-section-inner">
        <Reveal variant="soft">
          <Ornament label="one" />
        </Reveal>
        <Reveal variant="fade-up" delay={180}>
          <p className="love-lead">You are one of the most beautiful parts of my life.</p>
        </Reveal>
        <Reveal variant="fade" delay={700}>
          <p className="love-caption">I mean that in the truest sense — not just the way you look, but the way you are.</p>
        </Reveal>
      </div>
    </section>
  );
}

function SectionTwo() {
  const hearts = [
    { top: "18%", left: "8%", size: 22, delay: 0, dur: 9 },
    { top: "70%", left: "12%", size: 14, delay: 1.4, dur: 8 },
    { top: "30%", left: "82%", size: 18, delay: 0.7, dur: 10 },
    { top: "76%", left: "80%", size: 24, delay: 2.1, dur: 9.5 },
    { top: "12%", left: "60%", size: 12, delay: 1.8, dur: 7.5 },
    { top: "62%", left: "48%", size: 10, delay: 0.3, dur: 8.5 },
  ];
  return (
    <section className="love-section">
      <div className="love-section-inner">
        {hearts.map((h, i) => (
          <span
            key={i}
            className="floaty-heart"
            aria-hidden="true"
            style={{
              top: h.top,
              left: h.left,
              width: h.size,
              height: h.size,
              animationDelay: `${h.delay}s`,
              animationDuration: `${h.dur}s`,
            }}
          >
            <HeartIcon />
          </span>
        ))}
        <Reveal variant="fade-up">
          <Ornament label="two" />
        </Reveal>
        <Reveal variant="fade-up" delay={220}>
          <p className="love-lead">I love the way you make ordinary moments feel special.</p>
        </Reveal>
        <Reveal variant="fade" delay={820}>
          <p className="love-caption">A quiet evening, a silly joke, the simplest of days — with you, they all shimmer.</p>
        </Reveal>
      </div>
    </section>
  );
}

function SectionThree() {
  return (
    <section className="love-section">
      <div className="love-section-inner love-section-inner--stacked">
        <Reveal variant="soft">
          <Ornament label="three" />
        </Reveal>
        <div className="love-stack">
          <AnimatedText as="span" text="I love your smile." delay={150} step={90} />
          <AnimatedText as="span" text="Your presence." delay={750} step={90} />
          <AnimatedText as="span" text="Your little ways." delay={1350} step={90} />
          <AnimatedText as="span" text="The things you probably don't even realize I notice." delay={2000} step={70} />
        </div>
        <Reveal variant="fade" delay={2800}>
          <p className="love-caption">I notice them all. Every single one. I always have.</p>
        </Reveal>
      </div>
    </section>
  );
}

function SectionFour() {
  const [ref, inView] = useInView(0.4);
  const [second, setSecond] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!inView) return;
    const t = window.setTimeout(() => setSecond(true), 1200);
    return () => window.clearTimeout(t);
  }, [inView]);

  useEffect(() => {
    if (!second) return;
    const el = sectionRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    emitBurst({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      count: 54,
      spread: Math.max(rect.width, rect.height) * 0.5,
      kind: "mix",
      scale: 1.1,
    });
  }, [second]);

  return (
    <section
      ref={(node) => {
        sectionRef.current = node;
        ref.current = node;
      }}
      className={`love-section love-section--dramatic${second ? " is-dramatic" : ""}`}
    >
      <div className="love-dramatic-light" aria-hidden="true" />
      <div className="love-section-inner">
        <Reveal variant="fade-up" delay={0}>
          <Ornament label="four" />
        </Reveal>
        <Reveal variant="fade-up" delay={200}>
          <p className="love-lead love-lead--ask">And if I had to choose you all over again...</p>
        </Reveal>
        {second && (
          <div className="love-choice stage-in">
            <p className="love-choice-line">I would still choose you.</p>
            <span className="love-choice-heart" aria-hidden="true">
              <HeartIcon />
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

function Finale() {
  const [ref, inView] = useInView(0.35);
  const [stage, setStage] = useState(0);
  const [confetti, setConfetti] = useState(false);
  const finaleRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!inView) return;
    const timers = [
      window.setTimeout(() => setStage(1), 200),
      window.setTimeout(() => setStage(2), 1900),
      window.setTimeout(() => setStage(3), 3800),
      window.setTimeout(() => setStage(4), 5600),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [inView]);

  useEffect(() => {
    if (stage < 4) return;
    const el = finaleRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    emitBurst({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height * 0.5,
      count: 80,
      spread: Math.max(window.innerWidth, rect.height) * 0.5,
      kind: "hearts",
      scale: 1.25,
    });
    setConfetti(true);
    const t = window.setTimeout(() => setConfetti(false), 3600);
    return () => window.clearTimeout(t);
  }, [stage]);

  const confettiHearts = Array.from({ length: 26 }, (_, i) => ({
    left: `${(i * 37) % 100}%`,
    delay: `${(i % 7) * 0.12}s`,
    dur: `${2.6 + (i % 5) * 0.4}s`,
    size: 10 + ((i * 7) % 16),
  }));

  return (
    <section
      ref={(node) => {
        finaleRef.current = node;
        ref.current = node;
      }}
      className={`love-section love-section--finale${stage >= 4 ? " is-burst" : ""}`}
    >
      {confetti && (
        <div className="love-confetti" aria-hidden="true">
          {confettiHearts.map((h, i) => (
            <span key={i} className="love-confetti-heart" style={{ left: h.left, animationDelay: h.delay, animationDuration: h.dur, width: h.size, height: h.size }}>
              <HeartIcon />
            </span>
          ))}
        </div>
      )}
      <div className="love-finale-burst" aria-hidden="true" />

      <div className="love-section-inner">
        <Reveal variant="fade-up" delay={0}>
          <p className="love-lead">If I could give you one thing...</p>
        </Reveal>
        {stage >= 2 && <p className="love-lead love-lead--soft stage-in">I&apos;d give you the ability to see yourself through my eyes.</p>}
        {stage >= 3 && <p className="love-caption love-caption--final stage-in">Maybe then you&apos;d finally understand how incredibly special you are to me.</p>}
        {stage >= 4 && (
          <div className="iloveyou stage-in">
            <span className="iloveyou-hearts iloveyou-hearts--l" aria-hidden="true">
              <HeartIcon />
            </span>
            <span className="iloveyou-text">I LOVE YOU</span>
            <span className="iloveyou-hearts iloveyou-hearts--r" aria-hidden="true">
              <HeartIcon />
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

function FinalMessage() {
  const [ref, inView] = useInView(0.3);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const timers = [
      window.setTimeout(() => setStage(1), 250),
      window.setTimeout(() => setStage(2), 2100),
      window.setTimeout(() => setStage(3), 4300),
      window.setTimeout(() => setStage(4), 6100),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [inView]);

  return (
    <section
      ref={(node) => {
        ref.current = node;
      }}
      className="love-section love-section--final"
    >
      <div className="love-section-inner">
        {stage >= 1 && <p className="love-lead love-lead--final stage-in">This little corner of the internet is just for you.</p>}
        {stage >= 2 && <p className="love-caption stage-in">No matter how many times you read this, I hope you always remember one thing...</p>}
        {stage >= 3 && (
          <p className="love-truth stage-in">
            You are <em>loved</em>. Deeply, genuinely, completely.
          </p>
        )}
        {stage >= 4 && (
          <div className="forever stage-in">
            <p className="forever-line">Forever yours</p>
            <span className="forever-heart" aria-hidden="true">
              <HeartIcon />
            </span>
          </div>
        )}
      </div>
      {stage >= 4 && <p className="love-signoff stage-in">made with love, just for you</p>}
    </section>
  );
}

export default function LoveStory() {
  const handleTap = (e: ReactPointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button, input, a, .love-audio")) return;
    emitBurst({ x: e.clientX, y: e.clientY, count: 14, spread: 120, kind: "mix", scale: 0.85 });
  };

  return (
    <div className="love-story" onPointerDown={handleTap}>
      <StoryIntro />
      <div id="love-begin" className="love-begin-anchor" />
      <SectionOne />
      <SectionTwo />
      <SectionThree />
      <SectionFour />
      <Finale />
      <FinalMessage />
    </div>
  );
}
