import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

interface SimpleTrack {
  uri: string;
  name: string;
  artists: string;
  album: string;
  albumArt: string;
  durationMs: number;
}

function mapTrack(t: any): SimpleTrack {
  return {
    uri: t.uri,
    name: t.name,
    artists: (t.artists ?? []).map((a: any) => a.name).join(", "),
    album: t.album?.name ?? "",
    albumArt: t.album?.images?.[0]?.url ?? "",
    durationMs: t.duration_ms ?? 0,
  };
}

// Album-track objects don't carry their album's name/art — inject from parent
function mapAlbumTrack(t: any, album: any): SimpleTrack {
  return {
    uri: t.uri,
    name: t.name,
    artists: (t.artists ?? []).map((a: any) => a.name).join(", "),
    album: album?.name ?? "",
    albumArt: album?.images?.[0]?.url ?? "",
    durationMs: t.duration_ms ?? 0,
  };
}

function parseArtistId(
  input: string
): { id: string } | { trackLink: true } | null {
  const trimmed = input.trim();

  if (
    /open\.spotify\.com\/(intl-[a-z-]+\/)?track\//.test(trimmed) ||
    /^spotify:track:/.test(trimmed)
  ) {
    return { trackLink: true };
  }

  const uriMatch = trimmed.match(/^spotify:artist:([A-Za-z0-9]+)$/);
  if (uriMatch) return { id: uriMatch[1] };

  const urlMatch = trimmed.match(
    /open\.spotify\.com\/(?:intl-[a-z-]+\/)?artist\/([A-Za-z0-9]+)/
  );
  if (urlMatch) return { id: urlMatch[1] };

  if (/^[A-Za-z0-9]{22}$/.test(trimmed)) return { id: trimmed };

  return null;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) return Response.json({ error: "Not signed in" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("uri") ?? searchParams.get("id");
  if (!raw) return Response.json({ error: "Missing artist" }, { status: 400 });

  const parsed = parseArtistId(raw);
  if (!parsed) {
    return Response.json(
      {
        error:
          "Couldn't read that — paste the artist's Spotify page link (it contains /artist/)",
      },
      { status: 400 }
    );
  }
  if ("trackLink" in parsed) {
    return Response.json(
      {
        error:
          "That's a song link — find it in Find songs, or open the artist's profile in Spotify and share THAT link",
      },
      { status: 400 }
    );
  }

  const artistId = parsed.id;
  const authHeaders = { Authorization: `Bearer ${token}` };
  const debug: string[] = [];

  // --- Artist profile (direct, with public oEmbed fallback) ---
  let artist = { name: "", image: "", followers: 0 };

  const artistRes = await fetch(
    `https://api.spotify.com/v1/artists/${artistId}`,
    { headers: authHeaders }
  );
  debug.push(`profile:${artistRes.status}`);

  if (artistRes.ok) {
    const d = await artistRes.json();
    if (d.name) {
      artist = {
        name: d.name,
        image: d.images?.[0]?.url ?? "",
        followers: d.followers?.total ?? 0,
      };
    }
  } else if (artistRes.status === 403 || artistRes.status === 404) {
    try {
      const oeRes = await fetch(
        `https://open.spotify.com/oembed?url=${encodeURIComponent(
          `https://open.spotify.com/artist/${artistId}`
        )}`
      );
      debug.push(`oembed:${oeRes.status}`);
      if (oeRes.ok) {
        const d = await oeRes.json();
        if (d.title) {
          artist = {
            name: d.title,
            image: d.thumbnail_url ?? "",
            followers: 0,
          };
        }
      }
    } catch {
      debug.push("oembed:err");
    }
  } else {
    const data = await artistRes.json().catch(() => ({}));
    return Response.json(
      { error: data, stage: "artist-profile" },
      { status: artistRes.status }
    );
  }

  if (!artist.name) {
    return Response.json(
      { error: "Couldn't load that artist — double-check the link" },
      { status: 400 }
    );
  }

  // --- Top tracks (direct; empty-200 counts as gated and falls through) ---
  let tracks: SimpleTrack[] = [];

  const topRes = await fetch(
    `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=from_token`,
    { headers: authHeaders }
  );
  debug.push(`top:${topRes.status}`);

  if (topRes.ok) {
    const d = await topRes.json();
    const rawTracks: any[] = d.tracks ?? [];
    debug.push(`topCount:${rawTracks.length}`);
    if (rawTracks.length > 0) {
      tracks = rawTracks.map(mapTrack);
    }
  }

  // --- Fallback A: paged plain-name search ---
  // Mirrors the EXACT request shape of the working Find-songs search
  // (limit=8) and pages through offsets. Spotify's 400 bodies are captured
  // so the terminal shows its exact complaint if this ever fails.
  if (tracks.length === 0) {
    const nameLc = artist.name.toLowerCase();
    const collected: any[] = [];

    for (let offset = 0; offset < 48; offset += 8) {
      let pageRes: Response;
      try {
        pageRes = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(
            artist.name
          )}&type=track&limit=8&offset=${offset}`,
          { headers: authHeaders }
        );
      } catch {
        debug.push("search:net");
        break;
      }

      debug.push(`search@${offset}:${pageRes.status}`);

      if (!pageRes.ok) {
        const body = await pageRes.text().catch(() => "");
        debug.push(`body:${body.slice(0, 120)}`);
        break;
      }

      const d = await pageRes.json();
      const items: any[] = d.tracks?.items ?? [];
      if (items.length === 0) break;
      collected.push(...items);
      if (items.length < 8) break; // last page
    }

    const seen = new Set<string>();
    tracks = collected
      .filter((t: any) =>
        (t.artists ?? []).some(
          (a: any) =>
            a.id === artistId || (a.name ?? "").toLowerCase() === nameLc
        )
      )
      .filter((t: any) => {
        if (seen.has(t.uri)) return false;
        seen.add(t.uri);
        return true;
      })
      .sort((a: any, b: any) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .slice(0, 15)
      .map(mapTrack);
    debug.push(`searchMatched:${tracks.length}`);
  }

  // --- Fallback B: albums enumeration (different endpoint family) ---
  // Walk the artist's releases newest-first and pull tracks off each album.
  // Survives even if search itself is restricted for this app.
  if (tracks.length === 0) {
    try {
      const albumsRes = await fetch(
        `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=album,single&limit=50`,
        { headers: authHeaders }
      );
      debug.push(`albums:${albumsRes.status}`);

      if (albumsRes.ok) {
        const d = await albumsRes.json();
        const albums = (d.items ?? [])
          .slice()
          .sort((a: any, b: any) =>
            (b.release_date ?? "").localeCompare(a.release_date ?? "")
          );

        const collected: SimpleTrack[] = [];
        const seen = new Set<string>();

        for (const album of albums.slice(0, 6)) {
          const trRes = await fetch(
            `https://api.spotify.com/v1/albums/${album.id}/tracks?limit=50`,
            { headers: authHeaders }
          );
          debug.push(`album:${trRes.status}`);
          if (!trRes.ok) continue;

          const td = await trRes.json();
          for (const t of td.items ?? []) {
            const credited = (t.artists ?? []).some(
              (a: any) =>
                a.id === artistId ||
                (a.name ?? "").toLowerCase() === artist.name.toLowerCase()
            );
            if (!credited || seen.has(t.uri)) continue;
            seen.add(t.uri);
            collected.push(mapAlbumTrack(t, album));
          }
          if (collected.length >= 15) break;
        }

        tracks = collected.slice(0, 15);
        debug.push(`albumMatched:${tracks.length}`);
      }
    } catch {
      debug.push("albums:err");
    }
  }

  console.log(
    `[artist-route] ${artist.name} — ${debug.join(" ")} → ${tracks.length} tracks`
  );

  return Response.json({ artist, tracks });
}