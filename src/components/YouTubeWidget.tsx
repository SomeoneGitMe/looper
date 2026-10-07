"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface Video {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  durationMs: number;
  viewCount: number;
  embeddable: boolean;
  isTopic?: boolean;
  isVevo?: boolean;
}

interface ChannelInfo {
  name: string;
  image: string;
  subscribers: number;
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

function fmtCount(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return `${n}`;
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

function VideoRow({
  video,
  onPlay,
  onAdd,
  unavailable,
}: {
  video: Video;
  onPlay: () => void;
  onAdd?: () => void;
  unavailable?: boolean;
}) {
  const dead = unavailable || !video.embeddable;
  return (
    <div
      className={`group flex items-center gap-3 rounded-xl p-2 transition hover:bg-neutral-900/70 ${
        unavailable ? "opacity-40" : ""
      }`}
    >
      <div className="relative h-11 w-[74px] flex-shrink-0 overflow-hidden rounded-md bg-neutral-800">
        {video.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnail} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-600">▶</div>
        )}
        <span className="absolute bottom-0.5 right-0.5 rounded bg-black/80 px-1 text-[9px] text-white">
          {fmtTime(video.durationMs)}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white" title={video.title}>
          {video.title}
        </p>
        <p className="flex items-center gap-1.5 truncate text-xs text-neutral-400">
          <span className="truncate">
            {video.channelTitle}
            {video.viewCount > 0 ? ` · ${fmtCount(video.viewCount)} views` : ""}
          </span>
          {video.isTopic && (
            <span className="flex-shrink-0 rounded bg-red-950 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-red-400">
              official audio
            </span>
          )}
          {unavailable && (
            <span className="flex-shrink-0 rounded bg-red-950 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-red-400">
              unavailable
            </span>
          )}
        </p>
      </div>
      <button
        onClick={onPlay}
        disabled={dead}
        title={
          unavailable
            ? "This video failed to play — marked unavailable"
            : video.embeddable
            ? "Play now"
            : "This video's owner disabled embedding"
        }
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-red-600 text-sm text-white opacity-70 transition hover:bg-red-500 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-25"
      >
        ▶
      </button>
      {onAdd && (
        <button
          onClick={onAdd}
          disabled={dead}
          title={dead ? "Can't be embedded" : "Add to setlist"}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-red-900/40 text-sm text-neutral-400 opacity-70 transition hover:border-red-500 hover:text-white hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-25"
        >
          +
        </button>
      )}
    </div>
  );
}

export default function YouTubeWidget({
  onPauseReady,
  pauseOther,
}: {
  onPauseReady?: (fn: () => void) => void;
  pauseOther?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [playerStatus, setPlayerStatus] = useState("Connecting to YouTube…");

  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [paused, setPaused] = useState(true);
  const [volume, setVolume] = useState(80);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Video[]>([]);
  const [searching, setSearching] = useState(false);

  const [channelInput, setChannelInput] = useState("");
  const [channel, setChannel] = useState<ChannelInfo | null>(null);
  const [channelVideos, setChannelVideos] = useState<Video[]>([]);
  const [loadingChannel, setLoadingChannel] = useState(false);

  const [setlist, setSetlist] = useState<Video[]>([]);

  const [repeatMode, setRepeatMode] = useState<RepeatMode>("track");
  const [stopMode, setStopMode] = useState<StopMode>("never");
  const [stopPlays, setStopPlays] = useState(5);
  const [stopHours, setStopHours] = useState(4);
  const [loopActive, setLoopActive] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [galaRemaining, setGalaRemaining] = useState<number | null>(null);
  const [status, setStatus] = useState("");

  // Videos that failed to play — marked and auto-skipped from now on
  const [unavailableIds, setUnavailableIds] = useState<Set<string>>(new Set());
  const unavailableRef = useRef<Set<string>>(new Set());
  const errorStreakRef = useRef(0);

  const repeatModeRef = useRef<RepeatMode>("track");
  const stopModeRef = useRef<StopMode>("never");
  const stopPlaysRef = useRef(5);
  const loopActiveRef = useRef(false);
  const playCountRef = useRef(0);
  const galaEndsAtRef = useRef<number | null>(null);
  const setlistRef = useRef<Video[]>([]);
  const currentIndexRef = useRef(-1);

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
    setlistRef.current = setlist;
  }, [setlist]);

  useEffect(() => {
    if (!onPauseReady) return;
    onPauseReady(() => {
      try {
        playerRef.current?.pauseVideo();
      } catch {
        // ignore
      }
    });
  }, [onPauseReady]);

  const stopLoop = useCallback((message: string) => {
    loopActiveRef.current = false;
    setLoopActive(false);
    galaEndsAtRef.current = null;
    setGalaRemaining(null);
    setStatus(message);
    try {
      playerRef.current?.pauseVideo();
    } catch {
      // ignore
    }
  }, []);

  const markUnavailable = useCallback((videoId: string) => {
    const next = new Set(unavailableRef.current);
    next.add(videoId);
    unavailableRef.current = next;
    setUnavailableIds(next);
  }, []);

  // Advance to the next playable setlist video, skipping dead ones
  const advanceSetlist = useCallback(() => {
    const p = playerRef.current;
    const list = setlistRef.current;
    if (!p || list.length === 0) return;
    const n = list.length;
    for (let step = 1; step <= n; step++) {
      const next = (currentIndexRef.current + step) % n;
      const cand = list[next];
      if (!unavailableRef.current.has(cand.videoId) && cand.embeddable) {
        currentIndexRef.current = next;
        setCurrentVideo(cand);
        p.loadVideoById(cand.videoId);
        return;
      }
    }
    stopLoop("Every setlist video is unavailable — build a new setlist");
  }, [stopLoop]);

  const handleStateChangeRef = useRef<(s: number) => void>(() => {});
  handleStateChangeRef.current = (state: number) => {
    const YTState = window.YT?.PlayerState;
    if (!YTState) return;

    if (state === YTState.PLAYING) {
      setPaused(false);
      errorStreakRef.current = 0; // healthy playback — reset the failure streak
      return;
    }
    if (state === YTState.PAUSED) {
      setPaused(true);
      return;
    }
    if (state !== YTState.ENDED) return;

    if (loopActiveRef.current) {
      playCountRef.current += 1;
      setPlayCount(playCountRef.current);

      if (
        stopModeRef.current === "plays" &&
        playCountRef.current >= stopPlaysRef.current
      ) {
        stopLoop("Loop complete — reached play target");
        return;
      }
    }

    if (repeatModeRef.current === "track") {
      const p = playerRef.current;
      if (p) {
        p.seekTo(0, true);
        p.playVideo();
      }
      return;
    }

    if (repeatModeRef.current === "context" && setlistRef.current.length > 0) {
      advanceSetlist();
      return;
    }

    if (loopActiveRef.current) {
      stopLoop("Loop finished — queue done");
    } else {
      setPaused(true);
    }
  };

  const handleErrorRef = useRef<(code: number) => void>(() => {});
  handleErrorRef.current = (code: number) => {
    const failed = currentVideo;
    const reason =
      code === 101 || code === 150
        ? "the owner disabled embedding"
        : code === 100
        ? "it was removed or made private"
        : code === 5
        ? "a playback error"
        : code === 2
        ? "an invalid video ID"
        : `player error ${code}`;

    if (failed) markUnavailable(failed.videoId);
    errorStreakRef.current += 1;

    // Recovery 1: setlist mode and the failed video is in the setlist
    const inSetlist = failed
      ? setlist.some((v) => v.videoId === failed.videoId)
      : false;
    if (
      repeatModeRef.current === "context" &&
      inSetlist &&
      setlist.length > 1 &&
      errorStreakRef.current <= setlist.length
    ) {
      setStatus(`“${failed?.title ?? "Video"}” can't play — ${reason}. Skipping to the next setlist video…`);
      advanceSetlist();
      return;
    }

    // Recovery 2: try the next best search result
    const idx = failed
      ? searchResults.findIndex((v) => v.videoId === failed.videoId)
      : -1;
    if (idx !== -1) {
      for (let i = idx + 1; i < searchResults.length; i++) {
        const cand = searchResults[i];
        if (cand.embeddable && !unavailableRef.current.has(cand.videoId)) {
          setStatus(`“${failed!.title}” can't play — ${reason}. Trying “${cand.title}”…`);
          playVideoRow(cand);
          return;
        }
      }
    }

    setStatus(
      `“${failed?.title ?? "Video"}” can't play — ${reason}. No playable alternative found — pick another.`
    );
    setPaused(true);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    const div = document.createElement("div");
    container.appendChild(div);

    const create = () => {
      if (cancelled) return;
      const p = new window.YT.Player(div, {
        width: "100%",
        height: "100%",
        playerVars: {
          playsinline: 1,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
        },
        events: {
          onReady: () => {
            if (cancelled) return;
            playerRef.current = p;
            try {
              p.setVolume(volume);
            } catch {
              // ignore
            }
            setPlayerReady(true);
            setPlayerStatus("Widget is live");
          },
          onStateChange: (e: any) => handleStateChangeRef.current(e.data),
          onError: (e: any) => handleErrorRef.current(e.data),
        },
      });
    };

    if (window.YT?.Player) {
      create();
    } else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        create();
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(script);
    }

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy();
      } catch {
        // ignore
      }
      playerRef.current = null;
      container.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      const p = playerRef.current;
      if (p?.getCurrentTime) {
        try {
          setPosition(p.getCurrentTime() * 1000);
          const d = p.getDuration() * 1000;
          if (d > 0) setDuration(d);
        } catch {
          // ignore
        }
      }
      if (galaEndsAtRef.current !== null) {
        setGalaRemaining(galaEndsAtRef.current - Date.now());
        if (Date.now() >= galaEndsAtRef.current) {
          stopLoop("Gala complete — playback stopped");
        }
      }
    }, 500);
    return () => clearInterval(iv);
  }, [stopLoop]);

  function playVideoRow(v: Video) {
    const p = playerRef.current;
    if (!p) {
      setStatus("Player still loading — give it a second");
      return;
    }
    if (unavailableRef.current.has(v.videoId)) {
      setStatus(`“${v.title}” already failed to play — it's marked unavailable`);
      return;
    }
    if (!v.embeddable) {
      setStatus(`“${v.title}” can't be embedded — the owner disabled it`);
      return;
    }
    pauseOther?.();
    const idx = setlist.findIndex((s) => s.videoId === v.videoId);
    currentIndexRef.current = idx;
    setCurrentVideo(v);
    p.loadVideoById(v.videoId);
    setStatus(`Playing “${v.title}”`);
  }

  function playSetlistNow() {
    const p = playerRef.current;
    if (!p) {
      setStatus("Player still loading — give it a second");
      return;
    }
    if (setlist.length === 0) {
      setStatus("Setlist is empty — add videos with the + button");
      return;
    }
    pauseOther?.();
    currentIndexRef.current = 0;
    setCurrentVideo(setlist[0]);
    p.loadVideoById(setlist[0].videoId);
    setStatus(`Setlist rolling — ${setlist.length} videos`);
  }

  function selectRepeat(mode: RepeatMode) {
    setRepeatMode(mode);
    repeatModeRef.current = mode;

    if (mode === "track") {
      if (currentVideo) {
        setStatus(`Hanging on “${currentVideo.title}”`);
      }
      return;
    }

    if (mode === "off") {
      setStatus("Repeat off — current video plays out and stops");
      return;
    }

    if (setlist.length === 0) {
      setStatus("Setlist is empty — add videos with the + button");
      return;
    }
    const p = playerRef.current;
    if (p) {
      pauseOther?.();
      currentIndexRef.current = 0;
      setCurrentVideo(setlist[0]);
      p.loadVideoById(setlist[0].videoId);
    }
    setStatus(`Setlist rotation on — ${setlist.length} videos`);
  }

  function startLoop() {
    const p = playerRef.current;
    if (!p) {
      setStatus("Player still loading — give it a second");
      return;
    }

    const mode = repeatModeRef.current;
    let startVideo: Video | null = null;

    if (mode === "track") {
      startVideo = currentVideo ?? setlist[0] ?? null;
      if (!startVideo) {
        setStatus("Play a video or build a setlist first");
        return;
      }
    } else if (mode === "context") {
      if (setlist.length === 0) {
        setStatus("Setlist is empty — add videos with the + button");
        return;
      }
      startVideo = setlist[0];
    } else {
      setStatus("Pick a repeat mode first — “This video” or “Setlist”");
      return;
    }

    pauseOther?.();
    playCountRef.current = 0;
    setPlayCount(0);

    if (stopMode === "duration") {
      galaEndsAtRef.current = Date.now() + stopHours * 60 * 60 * 1000;
      setGalaRemaining(galaEndsAtRef.current - Date.now());
    } else {
      galaEndsAtRef.current = null;
      setGalaRemaining(null);
    }

    loopActiveRef.current = true;
    setLoopActive(true);

    currentIndexRef.current =
      mode === "context"
        ? 0
        : setlist.findIndex((v) => v.videoId === startVideo!.videoId);

    p.loadVideoById(startVideo.videoId);

    const label =
      mode === "track"
        ? `Hanging on “${startVideo.title}”`
        : `Rolling the setlist — ${setlist.length} videos`;

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
        `/api/youtube/search?q=${encodeURIComponent(searchQuery)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setStatus(
          typeof data.error === "string"
            ? data.error
            : `Search error: ${JSON.stringify(data.error ?? data)}`
        );
        return;
      }
      setSearchResults(data.videos ?? []);
      if ((data.videos ?? []).length === 0) {
        setStatus("No results — try different words");
      }
    } finally {
      setSearching(false);
    }
  }

  async function loadChannel() {
    if (!channelInput.trim()) return;
    setLoadingChannel(true);
    setStatus("");
    try {
      const res = await fetch(
        `/api/youtube/channel?url=${encodeURIComponent(channelInput)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setStatus(
          typeof data.error === "string"
            ? data.error
            : `Channel error: ${JSON.stringify(data.error ?? data)}`
        );
        return;
      }
      setChannel(data.channel);
      setChannelVideos(data.videos ?? []);
    } finally {
      setLoadingChannel(false);
    }
  }

  function addToSetlist(video: Video) {
    setSetlist((prev) => [...prev, video]);
    setStatus(`Added “${video.title}” to setlist`);
  }

  function togglePlay() {
    const p = playerRef.current;
    if (!p) return;
    try {
      const state = p.getPlayerState();
      if (state === window.YT.PlayerState.PLAYING) p.pauseVideo();
      else p.playVideo();
    } catch {
      // ignore
    }
  }

  function changeVolume(v: number) {
    setVolume(v);
    try {
      playerRef.current?.setVolume(v);
    } catch {
      // ignore
    }
  }

  function seekTo(e: ReactMouseEvent<HTMLDivElement>) {
    const p = playerRef.current;
    if (!p || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    const clamped = Math.min(1, Math.max(0, fraction));
    try {
      p.seekTo((clamped * duration) / 1000, true);
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
      <div className="flex items-center justify-between">
        <span
          className={`flex items-center gap-2 text-xs ${
            playerReady ? "text-emerald-400" : "text-amber-400"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              playerReady ? "animate-pulse bg-emerald-400" : "bg-amber-400"
            }`}
          />
          {playerReady ? "Widget live on YouTube" : playerStatus}
        </span>
        {loopActive && (
          <span className="flex items-center gap-2 text-xs font-medium text-red-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            LOOPING
          </span>
        )}
      </div>

      <section className="rounded-2xl border border-red-900/40 bg-gradient-to-b from-[#160a0a] to-[#0c0c0c] p-5">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
          <div
            ref={containerRef}
            className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full"
          />
          <button
            onClick={togglePlay}
            disabled={!currentVideo}
            aria-label={paused ? "Play" : "Pause"}
            className="absolute inset-0 flex items-center justify-center disabled:cursor-default"
          >
            {paused && currentVideo && playerReady && (
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600/90 text-2xl text-white shadow-[0_0_30px_rgba(220,38,38,0.5)]">
                ▶
              </span>
            )}
          </button>
          {!playerReady && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-500">
              {playerStatus}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold text-white" title={currentVideo?.title}>
              {currentVideo?.title ?? "Nothing playing yet"}
            </p>
            <p className="truncate text-sm text-neutral-400">
              {currentVideo?.channelTitle ?? "Search a video below to get started"}
            </p>
          </div>
          <button
            onClick={togglePlay}
            disabled={!currentVideo}
            title={paused ? "Play" : "Pause"}
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)] transition hover:bg-red-500 disabled:opacity-30"
          >
            {paused ? "▶" : "❚❚"}
          </button>
        </div>

        <div className="mt-4 cursor-pointer" onClick={seekTo}>
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
            max={100}
            step={1}
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

      <Section
        title="Find videos"
        hint="Official audio (Topic) and VEVO results rank first — they always play"
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
            placeholder="Song, artist, or “artist name official video”…"
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
            {searchResults.map((v) => (
              <VideoRow
                key={v.videoId}
                video={v}
                unavailable={unavailableIds.has(v.videoId)}
                onPlay={() => playVideoRow(v)}
                onAdd={() => addToSetlist(v)}
              />
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Load a channel"
        hint="Paste a YouTube channel link or just the artist's name"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadChannel();
          }}
          className="flex gap-2"
        >
          <input
            value={channelInput}
            onChange={(e) => setChannelInput(e.target.value)}
            placeholder="https://youtube.com/@… or channel URL or name"
            className="flex-1 rounded-xl border border-red-900/40 bg-neutral-950 px-4 py-3 text-sm text-white placeholder-neutral-600 transition focus:border-red-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loadingChannel || !channelInput.trim()}
            className="rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loadingChannel ? "…" : "Load"}
          </button>
        </form>
        {channel && (
          <div className="mt-4 flex items-center gap-4 rounded-xl bg-neutral-900/50 p-3">
            {channel.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={channel.image}
                alt=""
                className="h-16 w-16 rounded-full object-cover ring-2 ring-red-900/60"
              />
            )}
            <div>
              <p className="text-lg font-semibold text-white">{channel.name}</p>
              {channel.subscribers > 0 && (
                <p className="text-xs text-neutral-500">
                  {fmtCount(channel.subscribers)} subscribers
                </p>
              )}
            </div>
          </div>
        )}
        {channelVideos.length > 0 && (
          <div className="mt-3 space-y-1">
            {channelVideos.map((v) => (
              <VideoRow
                key={v.videoId}
                video={v}
                unavailable={unavailableIds.has(v.videoId)}
                onPlay={() => playVideoRow(v)}
                onAdd={() => addToSetlist(v)}
              />
            ))}
          </div>
        )}
      </Section>

      <Section title="Setlist" hint="Your event's rotation — videos cycle in order">
        {setlist.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-800 p-4 text-center text-sm text-neutral-600">
            Empty — add videos with the + button
          </p>
        ) : (
          <>
            <div className="space-y-1">
              {setlist.map((v, i) => {
                const dead = unavailableIds.has(v.videoId) || !v.embeddable;
                return (
                  <div
                    key={`${v.videoId}-${i}`}
                    className={`flex items-center gap-3 rounded-xl p-2 transition hover:bg-neutral-900/70 ${
                      dead ? "opacity-40" : ""
                    }`}
                  >
                    <span className="w-5 text-center text-xs text-neutral-600">
                      {i + 1}
                    </span>
                    <div className="relative h-10 w-[66px] flex-shrink-0 overflow-hidden rounded-md bg-neutral-800">
                      {v.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={v.thumbnail}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full" />
                      )}
                      <span className="absolute bottom-0.5 right-0.5 rounded bg-black/80 px-1 text-[9px] text-white">
                        {fmtTime(v.durationMs)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white" title={v.title}>
                        {v.title}
                      </p>
                      <p className="flex items-center gap-1.5 truncate text-xs text-neutral-400">
                        <span className="truncate">{v.channelTitle}</span>
                        {dead && (
                          <span className="flex-shrink-0 rounded bg-red-950 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-red-400">
                            unavailable
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => playVideoRow(v)}
                      disabled={dead}
                      title={dead ? "Can't be embedded" : "Play now"}
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-600 text-xs text-white opacity-70 transition hover:bg-red-500 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-25"
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
                );
              })}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={playSetlistNow}
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

      <Section
        title="Loop engine"
        hint="This video hangs whatever's playing. Setlist rotates the setlist. Toggles apply instantly."
      >
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-widest text-neutral-500">
              Repeat
            </p>
            <div className="flex flex-wrap gap-2">
              <Toggle active={repeatMode === "off"} onClick={() => selectRepeat("off")}>
                Off
              </Toggle>
              <Toggle
                active={repeatMode === "track"}
                onClick={() => selectRepeat("track")}
              >
                This video
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
              <Toggle active={stopMode === "never"} onClick={() => setStopMode("never")}>
                Forever
              </Toggle>
              <Toggle active={stopMode === "plays"} onClick={() => setStopMode("plays")}>
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