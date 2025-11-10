# 📸 Photo Signal

> A quiet, camera-based gallery that plays music when you point at a printed photo.

---

## 🌄 Concept

**Photo Signal** is an experiment in memory, music, and perception.  
Visitors use their phone's camera to look at printed photographs — the site recognizes each image, displays its details, and plays a song tied to that moment.

It's a small-scale, in-home installation: no QR codes, no visible markers.  
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

| Layer           | Role                                    | Tech                                      |
| --------------- | --------------------------------------- | ----------------------------------------- |
| **Frontend**    | Camera view, hash recognition, playback | React (Vite), Howler.js, TypeScript       |
| **Storage**     | Photos, MP3s, metadata                  | Local JSON (expandable to Supabase or S3) |
| **Hosting**     | Static site                             | Vercel                                    |
| **Recognition** | Placeholder logic (3s delay)            | Client-side only                          |

Everything runs in the browser. No backend needed.

---

## Features

- **Mobile-First Design**: Optimized for mobile devices with touch support
- **Rear Camera Access**: Opens device's rear camera with 3:2 aspect ratio overlay
- **Photo Recognition**: Placeholder logic simulates photo recognition (triggers after 3 seconds)
- **Concert Information Display**: Shows band name, venue, and date when photo is recognized
- **Audio Playback**: Uses Howler.js to play MP3 files
- **Motion Detection**: Fades out audio when camera movement is detected

## Tech Stack

- **Vite** - Fast build tool and dev server
- **React** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS framework
- **Howler.js** - Audio playback library

---

## 🚀 Setup

### Prerequisites

- **Option 1 (Recommended)**: Docker Desktop (for fully containerized development)
- **Option 2**: Node.js 20+ and npm

### Quick Start with Docker 🐳

The easiest way to get started, especially on Mac:

```bash
# Clone the repo
git clone https://github.com/macamp0328/photo-signal.git
cd photo-signal

# Start development server with Docker
USE_DOCKER=true ./scripts/dev.sh
```

Visit [http://localhost:5173](http://localhost:5173) on your phone and allow camera access.

**See [DOCKER.md](./DOCKER.md) for complete Docker documentation.**

### Installation (Local Development)

1. **Clone the repo**

   ```bash
   git clone https://github.com/macamp0328/photo-signal.git
   cd photo-signal
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Add an MP3 file**
   - Place your MP3 file at `public/audio/sample.mp3`
   - Or update the `audioFile` paths in `public/data.json`

### Development

Start the development server:

```bash
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173) on your phone and allow camera access.

### Build

Build for production:

```bash
npm run build
```

Or with Docker:

```bash
USE_DOCKER=true ./scripts/build.sh
```

### Testing

Run tests:

```bash
npm test
```

Or with Docker:

```bash
USE_DOCKER=true ./scripts/test.sh
```

Preview the production build:

```bash
npm run preview
```

---

## Usage

1. Open the app on a mobile device or desktop with camera access
2. Grant camera permissions when prompted
3. Point the camera at a photo within the 3:2 overlay guide
4. After ~3 seconds, the app will "recognize" the photo (placeholder logic)
5. Concert information will appear and music will start playing
6. Move the camera to fade out the music

---

## Configuration

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

### Photo Recognition

The current implementation uses placeholder logic that triggers after 3 seconds. To implement real photo recognition, modify the `Camera.tsx` component to integrate with your preferred image recognition service (e.g., image-phash or ML-based matching).

---

## 📚 Documentation

For complete documentation including architecture, setup, testing, and all module READMEs, see:

**[DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md)** - Central index of all project documentation

Key docs:

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Module structure and design principles
- **[SETUP.md](./SETUP.md)** - Development environment and CI/CD setup
- **[AI_AGENT_GUIDE.md](./AI_AGENT_GUIDE.md)** - Guide for parallel AI development
- **[TESTING.md](./TESTING.md)** - Testing strategy

---

## 🗂️ Project Structure

```
photo-signal/
├── assets/              # Test assets (CC0 licensed)
│   ├── test-images/     # Sample JPEG images for testing
│   ├── test-audio/      # Sample MP3 files for testing
│   └── test-data/       # Sample JSON/CSV data files
├── public/
│   ├── audio/           # MP3 files
│   ├── images/          # Photo storage (future)
│   ├── data.json        # Concert data
│   └── vite.svg         # Favicon
├── src/
│   ├── components/
│   │   ├── AudioPlayer.tsx    # Howler.js audio player
│   │   ├── Camera.tsx         # Camera with motion detection
│   │   └── InfoDisplay.tsx    # Concert info overlay
│   ├── App.tsx          # Main app component
│   ├── main.tsx         # Entry point
│   ├── types.ts         # TypeScript types
│   └── index.css        # Global styles with Tailwind
├── index.html           # HTML entry point
├── vite.config.ts       # Vite configuration
├── tailwind.config.js   # Tailwind configuration
├── tsconfig.json        # TypeScript configuration
├── package.json         # Dependencies and scripts
└── ASSET_LICENSES.md    # Licensing info for test assets
```

---

## 🧪 Test Data

The repository includes sample test assets to facilitate development and testing without requiring production data:

### Test Assets Location

- **Images**: `assets/test-images/` - 4 sample JPEG images (~30KB each)
- **Audio**: `assets/test-audio/` - 4 sample MP3 files (~40KB each, 5 seconds)
- **Data**: `assets/test-data/` - Sample JSON and CSV data files

### License

All test assets are CC0 (Public Domain) licensed. See [ASSET_LICENSES.md](./ASSET_LICENSES.md) for complete details.

### Usage

Test assets are suitable for:

- Module and service-level testing
- Development without production data
- Verifying photo recognition, audio playback, and data loading features
- CI/CD pipeline testing

Each asset directory contains a README with detailed specifications and usage examples.

---

## 🔮 Future Ideas

- External playback via ESP32 or Google Home.
- Audio-reactive visual overlays.
- Offline PWA experience.
- "Story mode" — written reflections fade in after the song ends.
- Real photo recognition using perceptual hashing (image-phash).

---

## ⚖️ License

MIT © Miles Camp
