export async function GET(req: Request) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    return Response.json(
      { error: "YOUTUBE_API_KEY is missing — add it to .env.local and restart" },
      { status: 500 }
    );
  }
  const apiKey: string = key;

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("url") ?? searchParams.get("q");
  if (!raw || !raw.trim()) {
    return Response.json({ error: "Missing playlist link" }, { status: 400 });
  }

  // --- Parse: playlist URL, watch-page link with &list=, music.youtube, or bare ID ---
  const trimmed = raw.trim();
  let playlistId: string | null = null;

  const listMatch = trimmed.match(/[?&]list=([A-Za-z0-9_-]+)/);
  if (listMatch) {
    playlistId = listMatch[1];
  } else if (
    /^(PL|UU|LL|FL|OLAK5uy_|RD|TL)[A-Za-z0-9_-]{10,}$/.test(trimmed)
  ) {
    playlistId = trimmed;
  }

  if (!playlistId) {
    return Response.json(
      {
        error:
          "Couldn't find a playlist ID in that — paste a link like youtube.com/playlist?list=…",
      },
      { status: 400 }
    );
  }

  const debug: string[] = [];

  // --- Playlist metadata (title) — tolerant, we can live without it ---
  let title = "Playlist";
  let channelTitle = "";
  try {
    const metaRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistId}&key=${apiKey}`
    );
    debug.push(`meta:${metaRes.status}`);
    if (metaRes.ok) {
      const d = await metaRes.json();
      const item = d.items?.[0];
      if (item?.snippet) {
        title = item.snippet.title ?? title;
        channelTitle = item.snippet.channelTitle ?? "";
      }
    }
  } catch {
    debug.push("meta:err");
  }

  // --- Playlist items ---
  const itemsRes = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50&key=${apiKey}`
  );
  debug.push(`items:${itemsRes.status}`);

  if (!itemsRes.ok) {
    const body = await itemsRes.json().catch(() => ({}));
    const reason = body?.error?.errors?.[0]?.reason ?? "";
    console.log(`[yt-playlist] FAIL ${playlistId} — ${debug.join(" ")} ${reason}`);

    if (itemsRes.status === 404 || reason.includes("notFound")) {
      return Response.json(
        {
          error:
            "Playlist not found — it may be private, deleted, or an auto-generated mix YouTube won't share",
        },
        { status: 404 }
      );
    }
    return Response.json(
      { error: reason || "Couldn't load that playlist" },
      { status: itemsRes.status }
    );
  }

  const itemsData = await itemsRes.json();
  const items: any[] = itemsData.items ?? [];

  if (items.length === 0) {
    return Response.json(
      { error: "That playlist is empty" },
      { status: 404 }
    );
  }

  // --- Video details (durations, embeddability, stats) ---
  const ids = items
    .map((i) => i.snippet?.resourceId?.videoId)
    .filter(Boolean)
    .join(",");

  let videos: any[] = [];

  if (ids) {
    const vRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics,status&id=${ids}&key=${apiKey}`
    );
    debug.push(`details:${vRes.status}`);
    if (vRes.ok) {
      const vData = await vRes.json();
      videos = (vData.items ?? []).map((d: any) => ({
        videoId: d.id,
        title: d.snippet?.title ?? "",
        channelTitle: d.snippet?.channelTitle ?? "",
        thumbnail:
          d.snippet?.thumbnails?.high?.url ??
          d.snippet?.thumbnails?.default?.url ??
          "",
        durationMs: parseISODuration(d.contentDetails?.duration ?? ""),
        viewCount: Number(d.statistics?.viewCount ?? 0),
        embeddable: d.status?.embeddable ?? true,
        isTopic: (d.snippet?.channelTitle ?? "").toLowerCase().endsWith("- topic"),
        isVevo: (d.snippet?.channelTitle ?? "").toLowerCase().includes("vevo"),
      }));
    }
  }

  console.log(
    `[yt-playlist] "${title}" — ${debug.join(" ")} → ${videos.length} videos (${videos.filter((v) => !v.embeddable).length} not embeddable)`
  );

  return Response.json({ playlist: { title, channelTitle }, videos });
}

function parseISODuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const h = parseInt(m[1] ?? "0", 10);
  const min = parseInt(m[2] ?? "0", 10);
  const s = parseInt(m[3] ?? "0", 10);
  return (h * 3600 + min * 60 + s) * 1000;
}