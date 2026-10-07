"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { signIn, signOut, useSession } from "next-auth/react";
import LooperWidget from "./LooperWidget";
import YouTubeWidget from "./YouTubeWidget";

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

type Platform = "spotify" | "youtube";
const STORAGE_KEY = "looperPlatform";

export default function MusicWidget({
  initialPlatform = "spotify",
  onExit,
}: {
  initialPlatform?: Platform;
  onExit?: () => void;
}) {
  const { status } = useSession();
  const [platform, setPlatform] = useState<Platform>(initialPlatform);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, platform);
    } catch {
      // ignore
    }
  }, [platform]);

  const spotifyPauseRef = useRef<() => void>(() => {});
  const youtubePauseRef = useRef<() => void>(() => {});

  const registerSpotifyPause = useCallback((fn: () => void) => {
    spotifyPauseRef.current = fn;
  }, []);
  const registerYouTubePause = useCallback((fn: () => void) => {
    youtubePauseRef.current = fn;
  }, []);
  const pauseYouTube = useCallback(() => youtubePauseRef.current(), []);
  const pauseSpotify = useCallback(() => spotifyPauseRef.current(), []);

  return (
    <div className="relative min-h-screen">
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.09),transparent_65%)]" />

      {/* Sticky header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-black/70 backdrop-blur-xl">
        <div className="mx-auto grid h-16 max-w-3xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 md:px-6">
          <button
            onClick={onExit}
            title="Back to home"
            className="group flex items-center gap-3 rounded-xl px-1 py-1"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-600/25 bg-red-600/10 transition-colors group-hover:bg-red-600/20">
              <IconSparkles className="h-[18px] w-[18px] text-red-500" />
            </div>
            <span className="bg-gradient-to-br from-red-500 to-red-800 bg-clip-text text-xl font-semibold tracking-tight text-transparent">
              Looper
            </span>
          </button>

          <div className="flex justify-center">
            <div className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] p-1">
              <button
                onClick={() => setPlatform("spotify")}
                className={`relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors sm:px-5 ${
                  platform === "spotify"
                    ? "text-white"
                    : "text-neutral-500 hover:text-neutral-200"
                }`}
              >
                {platform === "spotify" && (
                  <motion.span
                    layoutId="platform-pill"
                    className="absolute inset-0 rounded-full bg-red-600 shadow-[0_0_18px_rgba(220,38,38,0.4)]"
                    transition={{ type: "spring", stiffness: 320, damping: 30 }}
                  />
                )}
                <IconMusic className="relative z-10 h-4 w-4" />
                <span className="relative z-10 hidden sm:inline">Spotify</span>
              </button>

              <button
                onClick={() => setPlatform("youtube")}
                className={`relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors sm:px-5 ${
                  platform === "youtube"
                    ? "text-white"
                    : "text-neutral-500 hover:text-neutral-200"
                }`}
              >
                {platform === "youtube" && (
                  <motion.span
                    layoutId="platform-pill"
                    className="absolute inset-0 rounded-full bg-red-600 shadow-[0_0_18px_rgba(220,38,38,0.4)]"
                    transition={{ type: "spring", stiffness: 320, damping: 30 }}
                  />
                )}
                <IconYoutube className="relative z-10 h-4 w-4" />
                <span className="relative z-10 hidden sm:inline">YouTube</span>
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            {status === "authenticated" && platform === "spotify" ? (
              <button
                onClick={() => signOut()}
                className="rounded-full px-3 py-2 text-xs text-neutral-500 transition-colors hover:text-neutral-200"
              >
                Sign out
              </button>
            ) : (
              <span className="w-1" />
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="relative z-10 mx-auto w-full max-w-3xl space-y-8 px-4 pb-16 pt-8 md:px-6">
        <div className={platform === "spotify" ? "" : "hidden"}>
          {status === "authenticated" ? (
            <LooperWidget
              onPauseReady={registerSpotifyPause}
              pauseOther={pauseYouTube}
            />
          ) : (
            <SpotifyConnectCard loading={status === "loading"} />
          )}
        </div>

        <div className={platform === "youtube" ? "" : "hidden"}>
          <YouTubeWidget
            onPauseReady={registerYouTubePause}
            pauseOther={pauseSpotify}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Spotify connect screen — shown when sliding into Spotify mode      */
/* without being signed in                                            */
/* ------------------------------------------------------------------ */

function SpotifyConnectCard({ loading }: { loading: boolean }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="animate-fade-up rounded-3xl border border-white/[0.06] bg-white/[0.02] px-8 py-14 text-center"
    >
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-red-600/25 bg-red-600/10">
        <IconMusic className="h-7 w-7 text-red-500" />
      </div>
      <h2 className="text-2xl font-medium tracking-tight text-white">
        Connect Spotify
      </h2>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-neutral-500">
        Spotify playback runs on your account, so every loop counts as a real
        stream for the artist. A Premium account is required for playback
        control.
      </p>
      <button
        onClick={() => signIn("spotify", { callbackUrl: "/" })}
        disabled={loading}
        className="mt-8 rounded-full bg-red-600 px-9 py-3.5 text-sm font-semibold text-white shadow-[0_0_30px_rgba(220,38,38,0.3)] transition-all hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? "Connecting…" : "Connect Spotify"}
      </button>
      <p className="mt-6 text-xs text-neutral-600">
        No account? Switch to YouTube — zero sign-in.
      </p>
    </motion.section>
  );
}