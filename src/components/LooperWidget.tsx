"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useSession } from "next-auth/react";
import {
  Section,
  SegmentedControl,
  NumberField,
  PrimaryButton,
  StopButton,
  ControlLabel,
  VolumeSlider,
} from "@/components/ui/kit";

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

function IconVolume({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    </svg>
  );
}

function IconNote({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
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
    <div className="group flex items-center gap-4 rounded-2xl p-3 transition-colors hover:bg-white/[0.04]">
      {track.albumArt ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={track.albumArt}
          alt=""
          className="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-900">
          <IconNote className="h-5 w-5 text-neutral-700" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white" title={track.name}>
          {track.name}
        </p>
        <p className="mt-0.5 truncate text-xs text-neutral-500">
          {track.artists}
          {track.album ? ` · ${track.album}` : ""}
        </p>
      </div>
      <span className="flex-shrink-0 text-xs tabular-nums text-neutral-600">
        {fmtTime(track.durationMs)}
      </span>
      <button
        onClick={onPlay}
        title="Play now"
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-600 text-sm text-white opacity-80 transition hover:bg-red-500 hover:opacity-100"
      >
        ▶
      </button>
      {onAdd && (
        <button
          onClick={onAdd}
          title="Add to setlist"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-white/[0.1] text-neutral-400 transition hover:border-red-600/50 hover:text-white"
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

  const tokenRef = useRef<string | null>(null);
  const hasToken = !!session?.accessToken;

  useEffect(() => {
    tokenRef.current = session?.accessToken ?? null;
  }, [session?.accessToken]);

  const [player, setPlayer] = useState<any>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const [playerStatus, setPlayerStatus] = useState("Connecting to Spotify…");

  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [paused, setPaused] = useState(true);
  const [volume, setVolume] = useState(0.5);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);

  const [artistInput, setArtistInput] = useState("");
  const [artist, setArtist] = useState<ArtistInfo | null>(null);
  const [artistTracks, setArtistTracks] = useState<Track[]>([]);
  const [loadingArtist, setLoadingArtist] = useState(false);

  const [setlist, setSetlist] = useState<Track[]>([]);

  const [repeatMode, setRepeatMode] = useState<RepeatMode>("track");
  const [stopMode, setStopMode] = useState<StopMode>("never");
  const [stopPlays, setStopPlays] = useState(5);
  const [stopHours, setStopHours] = useState(4);
  const [loopActive, setLoopActive] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [galaRemaining, setGalaRemaining] = useState<number | null>(null);
  const [status, setStatus] = useState("");

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

        if (!state.paused) {
          const last = lastPosRef.current;
          if (last > 10000 && state.position < last - 10000) {
            playCountRef.current += 1;
            setPlayCount(playCountRef.current);
          }
        }
        lastPosRef.current = state.position;

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
    <div className="w-full space-y-8">
      <div className="flex items-center justify-between">
        <span
          className={`flex items-center gap-2.5 text-xs ${
            deviceId ? "text-emerald-400/90" : "text-amber-400/90"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              deviceId ? "animate-pulse bg-emerald-400" : "bg-amber-400"
            }`}
          />
          {deviceId ? "Live" : playerStatus}
        </span>
        {loopActive && (
          <span className="flex items-center gap-2 rounded-full border border-red-600/30 bg-red-600/10 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-red-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
            Looping
          </span>
        )}
      </div>

      <section className="animate-fade-up rounded-3xl border border-white/[0.06] bg-white/[0.02] p-6 md:p-7">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          {currentTrack?.albumArt ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentTrack.albumArt}
              alt=""
              className="h-44 w-44 flex-shrink-0 self-center rounded-2xl object-cover shadow-[0_16px_50px_rgba(0,0,0,0.55)] sm:self-auto"
            />
          ) : (
            <div className="flex h-44 w-44 flex-shrink-0 items-center justify-center self-center rounded-2xl border border-white/[0.06] bg-white/[0.02] sm:self-auto">
              <IconNote className="h-14 w-14 text-neutral-800" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h2
              className="truncate text-2xl font-medium tracking-tight text-white md:text-3xl"
              title={currentTrack?.name}
            >
              {currentTrack?.name ?? "Nothing playing yet"}
            </h2>
            <p className="mt-1.5 truncate text-sm text-neutral-500">
              {currentTrack?.artists ?? "Search below to get started"}
            </p>
            {currentTrack?.album && (
              <p className="mt-0.5 truncate text-xs text-neutral-600">
                {currentTrack.album}
              </p>
            )}

            <div className="mt-7 flex items-center gap-5">
              <button
                onClick={togglePlay}
                disabled={!currentTrack}
                title={paused ? "Play" : "Pause"}
                className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-600 text-white shadow-[0_0_25px_rgba(220,38,38,0.4)] transition-all hover:bg-red-500 disabled:opacity-30"
              >
                {paused ? "▶" : "❚❚"}
              </button>

              <div className="min-w-0 flex-1">
                <div className="cursor-pointer" onClick={seekTo}>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.08]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-red-800 to-red-500 transition-[width] duration-300"
                      style={{
                        width: `${duration ? (position / duration) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-neutral-600">
                  <span>{fmtTime(position)}</span>
                  <span>{fmtTime(duration)}</span>
                </div>
              </div>

              <div className="hidden w-28 items-center gap-2.5 sm:flex">
                <IconVolume className="h-4 w-4 flex-shrink-0 text-neutral-500" />
                <VolumeSlider value={volume} max={1} onChange={changeVolume} />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-5 text-[11px] uppercase tracking-[0.2em] text-neutral-600">
          <span>
            Plays
            <span className="ml-1.5 font-semibold tabular-nums text-neutral-300">
              {playCount}
            </span>
            {stopMode === "plays" && <span> / {stopPlays}</span>}
          </span>
          <span>
            Timer
            <span className="ml-1.5 font-semibold tabular-nums text-neutral-300">
              {timerDisplay}
            </span>
          </span>
        </div>
      </section>

      <Section
        label="Find songs"
        hint="Search any song or artist — plays count toward their streams"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            doSearch();
          }}
          className="flex gap-2.5"
        >
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Song or artist name…"
            className="h-12 flex-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-5 text-sm text-white placeholder-neutral-600 transition-colors focus:border-red-600/50 focus:outline-none"
          />
          <button
            type="submit"
            disabled={searching || !searchQuery.trim()}
            className="h-12 flex-shrink-0 rounded-full bg-red-600 px-7 text-sm font-semibold text-white transition hover:bg-red-500 disabled:pointer-events-none disabled:opacity-40"
          >
            {searching ? "…" : "Search"}
          </button>
        </form>
        {searchResults.length > 0 && (
          <div className="mt-4 space-y-1">
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

      <Section
        label="Load an artist"
        hint="Paste an artist's Spotify page link (contains /artist/) to pull their top tracks"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadArtist();
          }}
          className="flex gap-2.5"
        >
          <input
            value={artistInput}
            onChange={(e) => setArtistInput(e.target.value)}
            placeholder="https://open.spotify.com/artist/…"
            className="h-12 flex-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-5 text-sm text-white placeholder-neutral-600 transition-colors focus:border-red-600/50 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loadingArtist || !artistInput.trim()}
            className="h-12 flex-shrink-0 rounded-full bg-red-600 px-7 text-sm font-semibold text-white transition hover:bg-red-500 disabled:pointer-events-none disabled:opacity-40"
          >
            {loadingArtist ? "…" : "Load"}
          </button>
        </form>
        {artist && (
          <div className="mt-5 flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            {artist.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={artist.image}
                alt=""
                className="h-14 w-14 rounded-full object-cover ring-1 ring-white/10"
              />
            )}
            <div>
              <p className="text-lg font-medium text-white">{artist.name}</p>
              {artist.followers > 0 && (
                <p className="text-xs text-neutral-500">
                  {artist.followers.toLocaleString()} followers
                </p>
              )}
            </div>
          </div>
        )}
        {artistTracks.length > 0 && (
          <div className="mt-4 space-y-1">
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

      <Section label="Setlist" hint="Your event's rotation — songs cycle in order">
        {setlist.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/[0.08] py-10 text-center text-sm text-neutral-600">
            Empty — add tracks with the + button
          </p>
        ) : (
          <>
            <div className="space-y-1">
              {setlist.map((t, i) => (
                <div
                  key={`${t.uri}-${i}`}
                  className="flex items-center gap-4 rounded-2xl p-3 transition-colors hover:bg-white/[0.04]"
                >
                  <span className="w-5 text-center text-xs tabular-nums text-neutral-600">
                    {i + 1}
                  </span>
                  {t.albumArt ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.albumArt}
                      alt=""
                      className="h-10 w-10 flex-shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-neutral-900" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white" title={t.name}>
                      {t.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-neutral-500">
                      {t.artists}
                    </p>
                  </div>
                  <button
                    onClick={() => playTrack(t)}
                    title="Play now"
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-red-600 text-xs text-white opacity-80 transition hover:bg-red-500 hover:opacity-100"
                  >
                    ▶
                  </button>
                  <button
                    onClick={() =>
                      setSetlist((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    title="Remove"
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-neutral-600 transition hover:text-red-400"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-5 flex gap-2.5">
              <button
                onClick={playSetlist}
                className="h-12 flex-1 rounded-full bg-red-600 text-sm font-semibold text-white transition hover:bg-red-500"
              >
                Play setlist
              </button>
              <button
                onClick={() => setSetlist([])}
                className="h-12 rounded-full border border-white/[0.1] px-6 text-sm text-neutral-400 transition hover:border-white/30 hover:text-white"
              >
                Clear
              </button>
            </div>
          </>
        )}
      </Section>

      <Section
        label="Loop engine"
        hint="“This song” hangs whatever's playing. “Setlist” rotates. Changes apply instantly."
      >
        <div className="space-y-7">
          <div>
            <ControlLabel>Repeat</ControlLabel>
            <SegmentedControl
              id="sp-repeat"
              options={[
                { value: "off", label: "Off" },
                { value: "track", label: "This song" },
                { value: "context", label: "Setlist" },
              ]}
              value={repeatMode}
              onChange={(m) => selectRepeat(m)}
            />
          </div>

          <div>
            <ControlLabel>Stop after</ControlLabel>
            <div className="flex flex-wrap items-center gap-3">
              <SegmentedControl
                id="sp-stop"
                options={[
                  { value: "never", label: "Forever" },
                  { value: "plays", label: "Plays" },
                  { value: "duration", label: "Hours" },
                ]}
                value={stopMode}
                onChange={setStopMode}
              />
              {stopMode === "plays" && (
                <NumberField
                  value={stopPlays}
                  onChange={setStopPlays}
                  min={1}
                  max={999}
                  suffix="plays"
                />
              )}
              {stopMode === "duration" && (
                <NumberField
                  value={stopHours}
                  onChange={setStopHours}
                  min={1}
                  max={24}
                  suffix="hours"
                />
              )}
            </div>
          </div>

          <div className="pt-1">
            {loopActive ? (
              <StopButton onClick={() => stopLoop("Stopped — loop ended")}>
                Stop
              </StopButton>
            ) : (
              <PrimaryButton onClick={startLoop}>Start loop</PrimaryButton>
            )}
          </div>
        </div>
      </Section>

      {status && (
        <p className="pb-6 pt-1 text-center text-sm text-neutral-500">{status}</p>
      )}
    </div>
  );
}