"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

declare global {
  interface Window {
    Spotify: any;
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

// Swap for any song: desktop Spotify → right-click track → Share → Copy Spotify URI
const TEST_TRACK = "spotify:track:4uLU6hMCjMI75M1A2tKUQC";

export default function PlayerTest() {
  const { data: session } = useSession();
  const [status, setStatus] = useState("Loading Spotify player…");
  const deviceIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!session?.accessToken) return;

    const initPlayer = () => {
      const player = new window.Spotify.Player({
        name: "Looper Widget",
        getOAuthToken: (cb: (t: string) => void) => cb(session.accessToken!),
        volume: 0.5,
      });

      player.addListener("ready", ({ device_id }: any) => {
        deviceIdRef.current = device_id;
        setStatus("Player ready");
      });

      player.addListener("not_ready", () => {
        deviceIdRef.current = null;
        setStatus("Player disconnected");
      });

      player.connect();
    };

    if (window.Spotify) {
      initPlayer();
      return;
    }

    window.onSpotifyWebPlaybackSDKReady = initPlayer;
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);
  }, [session?.accessToken]);

  async function playTest() {
    const deviceId = deviceIdRef.current;
    if (!deviceId) return;
    setStatus("Starting playback…");
    const res = await fetch("/api/spotify/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, trackUri: TEST_TRACK }),
    });
    const data = await res.json();
    setStatus(
      res.ok ? "▶ Playing — check your speakers!" : `Error: ${JSON.stringify(data)}`
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm text-gray-400">{status}</p>
      <button
        onClick={playTest}
        disabled={!deviceIdRef.current}
        className="rounded-xl bg-red-600 px-6 py-2 font-semibold text-white transition hover:bg-red-700 disabled:opacity-40"
      >
        Play test track
      </button>
    </div>
  );
}