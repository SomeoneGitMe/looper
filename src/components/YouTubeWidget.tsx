"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
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

interface PlaylistInfo {
  title: string;
  channelTitle: string;
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

function IconVolume({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    </svg>
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
      className={`group flex items-center gap-4 rounded-2xl p-3 transition-colors hover:bg-white/[0.04] ${
        unavailable ? "opacity-40" : ""
      }`}
    >
      <div className="relative h-12 w-[84px] flex-shrink-0 overflow-hidden rounded-lg bg-neutral-900">
        {video.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnail} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-700">▶</div>
        )}
        <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-[9px] font-medium tabular-nums text-white">
          {fmtTime(video.durationMs)}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white" title={video.title}>
          {video.title}
        </p>
        <p className="mt-0.5 flex items-center gap-2 truncate text-xs text-neutral-500">
          <span className="truncate">
            {video.channelTitle}
            {video.viewCount > 0 ? ` · ${fmtCount(video.viewCount)} views` : ""}
          </span>
          {video.isTopic && (
            <span className="flex-shrink-0 rounded-full bg-red-600/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-red-400">
              Official audio
            </span>
          )}
          {unavailable && (
            <span className="flex-shrink-0 rounded-full bg-red-600/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-red-400">
              Unavailable
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
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-600 text-sm text-white opacity-80 transition hover:bg-red-500 hover:opacity-100 disabled:pointer-events-none disabled:opacity-20"
      >
        ▶
      </button>
      {onAdd && (
        <button
          onClick={onAdd}
          disabled={dead}
          title={dead ? "Can't be embedded" : "Add to setlist"}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-white/[0.1] text-neutral-400 transition hover:border-red-600/50 hover:text-white disabled:pointer-events-none disabled:opacity-20"
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

  const [playlistInput, setPlaylistInput] = useState("");
  const [playlist, setPlaylist] = useState<PlaylistInfo | null>(null);
  const [playlistVideos, setPlaylistVideos] = useState<Video[]>([]);
  const [loadingPlaylist, setLoadingPlaylist] = useState(false);

  const [setlist, setSetlist] = useState<Video[]>([]);

  const [repeatMode, setRepeatMode] = useState<RepeatMode>("track");
  const [stopMode, setStopMode] = useState<StopMode>("never");
  const [stopPlays, setStopPlays] = useState(5);
  const [stopHours, setStopHours] = useState(4);
  const [loopActive, setLoopActive] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [galaRemaining, setGalaRemaining] = useState<number | null>(null);
  const [status, setStatus] = useState("");

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

  /* ---- Empty-field clearing: no lingering results with a blank bar ---- */
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setSearchResults([]);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (channelInput.trim() === "") {
      setChannel(null);
      setChannelVideos([]);
    }
  }, [channelInput]);

  useEffect(() => {
    if (playlistInput.trim() === "") {
      setPlaylist(null);
      setPlaylistVideos([]);
    }
  }, [playlistInput]);

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
      errorStreakRef.current = 0;
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

    const inSetlist = failed
      ? setlist.some((v) => v.videoId === failed.videoId)
      : false;
    if (
      repeatModeRef.current === "context" &&
      inSetlist &&
      setlist.length > 1 &&
      errorStreakRef.current <= setlist.length
    ) {
      setStatus(
        `“${failed?.title ?? "Video"}” can't play — ${reason}. Skipping to the next setlist video…`
      );
      advanceSetlist();
      return;
    }

    const idx = failed
      ? searchResults.findIndex((v) => v.videoId === failed.videoId)
      : -1;
    if (idx !== -1) {
      for (let i = idx + 1; i < searchResults.length; i++) {
        const cand = searchResults[i];
        if (cand.embeddable && !unavailableRef.current.has(cand.videoId)) {
          setStatus(
            `“${failed!.title}” can't play — ${reason}. Trying “${cand.title}”…`
          );
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

  async function loadPlaylist() {
    if (!playlistInput.trim()) return;
    setLoadingPlaylist(true);
    setStatus("");
    try {
      const res = await fetch(
        `/api/youtube/playlist?url=${encodeURIComponent(playlistInput)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setStatus(
          typeof data.error === "string"
            ? data.error
            : `Playlist error: ${JSON.stringify(data.error ?? data)}`
        );
        return;
      }
      setPlaylist(data.playlist);
      setPlaylistVideos(data.videos ?? []);
      if ((data.videos ?? []).length === 0) {
        setStatus("Playlist loaded but no videos found — is it empty?");
      }
    } finally {
      setLoadingPlaylist(false);
    }
  }

  function addToSetlist(video: Video) {
    setSetlist((prev) => [...prev, video]);
    setStatus(`Added “${video.title}” to setlist`);
  }

  function addAllPlaylistToSetlist() {
    if (playlistVideos.length === 0) return;
    const playable = playlistVideos.filter(
      (v) => v.embeddable && !unavailableRef.current.has(v.videoId)
    );
    const skipped = playlistVideos.length - playable.length;
    setSetlist((prev) => [...prev, ...playable]);
    setStatus(
      `Added ${playable.length} playlist videos to the setlist${
        skipped > 0 ? ` — ${skipped} skipped (can't be embedded)` : ""
      }`
    );
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
    <div className="w-full space-y-8">
      <div className="flex items-center justify-between">
        <span
          className={`flex items-center gap-2.5 text-xs ${
            playerReady ? "text-emerald-400/90" : "text-amber-400/90"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              playerReady ? "animate-pulse bg-emerald-400" : "bg-amber-400"
            }`}
          />
          {playerReady ? "Live" : playerStatus}
        </span>
        {loopActive && (
          <span className="flex items-center gap-2 rounded-full border border-red-600/30 bg-red-600/10 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-red-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
            Looping
          </span>
        )}
      </div>

      <section className="animate-fade-up overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.02]">
        <div className="relative aspect-video w-full bg-black">
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
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600/90 text-2xl text-white shadow-[0_0_40px_rgba(220,38,38,0.5)]">
                ▶
              </span>
            )}
          </button>
          {!playerReady && (
            <div className="absolute inset-0 flex items-center justify-center text-[10px] uppercase tracking-[0.3em] text-neutral-600">
              {playerStatus}
            </div>
          )}
        </div>

        <div className="p-6 md:p-7">
          <h2
            className="truncate text-2xl font-medium tracking-tight text-white"
            title={currentVideo?.title}
          >
            {currentVideo?.title ?? "Nothing playing yet"}
          </h2>
          <p className="mt-1 truncate text-sm text-neutral-500">
            {currentVideo?.channelTitle ?? "Search below to get started"}
          </p>

          <div className="mt-6 flex items-center gap-5">
            <button
              onClick={togglePlay}
              disabled={!currentVideo}
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
              <VolumeSlider value={volume} max={100} onChange={changeVolume} />
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
        </div>
      </section>

      <Section
        label="Find videos"
        hint="Official audio and VEVO results rank first — they always play"
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
            placeholder="Song, artist, or “artist name official video”…"
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
        label="Load a channel"
        hint="Paste a YouTube channel link or just the artist's name"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadChannel();
          }}
          className="flex gap-2.5"
        >
          <input
            value={channelInput}
            onChange={(e) => setChannelInput(e.target.value)}
            placeholder="https://youtube.com/@… or channel URL or name"
            className="h-12 flex-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-5 text-sm text-white placeholder-neutral-600 transition-colors focus:border-red-600/50 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loadingChannel || !channelInput.trim()}
            className="h-12 flex-shrink-0 rounded-full bg-red-600 px-7 text-sm font-semibold text-white transition hover:bg-red-500 disabled:pointer-events-none disabled:opacity-40"
          >
            {loadingChannel ? "…" : "Load"}
          </button>
        </form>
        {channel && (
          <div className="mt-5 flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            {channel.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={channel.image}
                alt=""
                className="h-14 w-14 rounded-full object-cover ring-1 ring-white/10"
              />
            )}
            <div>
              <p className="text-lg font-medium text-white">{channel.name}</p>
              {channel.subscribers > 0 && (
                <p className="text-xs text-neutral-500">
                  {fmtCount(channel.subscribers)} subscribers
                </p>
              )}
            </div>
          </div>
        )}
        {channelVideos.length > 0 && (
          <div className="mt-4 space-y-1">
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

      <Section
        label="Load a playlist"
        hint="Paste a playlist link — then add it all to the setlist in one click"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadPlaylist();
          }}
          className="flex gap-2.5"
        >
          <input
            value={playlistInput}
            onChange={(e) => setPlaylistInput(e.target.value)}
            placeholder="https://youtube.com/playlist?list=…"
            className="h-12 flex-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-5 text-sm text-white placeholder-neutral-600 transition-colors focus:border-red-600/50 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loadingPlaylist || !playlistInput.trim()}
            className="h-12 flex-shrink-0 rounded-full bg-red-600 px-7 text-sm font-semibold text-white transition hover:bg-red-500 disabled:pointer-events-none disabled:opacity-40"
          >
            {loadingPlaylist ? "…" : "Load"}
          </button>
        </form>
        {playlist && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="min-w-0">
              <p className="truncate text-lg font-medium text-white" title={playlist.title}>
                {playlist.title}
              </p>
              <p className="mt-0.5 text-xs text-neutral-500">
                {playlist.channelTitle ? `${playlist.channelTitle} · ` : ""}
                {playlistVideos.length} videos
              </p>
            </div>
            {playlistVideos.length > 0 && (
              <button
                onClick={addAllPlaylistToSetlist}
                className="h-11 flex-shrink-0 rounded-full bg-red-600 px-6 text-sm font-semibold text-white transition hover:bg-red-500"
              >
                Add all to setlist
              </button>
            )}
          </div>
        )}
        {playlistVideos.length > 0 && (
          <div className="mt-4 space-y-1">
            {playlistVideos.map((v) => (
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

      <Section label="Setlist" hint="Your event's rotation — videos cycle in order">
        {setlist.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/[0.08] py-10 text-center text-sm text-neutral-600">
            Empty — add videos with the + button or load a playlist above
          </p>
        ) : (
          <>
            <div className="space-y-1">
              {setlist.map((v, i) => {
                const dead = unavailableIds.has(v.videoId) || !v.embeddable;
                return (
                  <div
                    key={`${v.videoId}-${i}`}
                    className={`flex items-center gap-4 rounded-2xl p-3 transition-colors hover:bg-white/[0.04] ${
                      dead ? "opacity-40" : ""
                    }`}
                  >
                    <span className="w-5 text-center text-xs tabular-nums text-neutral-600">
                      {i + 1}
                    </span>
                    <div className="relative h-10 w-[70px] flex-shrink-0 overflow-hidden rounded-lg bg-neutral-900">
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
                      <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-[9px] font-medium tabular-nums text-white">
                        {fmtTime(v.durationMs)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white" title={v.title}>
                        {v.title}
                      </p>
                      <p className="mt-0.5 flex items-center gap-2 truncate text-xs text-neutral-500">
                        <span className="truncate">{v.channelTitle}</span>
                        {dead && (
                          <span className="flex-shrink-0 rounded-full bg-red-600/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-red-400">
                            Unavailable
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => playVideoRow(v)}
                      disabled={dead}
                      title={dead ? "Can't be embedded" : "Play now"}
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-red-600 text-xs text-white opacity-80 transition hover:bg-red-500 hover:opacity-100 disabled:pointer-events-none disabled:opacity-20"
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
                );
              })}
            </div>
            <div className="mt-5 flex gap-2.5">
              <button
                onClick={playSetlistNow}
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
        hint="“This video” hangs whatever's playing. “Setlist” rotates. Changes apply instantly."
      >
        <div className="space-y-7">
          <div>
            <ControlLabel>Repeat</ControlLabel>
            <SegmentedControl
              id="yt-repeat"
              options={[
                { value: "off", label: "Off" },
                { value: "track", label: "This video" },
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
                id="yt-stop"
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