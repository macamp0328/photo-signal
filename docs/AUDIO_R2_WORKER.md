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

This sets `audioFile` to `https://audio.example.com/prod/audio/<id>/<filename>`.

If your bucket keys are flat (no `<id>` folder), keep data URLs as
`https://audio.example.com/prod/audio/<filename>` and do not rewrite to id-scoped paths.

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
