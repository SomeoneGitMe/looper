import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) return Response.json({ error: "Not signed in" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  if (!q || !q.trim()) {
    return Response.json({ error: "Missing search query" }, { status: 400 });
  }

  const res = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=8`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return Response.json({ error: data }, { status: res.status });
  }

  const data = await res.json();
  const tracks = (data.tracks?.items ?? []).map((t: any) => ({
    uri: t.uri,
    name: t.name,
    artists: (t.artists ?? []).map((a: any) => a.name).join(", "),
    album: t.album?.name ?? "",
    albumArt: t.album?.images?.[0]?.url ?? "",
    durationMs: t.duration_ms ?? 0,
  }));

  return Response.json({ tracks });
}