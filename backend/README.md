# StreamSync

StreamSync is a browser-based live streaming and recording studio. Users can sign up, jump into a dashboard with a camera preview, go live with screen share + webcam, and chat with viewers in real time — no downloads, no plugins.

Built with Next.js (App Router), Firebase Auth, Socket.io for signaling, and raw WebRTC for the actual audio/video/screen-share connections.

## What's in here

**Auth**

- Email/password signup with a full name + password strength check (8+ chars, one special symbol)
- New accounts go through an email OTP verification step before they can log in
- Google sign-in as a one-click alternative (skips OTP since Google already verifies the account)
- Standard login page with "forgot password" placeholder and a link over to signup

**Dashboard**

- Live camera preview as soon as you land, with camera/mic toggles
- A real network-strength indicator — reads `navigator.connection` where it's supported, and falls back to pinging `/favicon.ico` and timing the response where it isn't
- "Go Live" flow: type a title + a description (min 6 words), hit go, and it POSTs to the backend to spin up a room, then routes you in as the host
- "Join Room": paste either a raw room ID or a full invite link — it'll pull the `room-xxxxx` ID out of either

**The room itself**

- Host can share their screen, toggle their camera, and toggle their mic independently
- Screen share and camera are sent as two separate WebRTC tracks, so viewers can see both at once (camera shows as a little floating box over the screen share)
- Viewers connect over WebRTC directly to the host — Socket.io just handles the signaling (offers/answers/ICE candidates) and figures out which incoming stream is the screen vs. the camera
- Live chat panel with timestamps, emoji picker, and auto-scroll
- Host can end the session for everyone; viewers get a clean "session ended" screen instead of a dead video feed

**Legal pages**

- Terms of Service and Privacy Policy, both straightforward static pages

## Stack

- **Next.js** (App Router, client components throughout)
- **TypeScript**
- **Tailwind CSS** for styling — dark theme, indigo accent
- **Firebase Auth** for email/password + Google sign-in
- **Socket.io** for WebRTC signaling and chat/presence events
- **WebRTC** (native browser APIs) for the actual media streams
- A separate backend API (referenced via `NEXT_PUBLIC_API_URL`) that handles OTP emails, room creation, and room lookup

## Environment variables

You'll need a `.env.local` with at least:

```
NEXT_PUBLIC_API_URL=https://your-backend-url.com
```

Plus whatever Firebase config your `AuthContext` expects (API key, project ID, etc. — not shown in these components, so check `@/context/AuthContext`).

## Backend expectations

The frontend assumes a backend that exposes:

- `POST /auth/send-otp` — send a 6-digit code to `{ email, fullName }`
- `POST /auth/verify-otp` — verify `{ email, code }`
- `POST /rooms/create` — create a room from `{ hostEmail, title, description }`, returns `{ success, roomId }`
- `GET /rooms/:roomId` — fetch room info, returns `{ success, room: { title, description } }`
- A Socket.io server handling `join-room`, `chat-message`, `webrtc-offer/answer/ice-candidate`, `stream-info`, `viewer-joined`, `end-session`, and broadcasting `viewer-count` / `system-message` / `session-ended`

None of that backend logic lives in this repo — these are just the events/routes the frontend calls.

## Known rough edges

- A couple of `console.log` debug lines are still sitting in the room page (`session-ended`, `end-session`) — safe to strip once the socket flow is confirmed stable.
- "Forgot Password" on the login page is currently just a label, not wired up yet.
- No rate limiting or resend cooldown on the OTP step yet.

## Running locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`. You'll need the backend (or a mock of it) running and reachable at whatever `NEXT_PUBLIC_API_URL` points to, or the dashboard and auth flows won't have anything to talk to.
