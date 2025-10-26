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
| **Frontend** | Camera view, motion detection, playback | React (Vite), TypeScript, Tailwind CSS, Howler.js |
| **Storage** | Photos, MP3s, metadata | Local (public folder) |
| **Hosting** | Static site | Vercel or similar |
| **Recognition** | Placeholder (3-sec timer) | Client-side only |

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
│   ├── audio/              # MP3 files (add your own)
│   └── data.json           # Concert metadata
├── src/
│   ├── components/
│   │   ├── Camera.tsx      # Camera feed with motion detection
│   │   ├── AudioPlayer.tsx # Howler.js audio player
│   │   └── InfoDisplay.tsx # Concert info overlay
│   ├── App.tsx             # Main app component
│   ├── main.tsx            # Entry point
│   ├── types.ts            # TypeScript types
│   └── index.css           # Global styles with Tailwind
├── index.html              # HTML entry point
├── vite.config.ts          # Vite configuration
├── tsconfig.json           # TypeScript configuration
└── package.json            # Dependencies and scripts
```

## 📝 Configuration

### Concert Data

Edit `public/data.json` to add your own concert data:

```json
{
  "concerts": [
    {
      "id": 1,
      "band": "Band Name",
      "venue": "Venue Name",
      "date": "2023-08-15",
      "audioFile": "/audio/sample.mp3"
    }
  ]
}
```

### Adding Audio

Place your MP3 files in the `public/audio/` directory and reference them in `data.json`.

### Photo Recognition

The current implementation uses placeholder logic that triggers after 3 seconds. To implement real photo recognition, modify the `Camera.tsx` component to integrate with your preferred image recognition service.

---

## 🔮 Future Ideas

- External playback via ESP32 or Google Home.
- Audio-reactive visual overlays.
- Offline PWA experience.
- “Story mode” — written reflections fade in after the song ends.

---

## ⚖️ License

MIT © Miles Camp
