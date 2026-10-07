Looper — Dual-Platform Music Widget for Live Events

🏫Looper — A custom, white-label music widget for events, galas, and venues. Loops an artist'scatalog for the duration of an event  and every completed play counts toward theirreal Spotify streams or YouTube views. Built for managers and artists who wantengagement that actually shows up in the stats, with zero corporate branding in the room.

🧠 How It Works

Spotify mode — OAuth via NextAuth, streams through the official Web Playback SDKinside a fully custom player. Plays count toward the artist's Spotify stats.Premium required for playback control (Spotify's rule, not ours).
YouTube mode — zero sign-in. Ranks official audio (Topic / VEVO channels) first,plays through the IFrame Player API. Views count toward the artist's channel.No OAuth, no seats, no quota walls — the try-before-you-buy lane.
Loop engine — "This song" hangs the current track; "Setlist" rotates the eventrotation. Stop conditions: forever, N plays, or an event timer in hours — musicends when the gala does. Walk away.
Play counting — every completed play tracked on-screen for the post-event report.
Dual-platform coordination — both players stay mounted; starting one pauses the other.
🛠 Tech Stack

Next.js (App Router) · React 19 · TypeScript · NextAuth v4 (Spotify OAuth with tokenauto-refresh) · Tailwind CSS v4 · Framer Motion · Spotify Web API + Web Playback SDK ·YouTube Data API v3 + IFrame Player API
💻 Engineering Highlights

Auto-refreshing Spotify tokens — the 1-hour access token expiry is handled silently;the widget runs a full event without re-authentication
Self-healing artist loading: direct endpoint → oEmbed fallback → paged searchreconstruction → albums enumeration. Survives Spotify's 2024 catalog gating on newdeveloper apps with four independent strategies
YouTube resilience: embeddability filtering, official-source ranking, auto-skiprecovery when a video dies mid-event, and dead-video marking
Shared UI kit with spring-animated segmented controls across both platform widgets

🚀 Live Demo URL: (looper-drab.vercel.app)