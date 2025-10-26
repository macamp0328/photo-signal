# 📸 Photo Signal

> A quiet, camera-based gallery that plays music when you point at a printed photo.

---

## 🌄 Concept

**Photo Signal** is an experiment in memory, music, and perception.  
Visitors use their phone’s camera to look at printed photographs — the site recognizes each image, displays its details, and plays a song tied to that moment.

It’s a small-scale, in-home installation: no QR codes, no visible markers.  
Just light, sound, and the act of looking.

Inspired by [campmiles.com](https://www.campmiles.com), this project explores how technology can quietly deepen our connection to physical media without disrupting its stillness.

---

## 🧠 Core Experience

1. User visits the site (mobile-first).
2. Grants access to the camera and speakers.
3. Aligns a printed photo within the on-screen frame.
4. The app recognizes the image and overlays band, venue, and date.
5. The corresponding song begins playing.
6. Moving away fades out both the music and the overlay.

---

## 🧩 Architecture (MVP)

| Layer | Role | Tech |
|-------|------|------|
| **Frontend** | Camera view, hash recognition, playback | React (Vite or Next.js), Howler.js, image-phash |
| **Storage** | Photos, MP3s, metadata | Supabase or S3 |
| **Hosting** | Static site | Vercel |
| **Recognition** | Local perceptual hashing | Client-side only |

Everything runs in the browser. No backend needed.

---

## 🚀 Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/macamp0328/photo-signal.git
   cd photo-signal
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run locally**
   ```bash
   npm run dev
   ```

4. **Visit**  
   Open [http://localhost:5173](http://localhost:5173) (or your Vite dev URL) on your phone and allow camera access.

---

## 🗂️ Project Structure

```
photo-signal/
├── public/
│   ├── audio/
│   ├── images/
│   └── data.json
├── src/
│   ├── components/
│   │   ├── CameraFeed.tsx
│   │   ├── Overlay.tsx
│   │   └── Player.tsx
│   ├── utils/
│   │   ├── hash.ts
│   │   └── matcher.ts
│   └── App.tsx
└── README.md
```

---

## 🔮 Future Ideas

- External playback via ESP32 or Google Home.
- Audio-reactive visual overlays.
- Offline PWA experience.
- “Story mode” — written reflections fade in after the song ends.

---

## ⚖️ License

MIT © Miles Camp
