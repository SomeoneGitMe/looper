"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import MusicWidget from "@/components/MusicWidget";

export default function Home() {
  const { data: session, status } = useSession();
  const [me, setMe] = useState<{
    displayName?: string;
    product?: string;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/spotify/me")
      .then((r) => r.json())
      .then(setMe);
  }, [status]);

  return (
    <main className="flex min-h-screen flex-col items-center gap-8 p-6">
      <div className="flex w-full max-w-2xl flex-col items-center gap-1 pt-4">
        <h1 className="text-4xl font-bold tracking-tight text-red-500">
          Looper
        </h1>
        {status === "authenticated" && me && !me.error && (
          <p className="text-xs text-neutral-500">
            {me.displayName} · account type: {me.product ?? "unknown"}
          </p>
        )}
      </div>

      {status === "loading" && <p className="text-gray-400">Loading…</p>}

      {status === "unauthenticated" && (
        <button
          onClick={() => signIn("spotify")}
          className="rounded-xl bg-red-600 px-8 py-3 font-semibold text-white transition hover:bg-red-700"
        >
          Connect Spotify
        </button>
      )}

      {status === "authenticated" && (
        <div className="flex w-full flex-col items-center gap-6">
          <MusicWidget />
          <button
            onClick={() => signOut()}
            className="rounded-xl border border-red-900 px-6 py-2 text-sm text-neutral-500 transition hover:bg-gray-900 hover:text-neutral-300"
          >
            Sign out
          </button>
        </div>
      )}
    </main>
  );
}