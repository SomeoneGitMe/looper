import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;
  if (!token) return Response.json({ error: "Not signed in" }, { status: 401 });

  const { deviceId, uris, repeat } = await req.json();

  if (!deviceId) {
    return Response.json({ error: "Missing deviceId" }, { status: 400 });
  }

  if (Array.isArray(uris) && uris.length > 0) {
    const playRes = await fetch(
      `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uris }),
      }
    );
    if (playRes.status !== 204) {
      const data = await playRes.json().catch(() => ({}));
      return Response.json({ error: data, stage: "play" }, { status: playRes.status });
    }
  }

  if (repeat && ["off", "track", "context"].includes(repeat)) {
    const repeatRes = await fetch(
      `https://api.spotify.com/v1/me/player/repeat?state=${repeat}&device_id=${deviceId}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (repeatRes.status !== 204) {
      const data = await repeatRes.json().catch(() => ({}));
      return Response.json({ error: data, stage: "repeat" }, { status: repeatRes.status });
    }
  }

  return Response.json({ ok: true });
}