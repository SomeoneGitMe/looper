export async function GET(req: Request) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    return Response.json(
      { error: "YOUTUBE_API_KEY is missing — add it to .env.local and restart" },
      { status: 500 }
    );
  }
  // Narrowed copy — nested functions can see this is a plain string
  const apiKey: string = key;

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("url") ?? searchParams.get("q");
  if (!raw || !raw.trim()) {
    return Response.json({ error: "Missing channel" }, { status: 400 });
  }

  const trimmed = raw.trim();
  const debug: string[] = [];

  // --- Parse the input: URL, @handle, channel ID, or plain name ---
  let handle: string | null = null;
  let channelId: string | null = null;
  let username: string | null = null;
  let searchQuery: string | null = null;

  const handleMatch = trimmed.match(/youtube\.com\/@([A-Za-z0-9._-]+)/);
  const channelMatch = trimmed.match(/youtube\.com\/channel\/(UC[A-Za-z0-9_-]{20,24})/);
  const userMatch = trimmed.match(/youtube\.com\/user\/([A-Za-z0-9._-]+)/);
  const customMatch = trimmed.match(/youtube\.com\/c\/([A-Za-z0-9._-]+)/);

  if (handleMatch) handle = handleMatch[1];
  else if (channelMatch) channelId = channelMatch[1];
  else if (userMatch) username = userMatch[1];
  else if (customMatch) searchQuery = customMatch[1];
  else if (trimmed.startsWith("@")) handle = trimmed.slice(1);
  else if (/^UC[A-Za-z0-9_-]{20,24}$/.test(trimmed)) channelId = trimmed;
  else searchQuery = trimmed; // plain artist name — we'll search channels

  // --- Resolve to a channel object ---
  async function channelsList(params: Record<string, string>) {
    const url = new URL("https://www.googleapis.com/youtube/v3/channels");
    url.searchParams.set("part", "snippet,contentDetails,statistics");
    url.searchParams.set("key", apiKey);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url);
    return { res, data: res.ok ? await res.json() : null };
  }

  let channel: any = null;

  if (channelId) {
    const { res, data } = await channelsList({ id: channelId });
    debug.push(`byId:${res.status}`);
    channel = data?.items?.[0] ?? null;
  } else if (handle) {
    const { res, data } = await channelsList({ forHandle: handle });
    debug.push(`byHandle:${res.status}`);
    channel = data?.items?.[0] ?? null;
    if (!channel) searchQuery = handle; // fall through to search
  } else if (username) {
    const { res, data } = await channelsList({ forUsername: username });
    debug.push(`byUsername:${res.status}`);
    channel = data?.items?.[0] ?? null;
    if (!channel) searchQuery = username;
  }

  if (!channel && searchQuery) {
    // search.list type=channel — 100 units
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(
        searchQuery
      )}&key=${apiKey}`
    );
    debug.push(`chSearch:${res.status}`);
    if (res.ok) {
      const data = await res.json();
      const foundId = data.items?.[0]?.id?.channelId ?? data.items?.[0]?.snippet?.channelId;
      if (foundId) {
        const { data: d2 } = await channelsList({ id: foundId });
        channel = d2?.items?.[0] ?? null;
      }
    } else {
      const body = await res.json().catch(() => ({}));
      const reason = body?.error?.errors?.[0]?.reason ?? "";
      return Response.json(
        { error: reason || body?.error?.message || "Channel search failed" },
        { status: res.status }
      );
    }
  }

  if (!channel) {
    return Response.json(
      { error: "Couldn't find that channel — try their exact YouTube handle" },
      { status: 404 }
    );
  }

  const uploadsId = channel.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) {
    return Response.json(
      { error: "This channel has no public uploads" },
      { status: 404 }
    );
  }

  // --- Recent uploads — playlistItems.list, 1 unit ---
  const plRes = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsId}&maxResults=50&key=${apiKey}`
  );
  debug.push(`uploads:${plRes.status}`);

  if (!plRes.ok) {
    const body = await plRes.json().catch(() => ({}));
    const reason = body?.error?.errors?.[0]?.reason ?? "";
    return Response.json(
      { error: reason || "Couldn't load this channel's uploads" },
      { status: plRes.status }
    );
  }

  const plData = await plRes.json();
  const uploadItems: any[] = plData.items ?? [];

  // --- Video details — videos.list, 1 unit ---
  const ids = uploadItems
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
      }));
    }
  }

  console.log(
    `[yt-channel] ${channel.snippet?.title ?? "?"} — ${debug.join(" ")} → ${videos.length} videos (${videos.filter((v) => !v.embeddable).length} not embeddable)`
  );

  return Response.json({
    channel: {
      name: channel.snippet?.title ?? "",
      image: channel.snippet?.thumbnails?.high?.url ?? "",
      subscribers: Number(channel.statistics?.subscriberCount ?? 0),
    },
    videos,
  });
}

function parseISODuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const h = parseInt(m[1] ?? "0", 10);
  const min = parseInt(m[2] ?? "0", 10);
  const s = parseInt(m[3] ?? "0", 10);
  return (h * 3600 + min * 60 + s) * 1000;
}