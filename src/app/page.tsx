"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import MusicWidget from "@/components/MusicWidget";

/* ---------------- Inline SVG icons — no packages, no emoji ---------------- */

function IconSparkles({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.8 5.2a2 2 0 0 0 1.3 1.3l5.2 1.8-5.2 1.8a2 2 0 0 0-1.3 1.3L12 19.6l-1.8-5.2a2 2 0 0 0-1.3-1.3L3.7 11.3l5.2-1.8a2 2 0 0 0 1.3-1.3L12 3z" />
    </svg>
  );
}

function IconMusic({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function IconYoutube({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="4" />
      <path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconArrow({ className = "" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function IconLoop({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function IconChart({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10" />
      <path d="M12 20V4" />
      <path d="M6 20v-6" />
    </svg>
  );
}

function IconLayers({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */

const STORAGE_KEY = "looperPlatform";
type Platform = "spotify" | "youtube";

const PLATFORMS: {
  key: Platform;
  name: string;
  desc: string;
  points: string[];
  icon: (p: { className?: string }) => React.ReactElement;
}[] = [
  {
    key: "spotify",
    name: "Spotify",
    desc: "Full-catalog playback on a Premium account.",
    points: [
      "Streams count for the artist",
      "Search any song ever recorded",
      "Setlists & repeat engine",
    ],
    icon: IconMusic,
  },
  {
    key: "youtube",
    name: "YouTube",
    desc: "Zero sign-in. Official uploads & audio channels.",
    points: [
      "No account needed",
      "Views count toward the artist",
      "Perfect for unsigned acts",
    ],
    icon: IconYoutube,
  },
];

const FEATURES: {
  icon: (p: { className?: string }) => React.ReactElement;
  title: string;
  desc: string;
}[] = [
  { icon: IconLoop, title: "Smart looping", desc: "Hang one song or rotate a full setlist" },
  { icon: IconChart, title: "Play counting", desc: "Every completed play tracked for the report" },
  { icon: IconLayers, title: "Dual platform", desc: "Spotify streams or YouTube views" },
];

export default function Home() {
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved === "spotify" || saved === "youtube") {
        setSelectedPlatform(saved);
      }
    } catch {
      // storage unavailable — stay on landing
    }
  }, []);

  function choosePlatform(platform: Platform) {
    try {
      sessionStorage.setItem(STORAGE_KEY, platform);
    } catch {
      // ignore
    }
    setSelectedPlatform(platform);
  }

  function exitToHome() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setSelectedPlatform(null);
  }

  if (selectedPlatform) {
    return <MusicWidget initialPlatform={selectedPlatform} onExit={exitToHome} />;
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-16">
      {/* Ambient background */}
      <div className="pointer-events-none absolute left-1/2 top-[-25%] h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-red-600/[0.08] blur-[130px]" />
      <div className="pointer-events-none absolute bottom-[-30%] left-[-10%] h-[400px] w-[600px] rounded-full bg-red-600/[0.04] blur-[120px]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:52px_52px] [mask-image:radial-gradient(ellipse_55%_55%_at_50%_45%,black,transparent)]" />

      <div className="relative z-10 flex w-full max-w-4xl flex-col items-center">
        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-col items-center text-center"
        >
          <div className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-400">
              Music widget for events
            </span>
          </div>
          <h1 className="text-7xl font-light tracking-tighter text-white md:text-9xl">
            Looper<span className="text-red-600">.</span>
          </h1>
          <p className="mt-6 max-w-md text-balance text-lg leading-relaxed text-neutral-400">
            Loop tracks. Count plays. Give every artist the streams they earned.
          </p>
        </motion.div>

        {/* Platform cards */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.7 }}
          className="mt-16 grid w-full max-w-2xl grid-cols-1 gap-4 md:grid-cols-2"
        >
          {PLATFORMS.map((p) => (
            <motion.button
              key={p.key}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => choosePlatform(p.key)}
              className="group rounded-3xl border border-white/[0.08] bg-white/[0.02] p-7 text-left transition-colors duration-300 hover:border-red-600/40 hover:bg-white/[0.03]"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-600/20 bg-red-600/10">
                  <p.icon className="h-6 w-6 text-red-500" />
                </div>
                <IconArrow className="h-5 w-5 text-neutral-700 transition-all duration-300 group-hover:translate-x-1 group-hover:text-red-500" />
              </div>
              <h3 className="mt-6 text-2xl font-medium tracking-tight text-white">
                {p.name}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-500">{p.desc}</p>
              <ul className="mt-5 space-y-2">
                {p.points.map((pt) => (
                  <li key={pt} className="flex items-center gap-2.5 text-xs text-neutral-400">
                    <span className="h-1 w-1 flex-shrink-0 rounded-full bg-red-600/70" />
                    {pt}
                  </li>
                ))}
              </ul>
              <div className="mt-7 text-sm font-medium text-red-500">
                Enter {p.name}
              </div>
            </motion.button>
          ))}
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="mt-20 grid w-full max-w-3xl grid-cols-1 gap-10 md:grid-cols-3"
        >
          {FEATURES.map((f) => (
            <div key={f.title} className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03]">
                <f.icon className="h-5 w-5 text-red-500" />
              </div>
              <h3 className="text-sm font-medium text-white">{f.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-neutral-500">{f.desc}</p>
            </div>
          ))}
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-20 text-[11px] uppercase tracking-[0.25em] text-neutral-700"
        >
          Spotify · YouTube · Built for live events
        </motion.p>
      </div>
    </main>
  );
}