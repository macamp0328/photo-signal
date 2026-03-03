# Cloudflare Worker + R2 Media Proxy

This Worker serves private R2 media to the app without exposing the bucket publicly.

## Content Rights and Source Pipeline Note

This project's photo assets are original photographs, but audio rights remain with the respective
copyright owners.

The audio workflow (download → transcode → upload) is documented as a technical pipeline built with
open-source libraries for private/home use testing and playback.

This documentation does not grant redistribution rights. Any public deployment should use only audio
that you own or are explicitly licensed to host and distribute.

## Current Implementation

- Worker entry: `cloudflare/worker.ts`
- Wrangler config: `wrangler.toml`
- R2 binding: `AUDIO`
- Allowed asset prefixes:
  - `/prod/audio/...`
  - `/prod/photos/...`

Only `GET`, `HEAD`, and `OPTIONS` are supported.

## CORS and Origin Rules

Origins are controlled by `ALLOWED_ORIGINS` in `wrangler.toml`.

- Exact origins are supported (`https://www.whoisduck2.com`)
- Single-wildcard hostname patterns are supported (for example `https://photo-signal-*.vercel.app`)
- Non-CORS requests can be additionally protected with optional `SHARED_SECRET`

If `SHARED_SECRET` is set, non-CORS requests must include:

- `X-PS-Shared-Secret: <value>`

## Response Behavior

The Worker currently provides:

- Content-Type inference by extension (`.opus`, `.jpg`, `.webp`, `.json`, etc.)
- ETag + conditional `If-None-Match` handling (`304`)
- Byte-range support (`206` / `416`) for streaming
- Cache-Control:
  - media files: long immutable cache
  - metadata files: short cache

## Deploy

```bash
npm run worker:deploy
```

(Equivalent to `npm exec wrangler -- deploy --minify`.)

## Update Runtime Data to Worker URLs

After Worker deployment, rewrite runtime data URLs:

```bash
npm run apply-cdn-to-data -- --base-url=https://<worker-domain> --prefix=prod/audio --photo-prefix=prod/photos
```

This updates:

- `audioFile` → `https://<worker-domain>/prod/audio/<filename>`
- `photoUrl` → `https://<worker-domain>/prod/photos/<filename>`

## Validate End-to-End

Quick validation:

```bash
npm run validate-audio -- --origin=https://www.whoisduck2.com --source=public/data.app.v2.json
```

Trace a failing path:

```bash
npm run trace-audio
```

Manual photo probe:

```bash
curl -I https://<worker-domain>/prod/photos/<photo-file>.jpg
```

## Failure Triage

- `403 Forbidden`: origin not allowed (or missing/invalid shared secret for protected non-CORS calls)
- `404 Not found`: object key/path mismatch between dataset URL and R2 object
- `416 Requested Range Not Satisfiable`: invalid range request from client/proxy layer
- `200/206` but no playback: browser/runtime audio decode/autoplay issue, not Worker reachability

## Operational Checklist

Before production rollout:

1. Deploy Worker (`npm run worker:deploy`)
2. Rewrite dataset URLs (`npm run apply-cdn-to-data ...`)
3. Validate all audio URLs (`npm run validate-audio ...`)
4. Spot-check media via curl/browser
5. Confirm app playback on target mobile browsers
