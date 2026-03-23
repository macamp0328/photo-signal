import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// ---------------------------------------------------------------------------
// DEV-only: fake camera injection via localStorage
//
// AI agents and developers can activate the fake camera by setting this key
// (via preview_eval) and reloading the page. The getUserMedia override is
// installed here — before React mounts — so it is in place when the app
// calls navigator.mediaDevices.getUserMedia after "Activate Camera" is clicked.
//
// Single clip:
//   localStorage.setItem('__dev_fakeCamera', JSON.stringify({
//     videoUrl: '/test-assets/camera/test_1_overcoats.3x-palindrome.webm',
//     concertId: 16, hash: 'a793504d19e5e1d4'
//   })); window.location.reload();
//
// Rotating clips (switches video every rotateEveryMs, default 10 000):
//   localStorage.setItem('__dev_fakeCamera', JSON.stringify({
//     clips: [
//       { videoUrl: '/test-assets/camera/test_1_overcoats.3x-palindrome.webm', concertId: 16, hash: 'a793504d19e5e1d4' },
//       { videoUrl: '/test-assets/camera/test_2_croy.3x-palindrome.webm',      concertId: 14, hash: 'd4dd0b2a73312693' },
//       { videoUrl: '/test-assets/camera/test_5_barna.3x-palindrome.webm',     concertId: 35, hash: 'fd81027f1ac0f5e0' },
//     ],
//     rotateEveryMs: 10000
//   })); window.location.reload();
//
// Clear: localStorage.removeItem('__dev_fakeCamera'); window.location.reload();
//
// Hash seeding: recognition-index-service.ts reads the same key and prepends
// all seeded hashes before the recognition index is passed to the worker.
// ---------------------------------------------------------------------------
if (import.meta.env.DEV) {
  (() => {
    try {
      const raw = localStorage.getItem('__dev_fakeCamera');
      if (!raw) return;

      interface ClipConfig {
        videoUrl: string;
        concertId?: number;
        hash?: string;
      }
      interface FakeCameraConfig extends ClipConfig {
        clips?: ClipConfig[];
        rotateEveryMs?: number;
        fps?: number;
        canvasWidth?: number;
        canvasHeight?: number;
      }

      const cfg = JSON.parse(raw) as FakeCameraConfig;

      // Normalise: single clip → clips array of length 1
      const clips: ClipConfig[] = Array.isArray(cfg.clips) ? cfg.clips : [cfg];
      if (clips.length === 0 || !clips[0]?.videoUrl) return;

      const fps = cfg.fps ?? 24;
      const canvasWidth = cfg.canvasWidth ?? 960;
      const canvasHeight = cfg.canvasHeight ?? 640;
      const rotateEveryMs = cfg.rotateEveryMs ?? 10_000;

      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const video = document.createElement('video');
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.setAttribute('aria-hidden', 'true');
      // Off-screen without opacity:0 — Chrome must composite to decode frames.
      video.style.cssText =
        'position:fixed;top:-200%;left:-200%;width:1px;height:1px;pointer-events:none;';

      const appendVideo = () => document.body.appendChild(video);
      if (document.body) appendVideo();
      else document.addEventListener('DOMContentLoaded', appendVideo);

      const drawFrame = () => {
        if (video.readyState < 2) return;
        const ta = canvasWidth / canvasHeight;
        const va = video.videoWidth / video.videoHeight;
        let sx = 0,
          sy = 0,
          sw = video.videoWidth,
          sh = video.videoHeight;
        if (va > ta) {
          sw = sh * ta;
          sx = (video.videoWidth - sw) / 2;
        } else {
          sh = sw / ta;
          sy = (video.videoHeight - sh) / 2;
        }
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvasWidth, canvasHeight);
      };

      let clipIndex = 0;

      const loadClip = (index: number) => {
        const clip = clips[index % clips.length];
        if (!clip?.videoUrl) return;
        video.src = clip.videoUrl;
        video.load();
        video.play().catch(() => {}); // autoplay may be blocked; resolved later in onLoaded
        console.info(
          `[dev] fake camera → clip ${index % clips.length}: concertId=${clip.concertId ?? '?'}`
        );
      };

      // Rotate through clips on a timer (only meaningful when clips.length > 1)
      if (clips.length > 1) {
        setInterval(() => {
          clipIndex = (clipIndex + 1) % clips.length;
          loadClip(clipIndex);
        }, rotateEveryMs);
      }

      const streamPromise = new Promise<MediaStream>((resolve, reject) => {
        const onLoaded = () => {
          video.removeEventListener('loadeddata', onLoaded);
          video.removeEventListener('error', onError);
          video.play().catch(() => {});
          const rAF = () => {
            drawFrame();
            requestAnimationFrame(rAF);
          };
          rAF();
          resolve(canvas.captureStream(fps));
        };
        const onError = () => {
          video.removeEventListener('loadeddata', onLoaded);
          video.removeEventListener('error', onError);
          reject(new Error(`[fake-camera] load failed: ${clips[0]?.videoUrl ?? ''}`));
        };
        // Load the first clip
        loadClip(0);
        if (video.readyState >= 2) onLoaded();
        else {
          video.addEventListener('loadeddata', onLoaded, { once: true });
          video.addEventListener('error', onError, { once: true });
        }
      });

      if (navigator.mediaDevices?.getUserMedia) {
        navigator.mediaDevices.getUserMedia = () => streamPromise;
      }

      console.info(
        `[dev] fake camera injected: ${clips.length} clip(s)${clips.length > 1 ? `, rotating every ${rotateEveryMs}ms` : ''}`
      );
    } catch {
      // Never break app startup
    }
  })();
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
