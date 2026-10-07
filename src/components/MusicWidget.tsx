"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { signIn, signOut, useSession } from "next-auth/react";
import LooperWidget from "./LooperWidget";
import YouTubeWidget from "./YouTubeWidget";

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

  // Keep the stored choice in sync so the Spotify login round-trip
  // lands back on the same platform
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

  const pillButton = (active: boolean) =>
    `relative flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
      active ? "text-white" : "text-neutral-500 hover:text-neutral-200"
    }`;

  return (
    <div className="relative min-h-screen">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.10),transparent_60%)]" />

      <div className="relative z-10 mx-auto w-full max-w-2xl px-4 pb-10 pt-6 md:px-6">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 flex flex-wrap items-center justify-between gap-3"
        >
          <button
            onClick={onExit}
            title="Back to home"
            className="flex items-center gap-3 rounded-xl px-2 py-1 transition-colors hover:bg-neutral-900"
          >
            <div className="rounded-lg border border-red-600/30 bg-red-600/10 p-2">
              <IconSparkles className="h-5 w-5 text-red-500" />
            </div>
            <span className="bg-gradient-to-br from-red-500 to-red-900 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
              Looper
            </span>
          </button>

          {/* Platform toggle */}
          <div className="flex items-center gap-1 rounded-full border border-red-900/40 bg-black/60 p-1 backdrop-blur">
            <button
              onClick={() => setPlatform("spotify")}
              className={pillButton(platform === "spotify")}
            >
              {platform === "spotify" && (
                <motion.div
                  layoutId="looper-pill"
                  className="absolute inset-0 rounded-full bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.4)]"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <IconMusic className="relative z-10 h-4 w-4" />
              <span className="relative z-10">Spotify</span>
            </button>

            <button
              onClick={() => setPlatform("youtube")}
              className={pillButton(platform === "youtube")}
            >
              {platform === "youtube" && (
                <motion.div
                  layoutId="looper-pill"
                  className="absolute inset-0 rounded-full bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.4)]"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <IconYoutube className="relative z-10 h-4 w-4" />
              <span className="relative z-10">YouTube</span>
            </button>
          </div>

          {status === "authenticated" && platform === "spotify" && (
            <button
              onClick={() => signOut()}
              className="rounded-full border border-red-900/40 px-4 py-2 text-xs text-neutral-500 transition-colors hover:border-red-600/60 hover:text-neutral-200"
            >
              Sign out
            </button>
          )}
        </motion.header>

        {/* Panes — both stay mounted so state survives switching */}
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
/* Sleek inline Spotify connect screen — shown when someone slides    */
/* into Spotify mode without being signed in                           */
/* ------------------------------------------------------------------ */

function SpotifyConnectCard({ loading }: { loading: boolean }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-red-900/40 bg-gradient-to-b from-[#160a0a] to-[#0c0c0c] p-8 text-center"
    >
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-red-600/30 bg-red-600/10">
        <IconMusic className="h-8 w-8 text-red-500" />
      </div>
      <h2 className="text-2xl font-semibold text-white">Connect Spotify</h2>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-neutral-400">
        Spotify playback runs on your account, so every loop counts as a real
        stream for the artist. A Premium account is required for playback
        control.
      </p>
      <button
        onClick={() => signIn("spotify", { callbackUrl: "/" })}
        disabled={loading}
        className="mt-6 rounded-xl bg-red-600 px-8 py-3 text-sm font-semibold text-white shadow-[0_0_25px_rgba(220,38,38,0.35)] transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? "Connecting…" : "Connect Spotify"}
      </button>
      <p className="mt-4 text-xs text-neutral-600">
        Prefer not to sign in? Switch to YouTube — no account needed.
      </p>
    </motion.section>
  );
}