import type { NextAuthOptions } from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";

async function refreshAccessToken(token: any): Promise<any> {
  try {
    const basic = Buffer.from(
      `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
    ).toString("base64");

    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: token.refreshToken as string,
      }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      throw new Error(data.error_description ?? "Token refresh failed");
    }

    return {
      ...token,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? token.refreshToken,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
  } catch {
    return { ...token, error: "RefreshTokenError" };
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            "user-read-playback-state user-modify-playback-state user-read-currently-playing streaming user-read-private user-read-email",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Initial sign-in — capture the refresh token and expiry
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt:
            (account.expires_at ?? Math.floor(Date.now() / 1000) + 3600) * 1000,
        };
      }

      // Token still valid for another 60s+ — keep it
      if (token.expiresAt && Date.now() < (token.expiresAt as number) - 60_000) {
        return token;
      }

      // Expired or expiring — swap it for a fresh one
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      return session;
    },
  },
};