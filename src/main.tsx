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
// Set:   localStorage.setItem('__dev_fakeCamera', JSON.stringify({ videoUrl, concertId, hash }))
//        then window.location.reload()
// Clear: localStorage.removeItem('__dev_fakeCamera')  then reload
//
// hash seeding (recognition-index-service.ts reads the same key on load to
// prepend the seeded hash to the matching concert's phash array).
// ---------------------------------------------------------------------------
if (import.meta.env.DEV) {
  (() => {
    try {
      const raw = localStorage.getItem('__dev_fakeCamera');
      if (!raw) return;
      const cfg = JSON.parse(raw) as {
        videoUrl: string;
        fps?: number;
        canvasWidth?: number;
        canvasHeight?: number;
      };
      if (!cfg.videoUrl) return;

      const fps = cfg.fps ?? 24;
      const canvasWidth = cfg.canvasWidth ?? 960;
      const canvasHeight = cfg.canvasHeight ?? 640;

      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const video = document.createElement('video');
      video.src = cfg.videoUrl;
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

      const streamPromise = new Promise<MediaStream>((resolve, reject) => {
        const onLoaded = () => {
          video.removeEventListener('loadeddata', onLoaded);
          video.removeEventListener('error', onError);
          void video.play();
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
          reject(new Error(`[fake-camera] load failed: ${cfg.videoUrl}`));
        };
        if (video.readyState >= 2) onLoaded();
        else {
          video.addEventListener('loadeddata', onLoaded, { once: true });
          video.addEventListener('error', onError, { once: true });
        }
      });

      if (navigator.mediaDevices?.getUserMedia) {
        navigator.mediaDevices.getUserMedia = () => streamPromise;
      }

      console.info('[dev] fake camera injected from localStorage.__dev_fakeCamera');
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
