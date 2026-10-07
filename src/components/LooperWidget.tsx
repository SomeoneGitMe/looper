"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";

declare global {
  interface Window {
    Spotify: any;
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

interface Track {
  uri: string;
  name: string;
  artists: string;
  album: string;
  albumArt: string;
  durationMs: number;
}

interface ArtistInfo {
  name: string;
  image: string;
  followers: number;
}

type RepeatMode = "off" | "track" | "context";
type StopMode = "never" | "plays" | "duration";

function fmtTime(ms: number): string {
  if (!ms || ms < 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-red-900/30 bg-[#0c0c0c] p-5">
      <div className="mb-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-red-500/80">
          {title}
        </h2>
        {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
        active
          ? "bg-red-600 text-white shadow-[0_0_12px_rgba(220,38,38,0.35)]"
          : "bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
      }`}
    >
      {children}
    </button>
  );
}

function TrackRow({
  track,
  onPlay,
  onAdd,
}: {
  track: Track;
  onPlay: () => void;
  onAdd?: () => void;
}) {
  return (
    <div className="group flex items-center gap-3 rounded-xl p-2 transition hover:bg-neutral-900/70">
      {track.albumArt ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={track.albumArt}
          alt=""
          className="h-11 w-11 flex-shrink-0 rounded-md object-cover"
        />
      ) : (
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md bg-neutral-800 text-neutral-600">
          ♪
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{track.name}</p>
        <p className="truncate text-xs text-neutral-400">
          {track.artists}
          {track.album ? ` · ${track.album}` : ""}
        </p>
      </div>
      <span className="text-xs text-neutral-500">{fmtTime(track.durationMs)}</span>
      <button
        onClick={onPlay}
        title="Play now"
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-red-600 text-sm text-white opacity-70 transition hover:bg-red-500 hover:opacity-100"
      >
        ▶
      </button>
      {onAdd && (
        <button
          onClick={onAdd}
          title="Add to setlist"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-red-900/40 text-sm text-neutral-400 opacity-70 transition hover:border-red-500 hover:text-white hover:opacity-100"
        >
          +
        </button>
      )}
    </div>
  );
}

export default function LooperWidget({
  onPauseReady,
  pauseOther,
}: {
  onPauseReady?: (fn: () => void) => void;
  pauseOther?: () => void;
}) {
  const { data: session } = useSession();

  // Live token ref — the player always reads the newest value
  const tokenRef = useRef<string | null>(null);
  const hasToken = !!session?.accessToken;

  useEffect(() => {
    tokenRef.current = session?.accessToken ?? null;
  }, [session?.accessToken]);

  // Player
  const [player, setPlayer] = useState<any>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const [playerStatus, setPlayerStatus] = useState("Connecting to Spotify…");

  // Now playing
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [paused, setPaused] = useState(true);
  const [volume, setVolume] = useState(0.5);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);

  // Artist
  const [artistInput, setArtistInput] = useState("");
  const [artist, setArtist] = useState<ArtistInfo | null>(null);
  const [artistTracks, setArtistTracks] = useState<Track[]>([]);
  const [loadingArtist, setLoadingArtist] = useState(false);

  // Setlist
  const [setlist, setSetlist] = useState<Track[]>([]);

  // Loop engine
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("track");
  const [stopMode, setStopMode] = useState<StopMode>("never");
  const [stopPlays, setStopPlays] = useState(5);
  const [stopHours, setStopHours] = useState(4);
  const [loopActive, setLoopActive] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [galaRemaining, setGalaRemaining] = useState<number | null>(null);
  const [status, setStatus] = useState("");

  // Refs read inside the polling interval (avoid stale closures)
  const lastPosRef = useRef(0);
  const playCountRef = useRef(0);
  const loopActiveRef = useRef(false);
  const stopModeRef = useRef<StopMode>("never");
  const stopPlaysRef = useRef(5);
  const galaEndsAtRef = useRef<number | null>(null);
  const repeatModeRef = useRef<RepeatMode>("track");

  useEffect(() => {
    stopModeRef.current = stopMode;
  }, [stopMode]);
  useEffect(() => {
    stopPlaysRef.current = stopPlays;
  }, [stopPlays]);
  useEffect(() => {
    loopActiveRef.current = loopActive;
  }, [loopActive]);
  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  // Register our pause function with the wrapper (platform coordination)
  useEffect(() => {
    if (!onPauseReady) return;
    onPauseReady(() => {
      try {
        player?.pause();
      } catch {
        // ignore
      }
    });
  }, [onPauseReady, player]);

  // ---- Web Playback SDK init (once per login; token read live from ref) ----
  useEffect(() => {
    if (!hasToken) return;

    let p: any = null;

    const initPlayer = () => {
      p = new window.Spotify.Player({
        name: "Looper Widget",
        getOAuthToken: (cb: (t: string) => void) => cb(tokenRef.current!),
        volume: 0.5,
      });

      p.addListener("ready", ({ device_id }: any) => {
        deviceIdRef.current = device_id;
        setDeviceId(device_id);
        setPlayerStatus("Widget is live");
      });

      p.addListener("not_ready", () => {
        deviceIdRef.current = null;
        setDeviceId(null);
        setPlayerStatus("Disconnected — refresh the page");
      });

      p.addListener("initialization_error", ({ message }: any) => {
        setPlayerStatus(`Player error: ${message}`);
      });

      p.addListener("authentication_error", ({ message }: any) => {
        setPlayerStatus(`Auth error: ${message}`);
      });

      p.connect();
      setPlayer(p);
    };

    if (window.Spotify) {
      initPlayer();
    } else {
      window.onSpotifyWebPlaybackSDKReady = initPlayer;
      const script = document.createElement("script");
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.async = true;
      document.body.appendChild(script);
    }

    return () => {
      try {
        p?.disconnect();
      } catch {
        // ignore
      }
    };
  }, [hasToken]);

  const stopLoop = useCallback(
    async (message: string) => {
      loopActiveRef.current = false;
      setLoopActive(false);
      galaEndsAtRef.current = null;
      setGalaRemaining(null);
      setStatus(message);
      try {
        await player?.pause();
      } catch {
        // ignore
      }
      const id = deviceIdRef.current;
      if (id) {
        await fetch("/api/spotify/play", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId: id, repeat: "off" }),
        }).catch(() => {});
      }
    },
    [player]
  );

  // ---- Polling: now playing UI + loop engine ----
  useEffect(() => {
    if (!player) return;

    const interval = setInterval(async () => {
      try {
        const state = await player.getCurrentState();
        if (!state) return;

        const t = state.track_window.current_track;
        setCurrentTrack({
          uri: t.uri,
          name: t.name,
          artists: t.artists.map((a: any) => a.name).join(", "),
          album: t.album.name,
          albumArt: t.album.images?.[0]?.url ?? "",
          durationMs: t.duration_ms,
        });
        setPosition(state.position);
        setDuration(state.duration);
        setPaused(state.paused);

        if (galaEndsAtRef.current !== null) {
          setGalaRemaining(galaEndsAtRef.current - Date.now());
        }

        // Wrap detection: position jumped backwards = a play completed
        if (!state.paused) {
          const last = lastPosRef.current;
          if (last > 10000 && state.position < last - 10000) {
            playCountRef.current += 1;
            setPlayCount(playCountRef.current);
          }
        }
        lastPosRef.current = state.position;

        // Stop conditions
        if (loopActiveRef.current) {
          if (
            stopModeRef.current === "plays" &&
            playCountRef.current >= stopPlaysRef.current
          ) {
            await stopLoop("Loop complete — reached play target");
          } else if (
            stopModeRef.current === "duration" &&
            galaEndsAtRef.current !== null &&
            Date.now() >= galaEndsAtRef.current
          ) {
            await stopLoop("Gala complete — playback stopped");
          }
        }
      } catch {
        // player state briefly unavailable — ignore
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [player, stopLoop]);

  // ---- Actions ----
  async function playTrack(track: Track) {
    const id = deviceIdRef.current;
    if (!id) {
      setStatus("Widget not connected yet — give it a second");
      return;
    }
    pauseOther?.();
    setStatus(`Starting “${track.name}”…`);
    const res = await fetch("/api/spotify/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: id,
        uris: [track.uri],
        repeat: repeatModeRef.current,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setStatus(`Now playing “${track.name}”`);
    } else {
      setStatus(`Playback error: ${JSON.stringify(data.error ?? data)}`);
    }
  }

  async function playSetlist() {
    const id = deviceIdRef.current;
    if (!id) {
      setStatus("Widget not connected yet — give it a second");
      return;
    }
    if (setlist.length === 0) {
      setStatus("Setlist is empty — add songs with the + button");
      return;
    }
    pauseOther?.();
    setStatus("Starting setlist…");
    const repeat = repeatModeRef.current === "off" ? "off" : "context";
    const res = await fetch("/api/spotify/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: id,
        uris: setlist.map((t) => t.uri),
        repeat,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setStatus(`Setlist rolling — ${setlist.length} tracks`);
    } else {
      setStatus(`Playback error: ${JSON.stringify(data.error ?? data)}`);
    }
  }

  // Repeat toggles — apply LIVE when music is playing
  async function selectRepeat(mode: RepeatMode) {
    setRepeatMode(mode);
    repeatModeRef.current = mode;

    const id = deviceIdRef.current;
    if (!id) return;

    if (mode === "track") {
      if (!currentTrack) return;
      await fetch("/api/spotify/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: id, repeat: "track" }),
      }).catch(() => {});
      setStatus(`Hanging on “${currentTrack.name}”`);
      return;
    }

    if (mode === "off") {
      if (!currentTrack) return;
      await fetch("/api/spotify/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: id, repeat: "off" }),
      }).catch(() => {});
      setStatus("Repeat off — current queue plays out and stops");
      return;
    }

    // Setlist mode — start the rotation immediately if we have one
    if (setlist.length === 0) {
      setStatus("Setlist is empty — add songs with the + button");
      return;
    }
    pauseOther?.();
    const res = await fetch("/api/spotify/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: id,
        uris: setlist.map((t) => t.uri),
        repeat: "context",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setStatus(`Setlist rotation on — ${setlist.length} tracks`);
    } else {
      setStatus(`Playback error: ${JSON.stringify(data.error ?? data)}`);
    }
  }

  async function startLoop() {
    const id = deviceIdRef.current;
    if (!id) {
      setStatus("Widget not connected yet — give it a second");
      return;
    }

    const mode = repeatModeRef.current;
    if (mode === "off") {
      setStatus("Pick a repeat mode first — “This song” or “Setlist”");
      return;
    }

    let uris: string[];
    if (mode === "track") {
      // "This song" = whatever is playing NOW. Setlist never overrides it.
      if (currentTrack) {
        uris = [currentTrack.uri];
      } else if (setlist.length > 0) {
        uris = [setlist[0].uri];
      } else {
        setStatus("Nothing playing — play a song or build a setlist first");
        return;
      }
    } else {
      if (setlist.length === 0) {
        setStatus("Setlist is empty — add songs with the + button");
        return;
      }
      uris = setlist.map((t) => t.uri);
    }

    pauseOther?.();
    playCountRef.current = 0;
    setPlayCount(0);
    lastPosRef.current = 0;

    if (stopMode === "duration") {
      galaEndsAtRef.current = Date.now() + stopHours * 60 * 60 * 1000;
      setGalaRemaining(galaEndsAtRef.current - Date.now());
    } else {
      galaEndsAtRef.current = null;
      setGalaRemaining(null);
    }

    loopActiveRef.current = true;
    setLoopActive(true);

    const res = await fetch("/api/spotify/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: id, uris, repeat: mode }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      loopActiveRef.current = false;
      setLoopActive(false);
      galaEndsAtRef.current = null;
      setGalaRemaining(null);
      setStatus(`Couldn't start: ${JSON.stringify(data.error ?? data)}`);
      return;
    }

    const label =
      mode === "track"
        ? `Hanging on “${currentTrack?.name ?? setlist[0]?.name ?? "track"}”`
        : `Rolling the setlist — ${setlist.length} tracks`;

    setStatus(
      stopMode === "plays"
        ? `${label} — stops after ${stopPlays} plays`
        : stopMode === "duration"
        ? `${label} — for ${stopHours} hour${stopHours === 1 ? "" : "s"}`
        : `${label} — until you press Stop`
    );
  }

  async function doSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setStatus("");
    try {
      const res = await fetch(
        `/api/spotify/search?q=${encodeURIComponent(searchQuery)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setStatus(`Search error: ${JSON.stringify(data.error ?? data)}`);
        return;
      }
      setSearchResults(data.tracks ?? []);
      if ((data.tracks ?? []).length === 0) {
        setStatus("No results — try different words");
      }
    } finally {
      setSearching(false);
    }
  }

  async function loadArtist() {
    if (!artistInput.trim()) return;
    setLoadingArtist(true);
    setStatus("");
    try {
      const res = await fetch(
        `/api/spotify/artist?uri=${encodeURIComponent(artistInput)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setStatus(
          typeof data.error === "string"
            ? data.error
            : `Artist error: ${JSON.stringify(data.error ?? data)}`
        );
        return;
      }
      setArtist(data.artist);
      setArtistTracks(data.tracks ?? []);
      if ((data.tracks ?? []).length === 0) {
        setStatus("Artist loaded but no tracks found — try their exact name");
      }
    } finally {
      setLoadingArtist(false);
    }
  }

  function addToSetlist(track: Track) {
    setSetlist((prev) => [...prev, track]);
    setStatus(`Added “${track.name}” to setlist`);
  }

  async function togglePlay() {
    try {
      await player?.togglePlay();
    } catch {
      // ignore
    }
  }

  async function changeVolume(v: number) {
    setVolume(v);
    try {
      await player?.setVolume(v);
    } catch {
      // ignore
    }
  }

  async function seekTo(e: ReactMouseEvent<HTMLDivElement>) {
    if (!player || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    const clamped = Math.min(1, Math.max(0, fraction));
    try {
      await player.seek(clamped * duration);
    } catch {
      // ignore
    }
  }

  const timerDisplay =
    galaRemaining !== null
      ? fmtCountdown(galaRemaining)
      : stopMode === "duration"
      ? `${stopHours}h once started`
      : "—";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      {/* Connection pill */}
      <div className="flex items-center justify-between">
        <span
          className={`flex items-center gap-2 text-xs ${
            deviceId ? "text-emerald-400" : "text-amber-400"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              deviceId ? "animate-pulse bg-emerald-400" : "bg-amber-400"
            }`}
          />
          {deviceId ? "Widget live on Spotify" : playerStatus}
        </span>
        {loopActive && (
          <span className="flex items-center gap-2 text-xs font-medium text-red-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            LOOPING
          </span>
        )}
      </div>

      {/* Now Playing */}
      <section className="rounded-2xl border border-red-900/40 bg-gradient-to-b from-[#160a0a] to-[#0c0c0c] p-5">
        <div className="flex items-center gap-4">
          {currentTrack?.albumArt ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentTrack.albumArt}
              alt=""
              className="h-20 w-20 flex-shrink-0 rounded-lg object-cover shadow-lg shadow-black/50"
            />
          ) : (
            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-2xl text-neutral-700">
              ♪
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold text-white">
              {currentTrack?.name ?? "Nothing playing yet"}
            </p>
            <p className="truncate text-sm text-neutral-400">
              {currentTrack?.artists ?? "Search a song below to get started"}
            </p>
          </div>
          <button
            onClick={togglePlay}
            disabled={!currentTrack}
            title={paused ? "Play" : "Pause"}
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)] transition hover:bg-red-500 disabled:opacity-30"
          >
            {paused ? "▶" : "❚❚"}
          </button>
        </div>

        <div className="group mt-4 cursor-pointer" onClick={seekTo}>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-red-800 to-red-500 transition-[width] duration-300"
              style={{ width: `${duration ? (position / duration) * 100 : 0}%` }}
            />
          </div>
        </div>
        <div className="mt-1 flex justify-between text-xs text-neutral-500">
          <span>{fmtTime(position)}</span>
          <span>{fmtTime(duration)}</span>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-widest text-neutral-500">
            Vol
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => changeVolume(Number(e.target.value))}
            className="flex-1 accent-red-600"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-900 pt-3 text-xs text-neutral-500">
          <span>
            PLAYS COMPLETED{" "}
            <span className="font-semibold text-neutral-200">{playCount}</span>
            {stopMode === "plays" && <span> / {stopPlays}</span>}
          </span>
          <span>
            EVENT TIMER{" "}
            <span className="font-semibold text-neutral-200">{timerDisplay}</span>
          </span>
        </div>
      </section>

      {/* Search */}
      <Section
        title="Find songs"
        hint="Search any song or artist — plays count toward their streams"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            doSearch();
          }}
          className="flex gap-2"
        >
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Song or artist name…"
            className="flex-1 rounded-xl border border-red-900/40 bg-neutral-950 px-4 py-3 text-sm text-white placeholder-neutral-600 transition focus:border-red-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={searching || !searchQuery.trim()}
            className="rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {searching ? "…" : "Search"}
          </button>
        </form>
        {searchResults.length > 0 && (
          <div className="mt-3 space-y-1">
            {searchResults.map((t) => (
              <TrackRow
                key={t.uri}
                track={t}
                onPlay={() => playTrack(t)}
                onAdd={() => addToSetlist(t)}
              />
            ))}
          </div>
        )}
      </Section>

      {/* Artist */}
      <Section
        title="Load an artist"
        hint="Paste an artist's Spotify page link (contains /artist/) to pull their top tracks"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadArtist();
          }}
          className="flex gap-2"
        >
          <input
            value={artistInput}
            onChange={(e) => setArtistInput(e.target.value)}
            placeholder="https://open.spotify.com/artist/…"
            className="flex-1 rounded-xl border border-red-900/40 bg-neutral-950 px-4 py-3 text-sm text-white placeholder-neutral-600 transition focus:border-red-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loadingArtist || !artistInput.trim()}
            className="rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loadingArtist ? "…" : "Load"}
          </button>
        </form>
        {artist && (
          <div className="mt-4 flex items-center gap-4 rounded-xl bg-neutral-900/50 p-3">
            {artist.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={artist.image}
                alt=""
                className="h-16 w-16 rounded-full object-cover ring-2 ring-red-900/60"
              />
            )}
            <div>
              <p className="text-lg font-semibold text-white">{artist.name}</p>
              {artist.followers > 0 && (
                <p className="text-xs text-neutral-500">
                  {artist.followers.toLocaleString()} followers
                </p>
              )}
            </div>
          </div>
        )}
        {artistTracks.length > 0 && (
          <div className="mt-3 space-y-1">
            {artistTracks.map((t) => (
              <TrackRow
                key={t.uri}
                track={t}
                onPlay={() => playTrack(t)}
                onAdd={() => addToSetlist(t)}
              />
            ))}
          </div>
        )}
      </Section>

      {/* Setlist */}
      <Section title="Setlist" hint="Your event's rotation — songs cycle in order">
        {setlist.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-800 p-4 text-center text-sm text-neutral-600">
            Empty — add tracks with the + button
          </p>
        ) : (
          <>
            <div className="space-y-1">
              {setlist.map((t, i) => (
                <div
                  key={`${t.uri}-${i}`}
                  className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-neutral-900/70"
                >
                  <span className="w-5 text-center text-xs text-neutral-600">
                    {i + 1}
                  </span>
                  {t.albumArt ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.albumArt}
                      alt=""
                      className="h-10 w-10 flex-shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 flex-shrink-0 rounded-md bg-neutral-800" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {t.name}
                    </p>
                    <p className="truncate text-xs text-neutral-400">
                      {t.artists}
                    </p>
                  </div>
                  <button
                    onClick={() => playTrack(t)}
                    title="Play now"
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-600 text-xs text-white opacity-70 transition hover:bg-red-500 hover:opacity-100"
                  >
                    ▶
                  </button>
                  <button
                    onClick={() =>
                      setSetlist((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    title="Remove"
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-neutral-500 opacity-70 transition hover:text-red-400 hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={playSetlist}
                className="flex-1 rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Play setlist
              </button>
              <button
                onClick={() => setSetlist([])}
                className="rounded-xl border border-red-900/40 px-6 py-3 text-sm text-neutral-400 transition hover:border-red-500 hover:text-white"
              >
                Clear
              </button>
            </div>
          </>
        )}
      </Section>

      {/* Loop Engine */}
      <Section
        title="Loop engine"
        hint="This song hangs whatever's playing. Setlist rotates the setlist. Toggles apply instantly."
      >
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-widest text-neutral-500">
              Repeat
            </p>
            <div className="flex flex-wrap gap-2">
              <Toggle
                active={repeatMode === "off"}
                onClick={() => selectRepeat("off")}
              >
                Off
              </Toggle>
              <Toggle
                active={repeatMode === "track"}
                onClick={() => selectRepeat("track")}
              >
                This song
              </Toggle>
              <Toggle
                active={repeatMode === "context"}
                onClick={() => selectRepeat("context")}
              >
                Setlist
              </Toggle>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[10px] uppercase tracking-widest text-neutral-500">
              Stop after
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Toggle
                active={stopMode === "never"}
                onClick={() => setStopMode("never")}
              >
                Forever
              </Toggle>
              <Toggle
                active={stopMode === "plays"}
                onClick={() => setStopMode("plays")}
              >
                Plays
              </Toggle>
              {stopMode === "plays" && (
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={stopPlays}
                  onChange={(e) =>
                    setStopPlays(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="w-16 rounded-lg border border-red-900/40 bg-neutral-950 px-2 py-2 text-sm text-white focus:border-red-500 focus:outline-none"
                />
              )}
              <Toggle
                active={stopMode === "duration"}
                onClick={() => setStopMode("duration")}
              >
                Hours
              </Toggle>
              {stopMode === "duration" && (
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={stopHours}
                  onChange={(e) =>
                    setStopHours(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="w-16 rounded-lg border border-red-900/40 bg-neutral-950 px-2 py-2 text-sm text-white focus:border-red-500 focus:outline-none"
                />
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            {!loopActive ? (
              <button
                onClick={startLoop}
                className="rounded-xl bg-red-600 px-8 py-3 text-sm font-semibold text-white shadow-[0_0_20px_rgba(220,38,38,0.3)] transition hover:bg-red-700"
              >
                Start loop
              </button>
            ) : (
              <button
                onClick={() => stopLoop("Stopped — loop ended")}
                className="rounded-xl border-2 border-red-600 px-8 py-3 text-sm font-semibold text-red-400 transition hover:bg-red-950"
              >
                Stop
              </button>
            )}
          </div>
        </div>
      </Section>

      {status && (
        <p className="pb-4 text-center text-sm text-neutral-400">{status}</p>
      )}
    </div>
  );
}