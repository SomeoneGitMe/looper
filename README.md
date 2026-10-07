Looper: Dual-Platform Music Widget

♾️Looper

A custom music widget for managers, artists, and entreprenuers. Loops an artist's catalog for the duration of your whim and every completed play counts toward their real Spotify streams or YouTube views (no label artists for youtube). Built for managers and artists who want engagement that actually shows up in the stats, with zero corporate branding in the room.

🧠 How It Works

- Spotify mode: OAuth via NextAuth, streams through the official Web Playback SDKinside a fully custom player. Plays count toward the artist's Spotify stats. Premium required for playback control (Spotify's rule, not ours).
- YouTube mode: zero sign-in. Ranks official audio (Topic / VEVO channels) first,plays through the IFrame Player API. Views count toward the artist's channel.No OAuth, no seats, no quota walls the try before you buy lane.
- Loop engine: "This song" hangs the current track; "Setlist" rotates the event rotation.
- Stop conditions: forever, N plays, or an event timer in hours music ends when the gala does. Walk away.
- Play counting: every completed play tracked on screen for the post event report.
- Dual-platform coordination: both players stay mounted; starting one pauses the other.

🛠 Tech Stack

Next.js (App Router) · React 19 · TypeScript · NextAuth v4 (Spotify OAuth with token auto refresh) · Tailwind CSS v4 · Framer Motion · Spotify Web API + Web Playback SDK ·YouTube Data API v3 + IFrame Player API

💻 Engineering Highlights

- Auto-refreshing Spotify tokens: the 1-hour access token expiry is handled silently; the widget runs a full event without re-authentication
- Self healing artist loading: direct endpoint → oEmbed fallback → paged searchreconstruction → albums enumeration. Survives Spotify's 2024 catalog gating on newdeveloper apps with four independent strategies
- YouTube resilience: embeddability filtering, official-source ranking, auto-skiprecovery when a video dies mid-event, and dead-video marking
- Shared UI kit with spring-animated segmented controls across both platform widgets

🚀 Live Demo URL: (looper-drab.vercel.app)
