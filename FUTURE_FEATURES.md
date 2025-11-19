# Future Features & Enhancements

This document consolidates ideas and plans for features that haven't been implemented yet.

---

## Photo Recognition Enhancements

### Phase 2: Angle Compensation

**Status**: Research complete, implementation deferred  
**Goal**: Reduce angle-related failures by ~50%

**Options**:

1. **pHash Algorithm** (already implemented ✅) - More robust to perspective distortion
2. **Multi-Angle Reference Hashes** - Generate reference hashes at 0°, 15°, 30°, 45° angles
3. **OpenCV Perspective Correction** - Real-time perspective transformation (requires OpenCV.js)
4. **Enhanced Framing Guide** - Smart feedback to help users position correctly

**Recommendation**: Test pHash effectiveness first before adding complexity.

---

## Audio Streaming & CDN

### Production Opus Streaming

**Problem**: Current approach stores all audio in `/public/audio/`, doesn't scale beyond demo.

**Solution**: Hybrid CDN approach

**Phase 1 (MVP)**: GitHub Releases

- Free, unlimited bandwidth
- Integrated with GitHub workflow
- Manual upload via API

**Phase 2 (Scale)**: Cloudflare R2

- 10GB free storage
- No egress fees
- Scriptable uploads with S3 API
- Best for libraries >50 tracks

**Implementation Needs**:

- Migration script to upload files
- Update `data.json` to use CDN URLs
- Add fallback to local files for development
- Update Concert interface to support URL sources

---

## UX & Interface Ideas

### Story Mode

Written reflections fade in after the song ends - connect memories to photos.

### Audio-Reactive Visual Overlays

Visual effects that respond to audio frequency/amplitude.

### Offline PWA Experience

Service worker caching for offline use.

### Favorites System

Allow users to save and revisit favorite concerts.

### User Settings Panel

Customize volume, crossfade duration, motion sensitivity, etc.

---

## Hardware Integration

### External Playback via ESP32

Send audio to physical speakers via WiFi.

### Google Home Integration

Cast audio to Google Home devices.

---

## Advanced Photo Recognition

### Real ML-Based Recognition

Replace perceptual hashing with TensorFlow.js model for better accuracy.

### QR Code Fallback

Support QR codes as backup recognition method.

---

## Multi-Language Support

Add internationalization (i18n) for interface text.

---

## Technical Improvements

### PostgreSQL Backend

Migrate from static JSON to database for concert data.

### User Accounts

Allow users to save preferences, favorites, custom galleries.

### Analytics & Telemetry

Track recognition success rates, most played songs, etc.

---

## Notes

This list is living documentation. When implementing a feature:

1. Move the relevant section to appropriate docs (README, module docs, etc.)
2. Delete the section from this file
3. Update DOCUMENTATION_INDEX.md accordingly

Features should only be documented in detail here if they're NOT yet implemented. Once work begins, move to proper documentation structure.
