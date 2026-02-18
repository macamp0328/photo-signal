# Cloudflare Worker Audio Proxy

Use this Worker to serve private R2 audio objects to the Photo Signal web app without making the bucket public.

## Worker Basics

- Entry point: `cloudflare/worker.ts`
- Config: `wrangler.toml` (`AUDIO` binding to `photo-signal-audio`)
- Supported paths: `/prod/audio/<filename>` and `/prod/audio/<concertId>/<filename>`
- CORS: restricts to `ALLOWED_ORIGINS` (defaults to production site + localhost)
- Optional hardening: set `SHARED_SECRET` to require `X-PS-Shared-Secret` on non-CORS calls

### Required Wrangler Vars

```toml
[[r2_buckets]]
binding = "AUDIO"
bucket_name = "photo-signal-audio"

[vars]
ALLOWED_ORIGINS = "https://www.whoisduck2.com,https://whoisduck2.com,https://photo-signal.vercel.app,https://photo-signal-*.vercel.app,https://photo-signal.whoisduck2.workers.dev,https://photo-signal.whoisduck2.com,http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173"
SHARED_SECRET = "generate-a-random-value" # optional
```

If you need to allow preview deployments, you can add a wildcard entry (e.g.,
`https://photo-signal-*.vercel.app`) to `ALLOWED_ORIGINS` to keep those CORS-eligible
without redeploying for every branch.

Publish with:

```bash
wrangler deploy --minify
```

## Data Updates

After deploying the Worker (e.g., `https://audio.example.com`), rewrite `public/data.json`:

```bash
npm run apply-cdn-to-data -- --base-url=https://audio.example.com --prefix=prod/audio
```

This sets `audioFile` to `https://audio.example.com/prod/audio/<filename>` (flat key layout).

If you intentionally use id-scoped object keys (`<id>/<filename>`), update data URLs to match that
shape with your own rewrite step so Worker paths and R2 keys stay aligned.

## Validation

Verify that Worker URLs are reachable:

```bash
npm run validate-audio -- --base-url=https://audio.example.com --prefix=prod/audio
```

All URLs should return 200/304 with correct CORS headers.

## End-to-End Troubleshooting (Local file → R2/Worker → App playback)

Use this exact sequence when audio fails on mobile production:

1. Run a full production trace against the live origin:

```bash
npm run trace-audio
```

2. Confirm in trace output:
   - `Primary GET: 200`
   - `HEAD probe: 200`
   - `Range probe: 206`
   - `Access-Control-Allow-Origin: https://www.whoisduck2.com`

3. If trace fails with `403`, add your exact app origin to `ALLOWED_ORIGINS` in `wrangler.toml` and redeploy Worker.

4. If trace fails with `404`, your dataset URL path and R2 object key differ.
   - Compare `Worker key candidate` from trace to uploaded R2 key names.
   - Align either data URLs or upload prefix/key layout.

5. If trace passes but phone still has no audio:
   - This is app/runtime behavior (not Cloudflare reachability).
   - On Android Chrome, tap screen and use the in-app `Play` control once to satisfy autoplay policies.
   - Look for the playback prompt: `Playback blocked by browser autoplay rules. Touch screen and tap Play again.`

6. Validate all tracks after fixing one:

```bash
npm run validate-audio -- --source=public/data.json --origin=https://www.whoisduck2.com
```

## Root Cause Analysis (2026-02-18)

### What was reproduced

The following command reproduces the current production failure pattern:

```bash
npm run validate-audio -- --trace --concert-id=1 --origin=https://www.whoisduck2.com --source=public/data.json
```

Observed output:

- `Primary GET: 200`, `HEAD probe: 200`, `Range probe: 206` for valid objects
- Validation summary: `Successful: 56 (61.5%)`, `Failed: 35`
- Every failure was `404 Not Found` for the same object path: `/prod/audio/concert-4.opus`

### Technical root cause

The root cause is **dataset/object mismatch**, not a Howler runtime bug:

1. App playback entry points all consume `concert.audioFile` from `public/data.json`:
   - Auto play: `src/App.tsx` (`play(selectedAudioUrl)` in recognized-concert effect)
   - Play button: `src/App.tsx` (`handleTogglePlayback`)
   - Play test song: `src/App.tsx` (`loadTestAudioUrl`) + `src/modules/debug-overlay/useAudioTest.ts`
2. Many concerts currently point to `.../prod/audio/concert-4.opus` in `public/data.json`.
3. Worker + R2 return `404` for that key, so all feature paths fail when they target those records.

### Scope confirmation (R2 response vs browser vs Howler)

- **R2/Worker behavior:** mixed (healthy for existing keys, failing for missing keys)
- **Browser/Howler integration:** healthy for valid keys (`200/206` responses play normally)
- **Primary failing component:** data/R2 object coverage (missing object for URL present in dataset)

If debug overlay shows:

- `fetch: 200`
- `cors: No header` (or `Not exposed to browser`)
- `playback: load-error`
- `Content-Type: audio/ogg; codecs=opus`

that means network reachability is fine, and the likely app/runtime issue is **codec decode support**
on the current browser (for example, browsers that do not decode Ogg Opus).

### Feature-by-feature reproduction

1. **Auto play (photo detected):** detect a concert whose `audioFile` is `/prod/audio/concert-4.opus` → playback fails with load error.
2. **Play button:** with the same recognized/active concert, tapping Play retries the same missing URL → same failure.
3. **Play test song:** uses first available `audioFile` from data. If the first record is a missing key in an environment, the test also fails for the same reason.

### Recommended remediation

1. Regenerate or patch `public/data.json` so all `audioFile` entries map to uploaded objects.
2. Upload a real `concert-4.opus` fallback object (short-term mitigation) **or** stop emitting that fallback URL.
3. Gate releases with:
   ```bash
   npm run validate-audio -- --source=public/data.json --origin=https://www.whoisduck2.com
   ```
   and require `100%` success before deploy.
4. Keep Worker CORS allowlist checks (`--origin=...`) in place, but treat `404` as data/object mismatch first.
