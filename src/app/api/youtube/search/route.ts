export async function GET(req: Request) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    return Response.json(
      { error: "YOUTUBE_API_KEY is missing — add it to .env.local and restart" },
      { status: 500 }
    );
  }
  // Narrowed copy — nested functions can trust this is a plain string
  const apiKey: string = key;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  if (!q || !q.trim()) {
    return Response.json({ error: "Missing search query" }, { status: 400 });
  }
  // Narrowed copy — same reason
  const query: string = q;

  const debug: string[] = [];

  // --- Pass 1: embeddable-only search (skips guaranteed-broken results) ---
  async function doSearch(embeddableOnly: boolean): Promise<Response> {
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "video");
    url.searchParams.set("maxResults", "12");
    url.searchParams.set("q", query);
    if (embeddableOnly) url.searchParams.set("videoEmbeddable", "true");
    url.searchParams.set("key", apiKey);
    return fetch(url);
  }

  let searchRes = await doSearch(true);
  debug.push(`search(embeddable):${searchRes.status}`);
  let items: any[] = [];

  if (searchRes.ok) {
    const d = await searchRes.json();
    items = d.items ?? [];
  }

  // --- Pass 2: if embeddable-only found nothing, widen the net ---
  if (items.length === 0) {
    searchRes = await doSearch(false);
    debug.push(`search(all):${searchRes.status}`);
    if (searchRes.ok) {
      const d = await searchRes.json();
      items = d.items ?? [];
    }
  }

  if (!searchRes.ok) {
    const data = await searchRes.json().catch(() => ({}));
    const reason = data?.error?.errors?.[0]?.reason ?? "";
    return Response.json(
      { error: reason || data?.error?.message || "Search failed", raw: data },
      { status: searchRes.status }
    );
  }

  if (items.length === 0) {
    return Response.json({ videos: [] });
  }

  // --- Video details: durations, views, embeddability (1 unit) ---
  const ids = items.map((i) => i.id?.videoId).filter(Boolean).join(",");
  const detailsRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics,status&id=${ids}&key=${apiKey}`
  );
  debug.push(`details:${detailsRes.status}`);

  const details = detailsRes.ok
    ? ((await detailsRes.json()).items ?? []) as any[]
    : [];

  const byId = new Map(details.map((d) => [d.id, d]));

  const videos = items
    .map((i) => {
      const id = i.id?.videoId;
      const d = id ? byId.get(id) : undefined;
      const snippet = d?.snippet ?? i.snippet;
      return {
        videoId: id as string,
        title: snippet?.title ?? "",
        channelTitle: snippet?.channelTitle ?? snippet?.videoOwnerChannelTitle ?? "",
        thumbnail:
          snippet?.thumbnails?.high?.url ?? snippet?.thumbnails?.default?.url ?? "",
        durationMs: parseISODuration(d?.contentDetails?.duration ?? ""),
        viewCount: Number(d?.statistics?.viewCount ?? 0),
        embeddable: d?.status?.embeddable ?? true,
        // "Topic" = YouTube's auto-generated official-audio channels (music workhorse)
        isTopic: (snippet?.channelTitle ?? "").toLowerCase().endsWith("- topic"),
        isVevo: (snippet?.channelTitle ?? "").toLowerCase().includes("vevo"),
      };
    })
    .filter((v) => v.videoId);

  // --- Rank: playable official music first, then playable, then the rest ---
  const qLc = query.toLowerCase();
  const artistGuess = qLc.split(/\s+/).slice(0, 2).join(" ").trim();

  function score(v: (typeof videos)[number]): number {
    const ch = v.channelTitle.toLowerCase();
    let s = 0;
    if (v.embeddable) s += 10;
    if (v.isTopic) s += 6;
    if (v.isVevo) s += 5;
    if (artistGuess.length > 2 && ch.includes(artistGuess)) s += 4;
    if (v.viewCount > 1_000_000) s += 2;
    else if (v.viewCount > 100_000) s += 1;
    return s;
  }

  videos.sort((a, b) => score(b) - score(a));

  console.log(
    `[yt-search] "${query}" — ${debug.join(" ")} → ${videos.length} videos, top: "${videos[0]?.title ?? "?"}" (${videos[0]?.channelTitle ?? "?"})`
  );

  return Response.json({ videos });
}

function parseISODuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const h = parseInt(m[1] ?? "0", 10);
  const min = parseInt(m[2] ?? "0", 10);
  const s = parseInt(m[3] ?? "0", 10);
  return (h * 3600 + min * 60 + s) * 1000;
}