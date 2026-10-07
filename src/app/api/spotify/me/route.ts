import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  const token = session?.accessToken;

  if (!token) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  const res = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    return Response.json({ error: `Spotify API error: ${res.status}` }, { status: res.status });
  }

  const data = await res.json();
  return Response.json({
    displayName: data.display_name,
    id: data.id,
    product: data.product, // "premium" or "free"
  });
}