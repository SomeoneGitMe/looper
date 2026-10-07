"use client";

import { useCallback, useRef, useState } from "react";
import LooperWidget from "./LooperWidget";
import YouTubeWidget from "./YouTubeWidget";

export default function MusicWidget() {
  const [platform, setPlatform] = useState<"spotify" | "youtube">("spotify");

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

  const pill = (active: boolean) =>
    `rounded-full px-6 py-2 text-sm font-semibold transition ${
      active
        ? "bg-red-600 text-white shadow-[0_0_16px_rgba(220,38,38,0.4)]"
        : "text-neutral-500 hover:text-neutral-200"
    }`;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-4 flex justify-center">
        <div className="flex gap-1 rounded-full border border-red-900/40 bg-[#0c0c0c] p-1">
          <button
            onClick={() => setPlatform("spotify")}
            className={pill(platform === "spotify")}
          >
            Spotify
          </button>
          <button
            onClick={() => setPlatform("youtube")}
            className={pill(platform === "youtube")}
          >
            YouTube
          </button>
        </div>
      </div>

      <div className={platform === "spotify" ? "" : "hidden"}>
        <LooperWidget
          onPauseReady={registerSpotifyPause}
          pauseOther={pauseYouTube}
        />
      </div>
      <div className={platform === "youtube" ? "" : "hidden"}>
        <YouTubeWidget
          onPauseReady={registerYouTubePause}
          pauseOther={pauseSpotify}
        />
      </div>
    </div>
  );
}