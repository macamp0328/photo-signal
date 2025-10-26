# photo-signal
A quiet, camera-based gallery that plays music when you point at a printed photo.

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

## Setup

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/macamp0328/photo-signal.git
   cd photo-signal
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Add an MP3 file:
   - Place your MP3 file at `public/audio/sample.mp3`
   - Or update the `audioFile` paths in `public/data.json`

### Development

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:3000` (or another port if 3000 is in use).

### Build

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Usage

1. Open the app on a mobile device or desktop with camera access
2. Grant camera permissions when prompted
3. Point the camera at a photo within the 3:2 overlay guide
4. After ~3 seconds, the app will "recognize" the photo (placeholder logic)
5. Concert information will appear and music will start playing
6. Move the camera to fade out the music

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

The current implementation uses placeholder logic that triggers after 3 seconds. To implement real photo recognition, modify the `Camera.tsx` component to integrate with your preferred image recognition service.

## Project Structure

```
photo-signal/
├── public/
│   ├── audio/           # MP3 files
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
└── package.json         # Dependencies and scripts
```

## License

ISC

