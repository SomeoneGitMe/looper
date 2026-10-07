"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import MusicWidget from "@/components/MusicWidget";

/* ------------------------------------------------------------------ */
/* Inline SVG icons — no icon package needed. Nothing to install.      */
/* ------------------------------------------------------------------ */

function IconSparkles({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l1.8 5.2a2 2 0 0 0 1.3 1.3l5.2 1.8-5.2 1.8a2 2 0 0 0-1.3 1.3L12 19.6l-1.8-5.2a2 2 0 0 0-1.3-1.3L3.7 11.3l5.2-1.8a2 2 0 0 0 1.3-1.3L12 3z" />
    </svg>
  );
}

function IconMusic({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function IconYoutube({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="5" width="20" height="14" rx="4" />
      <path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconArrow({ className = "" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

const STORAGE_KEY = "looperPlatform";
type Platform = "spotify" | "youtube";

const FEATURES = [
  { icon: "🔁", title: "Smart looping", desc: "Hang one song or rotate a setlist" },
  { icon: "📊", title: "Play counting", desc: "Every completed play tracked" },
  { icon: "🎚️", title: "Dual platform", desc: "Spotify streams or YouTube views" },
];

export default function Home() {
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);

  // Restore the choice after Spotify login bounces back to "/"
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
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-6">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.14),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(220,38,38,0.05),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_40%,black,transparent)]" />

      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center gap-12">
        {/* Brand */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="flex flex-col items-center gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="rounded-2xl border border-red-600/30 bg-red-600/10 p-3">
              <IconSparkles className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="bg-gradient-to-br from-red-500 to-red-900 bg-clip-text text-6xl font-bold tracking-tight text-transparent md:text-7xl">
              Looper
            </h1>
          </div>
          <p className="max-w-lg text-center text-lg text-neutral-400">
            Premium music widget for events. Loop tracks, count plays, and give
            every artist the streams they earned.
          </p>
        </motion.div>

        {/* Platform selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6 }}
          className="w-full max-w-md space-y-4"
        >
          <p className="text-center text-xs uppercase tracking-[0.3em] text-neutral-600">
            Choose your platform
          </p>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => choosePlatform("spotify")}
            className="group w-full overflow-hidden rounded-2xl border border-red-900/40 bg-gradient-to-b from-neutral-900 to-black p-6 text-left transition-colors duration-300 hover:border-red-600/60 hover:shadow-[0_0_40px_rgba(220,38,38,0.15)]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="rounded-xl bg-red-600/10 p-3 transition-colors group-hover:bg-red-600/20">
                  <IconMusic className="h-8 w-8 text-red-500" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Spotify mode</h3>
                  <p className="mt-1 text-sm text-neutral-400">
                    Premium account · full catalog · streams count
                  </p>
                </div>
              </div>
              <IconArrow className="h-6 w-6 text-red-500/40 transition-colors group-hover:text-red-500" />
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => choosePlatform("youtube")}
            className="group w-full overflow-hidden rounded-2xl border border-red-900/40 bg-gradient-to-b from-neutral-900 to-black p-6 text-left transition-colors duration-300 hover:border-red-600/60 hover:shadow-[0_0_40px_rgba(220,38,38,0.15)]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="rounded-xl bg-red-600/10 p-3 transition-colors group-hover:bg-red-600/20">
                  <IconYoutube className="h-8 w-8 text-red-500" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">YouTube mode</h3>
                  <p className="mt-1 text-sm text-neutral-400">
                    No sign-in · official uploads · views count
                  </p>
                </div>
              </div>
              <IconArrow className="h-6 w-6 text-red-500/40 transition-colors group-hover:text-red-500" />
            </div>
          </motion.button>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="grid w-full max-w-2xl grid-cols-1 gap-3 md:grid-cols-3"
        >
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + i * 0.1 }}
              className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 text-center"
            >
              <div className="mb-2 text-2xl">{f.icon}</div>
              <h4 className="font-medium text-white">{f.title}</h4>
              <p className="mt-1 text-xs text-neutral-500">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </main>
  );
}