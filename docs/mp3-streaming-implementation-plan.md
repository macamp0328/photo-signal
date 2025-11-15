# Production MP3 Streaming - Implementation Plan

> **Created**: 2025-11-15  
> **Status**: Ready for Implementation  
> **Estimated Effort**: 2-3 days (solo developer) | 1-2 days (parallel AI agents)

---

## Overview

### Problem Statement

Photo Signal currently stores all MP3 audio files in the `/public/audio/` directory, which works well for the 6-file demo (~4MB total) but does not scale to a production library of 100+ tracks. Committing large binary files to the git repository causes:

- **Repository bloat**: Slows down clone/pull operations
- **Git LFS costs**: GitHub LFS has limited free quota (1GB storage, 1GB bandwidth/month)
- **Deployment overhead**: Vercel deployments upload all static assets on every build
- **Poor developer experience**: Large repo discourages contribution

### Success Criteria

**✅ Done looks like:**

1. **Fast playback**: MP3 streaming starts in <1 second on fast wifi (same as current local files)
2. **Full library access**: Test Mode supports 100+ tracks with instant switching
3. **Clean repository**: Production MP3s removed from git; only demo starter pack remains
4. **Dual-mode support**: 
   - **Production mode**: Streams from CDN
   - **Local/offline mode**: Falls back to `/public/audio/` for development
5. **Automation-ready**: Migration script can be run by AI agents or developers
6. **Cost-effective**: Free tier or <$5/month for expected usage

### Who Will Use This

- **End users**: Will stream audio from CDN (transparent to them)
- **Developers**: Will use local audio files for development
- **AI agents**: Will run migration scripts to upload/sync MP3s
- **Maintainers**: Will manage CDN uploads and data.json updates

---

## Technical Approach

### Recommended Solution: GitHub Releases + Cloudflare R2 (Hybrid)

After evaluating all options, a **hybrid approach** is recommended:

**Phase 1 (MVP): GitHub Releases Only**
- **Storage**: GitHub Releases (2GB per file, unlimited bandwidth)
- **Pros**: Zero cost, zero config, integrated with existing GitHub workflow
- **Cons**: Manual upload via GitHub UI or API

**Phase 2 (Scale): Cloudflare R2 for large libraries**
- **Storage**: Cloudflare R2 (10GB free, no egress fees)
- **Pros**: Scriptable uploads, fast global CDN, no bandwidth charges
- **Cons**: Requires Cloudflare account and API credentials

**Why this approach?**

| Option | Cost | Bandwidth | CORS | Automation | Verdict |
|--------|------|-----------|------|------------|---------|
| **GitHub Releases** | Free | Unlimited | ✅ Yes | GitHub API | ✅ **Best for MVP** |
| **Cloudflare R2** | $0-5/mo | Free | ✅ Yes | S3 API | ✅ **Best for scale** |
| Backblaze B2 | Free tier | 1GB/day free | ✅ Yes | S3 API | ⚠️ Bandwidth limits |
| Bunny.net | Free tier | 100GB/mo | ✅ Yes | API | ⚠️ Bandwidth limits |

**Decision**: Start with GitHub Releases (zero friction), migrate to R2 when library exceeds 50 tracks or automation needs increase.

### Data Model Changes

**Current `Concert` interface:**

```typescript
export interface Concert {
  id: number;
  band: string;
  venue: string;
  date: string;
  audioFile: string;  // "/audio/concert-1.mp3"
  imageFile?: string;
  photoHash?: string;
}
```

**New `Concert` interface (backward compatible):**

```typescript
export interface Concert {
  id: number;
  band: string;
  venue: string;
  date: string;
  audioFile: string;           // CHANGED: Now supports URLs
  audioFileFallback?: string;  // NEW: Local fallback path
  audioFileSource?: 'local' | 'cdn' | 'github-release' | 'r2';  // NEW: Optional metadata
  imageFile?: string;
  photoHash?: string;
}
```

**Migration path:**

1. **Local development**: `audioFile: "/audio/concert-1.mp3"`
2. **Production (GitHub Releases)**: 
   ```json
   {
     "audioFile": "https://github.com/username/photo-signal/releases/download/audio-v1/concert-1.mp3",
     "audioFileFallback": "/audio/concert-1.mp3"
   }
   ```
3. **Production (R2)**: 
   ```json
   {
     "audioFile": "https://audio.photo-signal.example.com/concert-1.mp3",
     "audioFileFallback": "/audio/concert-1.mp3"
   }
   ```

**Fallback logic in audio playback hook:**

```typescript
// In useAudioPlayback.ts
const loadAudioWithFallback = async (concert: Concert) => {
  try {
    // Try primary URL (CDN)
    await loadAudio(concert.audioFile);
  } catch (error) {
    // Fallback to local file if available
    if (concert.audioFileFallback) {
      console.warn(`CDN load failed for ${concert.audioFile}, using fallback`);
      await loadAudio(concert.audioFileFallback);
    } else {
      throw error;
    }
  }
};
```

### Architecture Integration

**Existing modules (NO CHANGES NEEDED):**

- ✅ `camera-access/` - Camera module unaffected
- ✅ `motion-detection/` - Motion module unaffected
- ✅ `photo-recognition/` - Recognition module unaffected
- ✅ `concert-info/` - Info display module unaffected
- ✅ `camera-view/` - Video UI module unaffected

**Modified modules:**

- ⚠️ `audio-playback/` - Add fallback logic to `useAudioPlayback.ts` (5-10 lines)
- ⚠️ `data-service/` - Optional: Add URL validation helpers (10-15 lines)

**No breaking changes** - Existing local development workflow continues to work.

---

## Implementation Plan

### Phase 1: Foundation (1 day)

**Objective**: Set up GitHub Releases for MP3 storage and update data model.

**Tasks:**

1. **Update TypeScript types** ⚡ Small
   - Add optional `audioFileFallback` field to `Concert` interface
   - Add optional `audioFileSource` metadata field
   - **File**: `src/types/index.ts`
   - **Lines changed**: ~5 lines

2. **Add fallback logic to audio playback** ⚡ Small
   - Modify `useAudioPlayback.ts` to try primary URL, fallback to local
   - Add error logging for debugging
   - **File**: `src/modules/audio-playback/useAudioPlayback.ts`
   - **Lines changed**: ~10 lines
   - **Dependencies**: Requires Task 1

3. **Create GitHub Release for audio assets** ⚡ Small (Manual)
   - Create new release: `audio-v1.0`
   - Upload existing 6 MP3 files from `/public/audio/`
   - Document release in `public/audio/README.md`
   - **Manual step**: Via GitHub UI or GitHub CLI

4. **Update sample data.json with GitHub Release URLs** ⚡ Small
   - Update `/public/data.json` to use GitHub Release URLs
   - Keep `audioFileFallback` pointing to local files
   - **File**: `public/data.json`
   - **Lines changed**: ~12 lines (one per concert)

5. **Test streaming vs local playback** 🧪 Medium
   - Verify CDN playback works in production mode
   - Verify fallback works when CDN unreachable (disconnect internet)
   - Measure latency: time from click to audio start
   - **Acceptance**: <1s latency on fast wifi, fallback works offline

**Deliverables:**

- ✅ GitHub Release `audio-v1.0` created with 6 demo MP3s
- ✅ Updated `Concert` interface with fallback support
- ✅ Updated `useAudioPlayback` with fallback logic
- ✅ Updated `data.json` pointing to GitHub Release URLs
- ✅ Test report confirming <1s streaming latency

**Risks:**

- ⚠️ GitHub may rate-limit anonymous downloads (mitigated: public releases have high limits)
- ⚠️ CORS issues if GitHub changes headers (unlikely, widely used for this purpose)

---

### Phase 2: Automation & Migration (1 day)

**Objective**: Create scripts to automate MP3 uploads and data.json updates.

**Tasks:**

1. **Create migration script: `scripts/migrate-audio-to-cdn.js`** 🔧 Medium
   - **Purpose**: Upload MP3s to GitHub Releases and update data.json
   - **Features**:
     - Scan `/public/audio/*.mp3` files
     - Upload to GitHub Release via API
     - Update `data.json` with new URLs
     - Backup original `data.json`
     - Dry-run mode for testing
   - **Technology**: Node.js script using `@actions/github` or `octokit`
   - **Lines**: ~150 lines
   - **Dependencies**: Requires Phase 1 completion

2. **Add npm script shortcuts** ⚡ Small
   - Add `npm run migrate:audio` to package.json
   - Add `npm run migrate:audio:dry-run` for testing
   - **File**: `package.json`
   - **Lines changed**: ~2 lines

3. **Create validation script: `scripts/validate-audio-urls.js`** 🔧 Small
   - **Purpose**: Verify all audio URLs in data.json are accessible
   - **Features**:
     - Load `data.json`
     - Test HTTP HEAD request to each `audioFile` URL
     - Report broken links
     - Check fallback paths exist
   - **Lines**: ~80 lines

4. **Document migration process** 📝 Small
   - Create `docs/audio-cdn-migration-guide.md`
   - Step-by-step guide for humans and AI agents
   - Troubleshooting common issues
   - **Lines**: ~100 lines markdown

5. **Add `.mp3` to `.gitignore` (production files only)** ⚡ Small
   - Keep `/public/audio/concert-*.mp3` tracked (demo files)
   - Ignore `/public/audio/production-*.mp3` (future production files)
   - **File**: `.gitignore`
   - **Lines changed**: ~3 lines

**Deliverables:**

- ✅ `scripts/migrate-audio-to-cdn.js` - Automated migration script
- ✅ `scripts/validate-audio-urls.js` - URL validation script
- ✅ `docs/audio-cdn-migration-guide.md` - Migration documentation
- ✅ Updated `.gitignore` to prevent future MP3 commits
- ✅ npm scripts for easy execution

**Risks:**

- ⚠️ GitHub API rate limits (mitigated: use authenticated requests, higher limits)
- ⚠️ Script fails mid-migration (mitigated: backup data.json, idempotent script)

---

### Phase 3: Optimization & Documentation (0.5 days)

**Objective**: Optimize MP3 files for streaming and document the new system.

**Tasks:**

1. **Audit MP3 compression settings** 🔧 Medium
   - Check bitrate of existing files (`ffprobe`)
   - Recommend optimal bitrate (128kbps for voice, 192-256kbps for music)
   - Create compression script if needed
   - **Tool**: ffmpeg
   - **Lines**: ~50 lines bash script

2. **Update architecture documentation** 📝 Small
   - Update `ARCHITECTURE.md` with CDN architecture diagram
   - Document fallback logic and error handling
   - **File**: `ARCHITECTURE.md`
   - **Lines changed**: ~30 lines

3. **Update DOCUMENTATION_INDEX.md** 📝 Small
   - Add link to `docs/audio-cdn-migration-guide.md`
   - Add link to `docs/mp3-streaming-implementation-plan.md` (this file)
   - **File**: `DOCUMENTATION_INDEX.md`
   - **Lines changed**: ~2 lines

4. **Update public/audio/README.md** 📝 Small
   - Document new CDN vs local workflow
   - Explain when to use local files (dev) vs CDN (prod)
   - Link to migration guide
   - **File**: `public/audio/README.md`
   - **Lines changed**: ~20 lines

5. **Create privacy/compliance documentation** 📝 Medium
   - Document data storage locations (GitHub/R2)
   - GDPR considerations (no user data in audio files)
   - Bandwidth usage estimates
   - **File**: `docs/audio-cdn-privacy.md`
   - **Lines**: ~60 lines markdown

**Deliverables:**

- ✅ MP3 compression recommendations and/or script
- ✅ Updated architecture documentation
- ✅ Updated DOCUMENTATION_INDEX.md
- ✅ Updated public/audio/README.md
- ✅ Privacy/compliance documentation

**Risks:**

- ⚠️ Over-compression degrades audio quality (mitigated: test sample before batch conversion)

---

### Phase 4 (Future): Cloudflare R2 Migration (Optional)

**Trigger**: When library exceeds 50 tracks or automation needs increase.

**Objective**: Migrate from GitHub Releases to Cloudflare R2 for better automation.

**Tasks:**

1. **Set up Cloudflare R2 bucket** 🔧 Small
   - Create R2 bucket: `photo-signal-audio`
   - Configure public access with custom domain
   - Set up CORS headers
   - **Complexity**: Cloudflare dashboard + DNS configuration

2. **Create R2 upload script: `scripts/upload-to-r2.js`** 🔧 Medium
   - Uses AWS S3 SDK (R2 is S3-compatible)
   - Batch upload with progress reporting
   - Set appropriate Content-Type and Cache-Control headers
   - **Lines**: ~120 lines

3. **Migrate data.json to R2 URLs** ⚡ Small
   - Update URLs: `https://github.com/...` → `https://audio.photo-signal.example.com/...`
   - Run validation script
   - **File**: `public/data.json`

4. **Document R2 setup and migration** 📝 Medium
   - Create `docs/audio-r2-setup-guide.md`
   - Cloudflare account setup
   - DNS configuration
   - Cost estimates
   - **Lines**: ~150 lines markdown

**Deliverables:**

- ✅ Cloudflare R2 bucket configured
- ✅ R2 upload script
- ✅ Migrated data.json
- ✅ R2 setup documentation

**Cost Estimate:**

- **Free tier**: 10GB storage, unlimited bandwidth (egress free)
- **Paid tier**: $0.015/GB/month storage after 10GB
- **Expected cost**: $0/month for <200 tracks (~1GB total)

---

## Testing Strategy

### Unit Tests

**New tests to add:**

1. **Audio fallback logic** (`src/modules/audio-playback/useAudioPlayback.test.ts`)
   - Test successful CDN load
   - Test fallback to local file when CDN fails
   - Test error handling when both fail
   - Mock `Howl` constructor to simulate network failures

2. **Data service URL validation** (`src/services/data-service/DataService.test.ts`)
   - Test loading concerts with CDN URLs
   - Test loading concerts with local URLs
   - Test loading concerts with both primary + fallback

**Estimated lines**: ~100 lines total

### Integration Tests

**Manual testing checklist:**

- [ ] **Production mode (CDN)**: Audio streams from GitHub Release in <1s
- [ ] **Offline mode**: Audio falls back to local `/public/audio/` files
- [ ] **Test mode**: All test data concerts load from local files
- [ ] **Network throttling**: Test on slow 3G connection
- [ ] **Cross-browser**: Test on Chrome, Firefox, Safari
- [ ] **Mobile**: Test on iOS Safari, Android Chrome

### Performance Tests

**Metrics to measure:**

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Time to first byte (TTFB)** | <500ms | Chrome DevTools Network tab |
| **Audio start latency** | <1s | `performance.now()` from click to `onplay` |
| **Fallback latency** | <2s | Time from CDN failure to fallback success |
| **Bundle size impact** | +0KB | No new dependencies added |

**Baseline (current local files):**

- Time to audio start: ~300-500ms (local file load)

**Target (CDN streaming):**

- Time to audio start: <1s (network + decode)

---

## Migration Script Specification

### `scripts/migrate-audio-to-cdn.js`

**Purpose**: Automate MP3 upload to CDN and update data.json.

**Features:**

- ✅ Scan `/public/audio/*.mp3` files
- ✅ Upload to GitHub Release via Octokit API
- ✅ Update `data.json` with new CDN URLs
- ✅ Preserve `audioFileFallback` for local development
- ✅ Backup original `data.json` before modification
- ✅ Dry-run mode (`--dry-run` flag)
- ✅ Progress reporting with spinner or progress bar
- ✅ Idempotent (can be re-run safely)

**Usage:**

```bash
# Dry run (preview changes)
npm run migrate:audio:dry-run

# Real migration
npm run migrate:audio

# With custom release tag
npm run migrate:audio -- --release-tag=audio-v2.0
```

**Algorithm:**

```
1. Load data.json
2. Scan /public/audio/ for MP3 files
3. For each MP3:
   a. Check if already uploaded (compare filename in release)
   b. If not uploaded:
      - Upload to GitHub Release via API
      - Get download URL
   c. Find matching concert in data.json
   d. Update audioFile to GitHub Release URL
   e. Set audioFileFallback to original local path
4. Backup original data.json to data.json.backup
5. Write updated data.json
6. Print summary report
```

**Dependencies:**

```json
{
  "devDependencies": {
    "@octokit/rest": "^20.0.0",
    "form-data": "^4.0.0"
  }
}
```

**Environment variables:**

```bash
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx  # Personal access token with repo scope
GITHUB_REPO=username/photo-signal
```

**Error handling:**

- Network failures: Retry up to 3 times with exponential backoff
- Missing GITHUB_TOKEN: Print error with setup instructions
- API rate limit: Print error with reset time
- File not found: Skip with warning

**Output:**

```
🎵 Audio Migration to GitHub Releases
=====================================

Scanning /public/audio/ ...
Found 6 MP3 files

Checking GitHub Release: audio-v1.0
Release exists, checking uploaded files...

Uploading files:
✅ concert-1.mp3 (already uploaded)
✅ concert-2.mp3 (already uploaded)
⬆️  concert-3.mp3 (uploading...) 100% [1.9MB]
✅ concert-3.mp3 (uploaded)

Updating data.json:
✅ Backup created: data.json.backup
✅ Updated 6 concerts with CDN URLs
✅ data.json saved

Summary:
- 6 files processed
- 1 uploaded (5 already existed)
- 6 concerts updated in data.json

Next steps:
1. Commit updated data.json
2. Verify audio playback in production
3. Remove MP3 files from git (optional)
```

---

### `scripts/validate-audio-urls.js`

**Purpose**: Verify all audio URLs in data.json are accessible.

**Features:**

- ✅ Load data.json
- ✅ Test HTTP HEAD request to each `audioFile` URL
- ✅ Check fallback paths exist in filesystem
- ✅ Report broken links
- ✅ Color-coded output (green ✅, red ❌)
- ✅ Exit code 0 if all pass, 1 if any fail

**Usage:**

```bash
npm run validate:audio
```

**Output:**

```
🔍 Validating Audio URLs in data.json
======================================

Testing 6 concerts...

✅ Concert 1: The Midnight Echoes
   Primary: https://github.com/.../concert-1.mp3 (200 OK, 1.9MB)
   Fallback: /audio/concert-1.mp3 (exists)

✅ Concert 2: Electric Dreams
   Primary: https://github.com/.../concert-2.mp3 (200 OK, 1.9MB)
   Fallback: /audio/concert-2.mp3 (exists)

❌ Concert 3: Velvet Revolution
   Primary: https://github.com/.../concert-3.mp3 (404 Not Found)
   Fallback: /audio/concert-3.mp3 (exists)
   
Summary:
- 6 concerts tested
- 5 passed (83%)
- 1 failed (17%)

Failed URLs:
- Concert 3: https://github.com/.../concert-3.mp3
```

---

## Documentation Updates

### New Documentation Files

1. **`docs/mp3-streaming-implementation-plan.md`** (this file)
   - Complete implementation plan
   - Architecture decisions
   - Testing strategy

2. **`docs/audio-cdn-migration-guide.md`**
   - Step-by-step migration guide
   - Troubleshooting common issues
   - For humans and AI agents

3. **`docs/audio-cdn-privacy.md`**
   - Data storage locations
   - GDPR/privacy considerations
   - Bandwidth usage estimates

4. **`docs/audio-r2-setup-guide.md`** (Phase 4 - optional)
   - Cloudflare R2 setup
   - DNS configuration
   - Cost estimates

### Updated Documentation Files

1. **`ARCHITECTURE.md`**
   - Add CDN architecture diagram
   - Document fallback logic

2. **`DOCUMENTATION_INDEX.md`**
   - Add links to new docs

3. **`public/audio/README.md`**
   - Document CDN vs local workflow

4. **`src/modules/audio-playback/README.md`**
   - Document fallback behavior
   - Update examples with CDN URLs

5. **`src/services/data-service/README.md`**
   - Document URL formats supported

---

## Rollback Plan

### If CDN Migration Fails

**Scenario 1: GitHub Releases are slow (>3s latency)**

**Solution**: Revert `data.json` to local paths

```bash
# Restore backup
cp data.json.backup data.json
git checkout data.json  # Or restore from backup
```

**Impact**: Zero downtime, immediate revert

---

**Scenario 2: CORS issues prevent streaming**

**Root cause**: GitHub Release URLs don't allow cross-origin requests

**Solution**: 
1. Switch to Cloudflare R2 (has configurable CORS)
2. Or use local files for production (keep MP3s in repo)

**Prevention**: Test CORS in Phase 1 before full migration

---

**Scenario 3: Migration script corrupts data.json**

**Prevention**:
- Always backup before modification
- Use `--dry-run` flag to preview changes
- Version control catches issues

**Recovery**:
```bash
# Restore from backup
cp data.json.backup data.json

# Or restore from git
git checkout HEAD -- data.json
```

---

**Scenario 4: GitHub API rate limits block uploads**

**Root cause**: Too many requests in short period

**Solution**:
- Use authenticated requests (higher rate limits)
- Add delays between uploads
- Batch uploads in smaller chunks

**Prevention**: Script includes rate limit handling and retries

---

### Rollback Checklist

- [ ] Keep backup of `data.json` before migration
- [ ] Keep demo MP3 files in `/public/audio/` for fallback
- [ ] Test fallback logic works before removing local files
- [ ] Document revert process in migration guide

---

## Considerations

### Assumptions

1. **Network availability**: End users have reliable internet (app already requires internet for Vercel deployment)
2. **Free tier limits**: 100+ tracks fit within GitHub/R2 free tiers (~5-10GB total)
3. **Browser support**: Modern browsers support `<audio>` streaming (already true for Howler.js)
4. **CORS support**: CDN providers support CORS for audio streaming (verified for GitHub Releases and R2)

### Constraints

1. **Cost**: Must remain free or <$5/month
2. **Latency**: <1s audio start time (same as current local files)
3. **Developer experience**: Local development workflow must remain simple
4. **Zero breaking changes**: Existing code continues to work

### Technical Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| GitHub rate limits block downloads | Low | High | Use authenticated requests, cache audio in browser |
| CORS errors prevent streaming | Low | High | Test early, switch to R2 if needed |
| Slow CDN response (>3s) | Low | Medium | Use fallback to local files |
| Migration script data corruption | Medium | High | Always backup data.json, use dry-run mode |
| MP3 files too large for free tier | Low | Low | Compress audio to 128-192kbps |
| GitHub deletes old releases | Very Low | High | Keep backups, use R2 as secondary storage |

### Operational Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Developer forgets to update data.json | Medium | Low | Validation script catches broken URLs |
| New MP3s added to repo by mistake | Medium | Low | `.gitignore` prevents commits, CI checks file sizes |
| CDN goes down | Very Low | High | Fallback to local files, monitor uptime |
| Cost increases unexpectedly | Low | Medium | Set up billing alerts, use free tier providers |

---

## Not Included (Future Enhancements)

### Out of Scope for MVP

1. **Adaptive bitrate streaming** (ABR)
   - Multiple quality levels (64kbps, 128kbps, 256kbps)
   - Auto-switch based on network speed
   - **Reason**: Adds complexity, not needed for wifi-only use case

2. **Progressive download with caching**
   - Service Worker to cache MP3s in browser
   - Offline playback after first load
   - **Reason**: Good for PWA, but MVP focuses on streaming

3. **Multi-CDN failover**
   - Fallback from R2 → GitHub → Bunny.net
   - **Reason**: Single CDN with local fallback is sufficient

4. **Audio transcoding pipeline**
   - Automatically convert WAV/FLAC to MP3
   - Generate multiple bitrates
   - **Reason**: Manual conversion sufficient for now

5. **Usage analytics**
   - Track which songs are played most
   - Optimize CDN caching based on popularity
   - **Reason**: Privacy-first app, no analytics needed

6. **Dynamic playlist generation**
   - AI-generated playlists based on mood
   - **Reason**: Feature creep, not core to photo-matching UX

### Potential Future Milestones

**Milestone 5: Advanced Audio (Post-MVP)**

- Adaptive bitrate streaming
- Service Worker caching
- Playlist support

**Milestone 6: CDN Optimization (Growth Phase)**

- Multi-region CDN deployment
- Audio preloading on photo hover
- Bandwidth optimization

---

## Cost Analysis

### GitHub Releases (Phase 1-3)

| Item | Free Tier | Expected Usage | Cost |
|------|-----------|----------------|------|
| Storage | 2GB per file | 100 tracks × 5MB = 500MB | **$0** |
| Bandwidth | Unlimited (public repos) | ~10GB/month (estimated) | **$0** |
| API calls | 5,000/hour (authenticated) | ~100/day (uploads) | **$0** |
| **Total** | | | **$0/month** |

### Cloudflare R2 (Phase 4 - Optional)

| Item | Free Tier | Expected Usage | Cost |
|------|-----------|----------------|------|
| Storage | 10GB | 100 tracks × 5MB = 500MB | **$0** |
| Class A ops (write) | 1M/month | 100 uploads/month | **$0** |
| Class B ops (read) | 10M/month | ~50K plays/month | **$0** |
| Egress | Unlimited | ~50GB/month | **$0** (R2 has no egress fees) |
| **Total** | | | **$0/month** |

**After free tier (200+ tracks, 2GB+):**

- Storage: $0.015/GB/month × 2GB = **$0.03/month**
- Still within free tier for bandwidth (no egress fees)

**Scaling projection:**

| Library Size | Storage | Est. Monthly Cost |
|--------------|---------|-------------------|
| 100 tracks | 500MB | $0 |
| 200 tracks | 1GB | $0 |
| 500 tracks | 2.5GB | $0.04/month |
| 1,000 tracks | 5GB | $0.08/month |

**Conclusion**: Both solutions are effectively **free for realistic usage** (<500 tracks).

---

## Success Metrics

### Phase 1 Success Metrics

- ✅ Audio streaming latency <1s on fast wifi
- ✅ Fallback works when CDN unreachable
- ✅ Zero new dependencies added (bundle size unchanged)
- ✅ All existing tests pass
- ✅ Documentation updated

### Phase 2 Success Metrics

- ✅ Migration script successfully uploads 6 demo MP3s
- ✅ Validation script confirms all URLs accessible
- ✅ AI agent can run migration script without human intervention
- ✅ data.json correctly updated with CDN URLs

### Phase 3 Success Metrics

- ✅ MP3 files optimized (128-192kbps bitrate)
- ✅ Architecture documentation reflects new CDN design
- ✅ Privacy/compliance documentation complete

### Overall Success Metrics

| Metric | Baseline (Local) | Target (CDN) | Measurement Method |
|--------|------------------|--------------|-------------------|
| **Playback latency** | ~500ms | <1s | Chrome DevTools Performance |
| **Repository size** | 4MB (6 files) | <1MB (demo only) | `git count-objects -vH` |
| **Deployment time** | ~30s | ~20s | Vercel deployment logs |
| **Developer onboarding** | Clone 4MB | Clone <1MB | New contributor experience |
| **Monthly cost** | $0 | $0 | Cloudflare/GitHub billing |

---

## Timeline & Parallelization

### Solo Developer (Sequential)

- **Phase 1**: 1 day
- **Phase 2**: 1 day
- **Phase 3**: 0.5 days
- **Total**: 2.5 days

### Parallel AI Agents (3 agents)

**Agent 1: Data Model & Audio Module**
- Phase 1, Tasks 1-2 (TypeScript + audio fallback)
- **Time**: 0.5 days

**Agent 2: Migration Scripts**
- Phase 2, Tasks 1-3 (migration + validation scripts)
- **Time**: 1 day

**Agent 3: Documentation & Optimization**
- Phase 3, all tasks (docs + MP3 optimization)
- **Time**: 0.5 days

**Dependencies:**
- Agent 2 must wait for Agent 1 to complete Task 1 (type definitions)
- Agent 3 can work in parallel (documentation tasks)

**Total (parallel)**: 1-1.5 days

---

## Open Questions & Decisions Needed

### Question 1: Keep demo MP3s in repo?

**Options:**

A. **Keep 6 demo files in `/public/audio/`** (recommended)
   - Pros: Instant local development, no setup required
   - Cons: 4MB repo size

B. **Remove all MP3s, require developers to download**
   - Pros: Smaller repo
   - Cons: Extra setup step for new developers

**Decision**: **Option A** - Developer experience is more important than 4MB repo size.

---

### Question 2: Use GitHub Releases or jump to R2?

**Options:**

A. **Start with GitHub Releases** (recommended)
   - Pros: Zero setup, free, integrated with GitHub
   - Cons: Manual upload via UI or API

B. **Jump to Cloudflare R2 immediately**
   - Pros: Better automation, S3-compatible API
   - Cons: Requires Cloudflare account setup, API keys

**Decision**: **Option A** - Start simple, migrate to R2 when automation needs increase.

---

### Question 3: Compression settings for MP3s?

**Options:**

A. **Keep original quality** (unknown bitrate)
   - Pros: Best quality
   - Cons: Larger files, longer download

B. **Re-encode to 192kbps VBR**
   - Pros: Good quality, 50% size reduction
   - Cons: Lossy compression (but imperceptible for most users)

C. **Re-encode to 128kbps CBR**
   - Pros: Smallest size, fastest download
   - Cons: Noticeable quality loss for music

**Decision**: **Option B (192kbps VBR)** - Best balance of quality and size. Provide compression script but don't enforce.

---

## Next Steps

### Immediate Actions (Before Starting Phase 1)

1. **Review this plan** with maintainers or stakeholders
2. **Decide on open questions** (see above)
3. **Set up GitHub token** for API access (if using migration script)
4. **Confirm free tier limits** with GitHub/Cloudflare

### Phase 1 Kickoff

1. Create feature branch: `feat/mp3-streaming`
2. Create GitHub Release: `audio-v1.0`
3. Update TypeScript types
4. Implement fallback logic
5. Test streaming + fallback
6. Update data.json

### Phase 2 Kickoff (After Phase 1 Complete)

1. Implement migration script
2. Implement validation script
3. Test migration on local fork
4. Document process

### Phase 3 Kickoff (After Phase 2 Complete)

1. Audit MP3 bitrates
2. Create compression script (optional)
3. Update all documentation
4. Write privacy/compliance docs

---

## Conclusion

This implementation plan provides a **phased, low-risk approach** to migrating Photo Signal's audio storage from local files to CDN streaming. By starting with GitHub Releases (zero cost, zero config) and providing a clear migration path to Cloudflare R2 (if needed), we achieve:

✅ **Fast streaming**: <1s latency on fast wifi  
✅ **Clean repository**: Production MP3s removed from git  
✅ **Developer-friendly**: Local files still work for development  
✅ **Cost-effective**: $0/month for realistic usage  
✅ **Automation-ready**: Scripts can be run by AI agents  

The phased approach minimizes risk and allows for course correction at each milestone. If GitHub Releases proves insufficient, we have a clear path to Cloudflare R2. If CDN streaming introduces latency issues, the fallback mechanism ensures the app continues to work.

**Recommendation**: Proceed with Phase 1 implementation using GitHub Releases.

---

## Appendix A: Example Migration Run

```bash
$ npm run migrate:audio

🎵 Audio Migration to GitHub Releases
=====================================

Environment check:
✅ GITHUB_TOKEN found
✅ Repository: campmiles/photo-signal

Scanning /public/audio/ ...
Found 6 MP3 files:
  - concert-1.mp3 (1.9MB)
  - concert-2.mp3 (1.9MB)
  - concert-3.mp3 (40KB)
  - concert-4.mp3 (40KB)
  - concert-song-1.mp3 (1.9MB)
  - concert-song-2.mp3 (1.9MB)

Checking GitHub Release: audio-v1.0
✅ Release exists

Checking uploaded files...
Found 2 existing files in release

Uploading files:
✅ concert-1.mp3 (already uploaded)
✅ concert-2.mp3 (already uploaded)
⬆️  concert-3.mp3 ... ████████████████████ 100% (40KB)
✅ concert-3.mp3 uploaded
⬆️  concert-4.mp3 ... ████████████████████ 100% (40KB)
✅ concert-4.mp3 uploaded
⬆️  concert-song-1.mp3 ... ████████████████████ 100% (1.9MB)
✅ concert-song-1.mp3 uploaded
⬆️  concert-song-2.mp3 ... ████████████████████ 100% (1.9MB)
✅ concert-song-2.mp3 uploaded

Updating data.json:
✅ Backup created: data.json.backup
✅ Updated 12 concerts with CDN URLs

Changes:
  - Concert 1: /audio/concert-1.mp3 → https://github.com/.../concert-1.mp3
  - Concert 2: /audio/concert-2.mp3 → https://github.com/.../concert-2.mp3
  - ... (10 more)

✅ data.json saved

Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Files processed:     6
  Uploaded:           4 (2 already existed)
  Data updated:       12 concerts
  Total size:         7.7MB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Next steps:
1. Review changes: git diff data.json
2. Test audio playback: npm run dev
3. Commit changes: git add data.json && git commit -m "feat: migrate audio to CDN"
4. Validate URLs: npm run validate:audio

Migration complete! 🎉
```

---

## Appendix B: Example data.json (Before/After)

**Before (local files):**

```json
{
  "concerts": [
    {
      "id": 1,
      "band": "The Midnight Echoes",
      "venue": "The Fillmore",
      "date": "2023-08-15",
      "audioFile": "/audio/concert-1.mp3",
      "photoHash": "00000000000001600acc000000000000"
    }
  ]
}
```

**After (CDN with fallback):**

```json
{
  "concerts": [
    {
      "id": 1,
      "band": "The Midnight Echoes",
      "venue": "The Fillmore",
      "date": "2023-08-15",
      "audioFile": "https://github.com/campmiles/photo-signal/releases/download/audio-v1.0/concert-1.mp3",
      "audioFileFallback": "/audio/concert-1.mp3",
      "audioFileSource": "github-release",
      "photoHash": "00000000000001600acc000000000000"
    }
  ]
}
```

---

## Appendix C: Cloudflare R2 CORS Configuration

When migrating to R2 (Phase 4), configure CORS as follows:

**R2 Bucket CORS Settings:**

```json
[
  {
    "AllowedOrigins": ["https://photo-signal.vercel.app", "http://localhost:5173"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["Content-Length", "Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

**Custom Domain Setup:**

1. Create R2 bucket: `photo-signal-audio`
2. Create custom domain: `audio.photo-signal.example.com`
3. Add CNAME record in DNS:
   ```
   audio.photo-signal.example.com CNAME <bucket-name>.r2.dev
   ```
4. Configure CORS (see above)
5. Set public access policy (read-only)

**R2 Public Access Policy:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicRead",
      "Effect": "Allow",
      "Principal": "*",
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::photo-signal-audio/*"]
    }
  ]
}
```

---

**End of Implementation Plan**
