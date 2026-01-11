# Cloudflare Worker Audio Proxy

Use this Worker to serve private R2 audio objects to the Photo Signal web app without making the bucket public.

## Worker Basics

- Entry point: `cloudflare/worker.ts`
- Config: `wrangler.toml` (`AUDIO` binding to `photo-signal-audio`)
- Default path: `/prod/audio/<concertId>/<filename>`
- CORS: restricts to `ALLOWED_ORIGINS` (defaults to production site + localhost)
- Optional hardening: set `SHARED_SECRET` to require `X-PS-Shared-Secret` on non-CORS calls

### Required Wrangler Vars

```toml
[[r2_buckets]]
binding = "AUDIO"
bucket_name = "photo-signal-audio"

[vars]
ALLOWED_ORIGINS = "https://www.whoisduck2.com,https://whoisduck2.com,https://photo-signal-*.vercel.app,http://localhost:5173"
SHARED_SECRET = "generate-a-random-value" # optional
```

The `*.vercel.app` wildcard keeps Vercel preview deployments (e.g.,
`https://photo-signal-git-feat-prod-audio-r2.macamp0328.vercel.app`) CORS-eligible
without needing to redeploy the Worker for every branch.

Publish with:

```bash
wrangler deploy --minify
```

## Data Updates

After deploying the Worker (e.g., `https://audio.example.com`), rewrite `public/data.json`:

```bash
npm run apply-cdn-to-data -- --base-url=https://audio.example.com --prefix=prod/audio
```

This sets `audioFile` to `https://audio.example.com/prod/audio/<id>/<filename>` and preserves fallbacks.

## Validation

Verify that Worker URLs are reachable:

```bash
npm run validate-audio -- --base-url=https://audio.example.com --prefix=prod/audio
```

All URLs should return 200/304 with correct CORS headers.
