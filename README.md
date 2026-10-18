# Duet

A private watch-together room for two. Both cameras on; either of you can share one screen at a time.

## Run locally

```bash
npm install
npm run dev
```

Dev runs with HTTPS so phones on your Wi‑Fi can use the camera.

- Mac: [https://localhost:3000](https://localhost:3000)  
- Phone: `https://<your-mac-ip>:3000` (accept the certificate warning)

1. One person starts a room  
2. Tap **Allow camera & mic** (required on iPhone)  
3. Partner joins with the code and does the same  
4. Either person taps **Share** when ready (one screen at a time)

**iPhone note:** Chrome on iOS uses WebKit — camera needs HTTPS + a user tap. Screen share isn’t supported on iPhone Chrome; share from the Mac.

## Stack

- Next.js (App Router) + Tailwind
- PeerJS for WebRTC signaling
