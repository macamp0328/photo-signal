# Photo Signal - Project Roadmap

📚 **See also**: [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md) for a complete list of all project documentation.

## Overview

This roadmap outlines the path to complete the Photo Signal project, structured into milestones that can be assigned to AI agents working in parallel. The project uses a modular architecture optimized for parallel development.

**Current Status**: MVP Complete (Build passes, all modules implemented with placeholder logic)  
**Goal**: Production-ready, testable, fully functional photo recognition gallery app

---

## Milestone 1: Testing Infrastructure & Quality Assurance 🧪

**Priority**: HIGH  
**Status**: Not Started  
**Dependencies**: None  
**Estimated Effort**: 2-3 sprints

### Objectives
- Establish comprehensive testing framework
- Add tests for all modules and services
- Ensure CI/CD pipeline runs tests
- Achieve >70% code coverage

### Issues

#### 1.1 Setup Testing Framework
- Install Vitest and React Testing Library
- Configure vitest.config.ts
- Create test setup file with global mocks
- Add test scripts to package.json
- Update CI/CD to run tests
- **Assignable to**: Single agent
- **Files**: `vitest.config.ts`, `package.json`, `.github/workflows/ci.yml`, `src/test/setup.ts`

#### 1.2 Test Camera Access Module
- Mock `navigator.mediaDevices.getUserMedia()`
- Test permission states (granted, denied, loading)
- Test stream cleanup on unmount
- Test retry functionality
- **Assignable to**: Single agent
- **Files**: `src/modules/camera-access/useCameraAccess.test.ts`

#### 1.3 Test Motion Detection Module
- Mock video element and canvas context
- Test pixel difference calculation
- Test sensitivity adjustments
- Test motion state changes
- **Assignable to**: Single agent
- **Files**: `src/modules/motion-detection/useMotionDetection.test.ts`

#### 1.4 Test Photo Recognition Module
- Mock data service
- Test recognition delay timing
- Test reset functionality
- Test enabled/disabled state
- **Assignable to**: Single agent
- **Files**: `src/modules/photo-recognition/usePhotoRecognition.test.ts`

#### 1.5 Test Audio Playback Module
- Mock Howler.js
- Test play/pause/stop controls
- Test fade out functionality
- Test volume controls
- **Assignable to**: Single agent
- **Files**: `src/modules/audio-playback/useAudioPlayback.test.ts`

#### 1.6 Test Camera View Component
- Test error state display
- Test loading state display
- Test active camera state with overlay
- Test video element srcObject assignment
- **Assignable to**: Single agent
- **Files**: `src/modules/camera-view/CameraView.test.tsx`

#### 1.7 Test Concert Info Component
- Test conditional rendering (visible/hidden)
- Test concert data display
- Test date formatting
- Test position prop variations
- **Assignable to**: Single agent
- **Files**: `src/modules/concert-info/InfoDisplay.test.tsx`

#### 1.8 Test Data Service
- Mock fetch API
- Test cache behavior
- Test error handling
- Test search functionality
- Test random concert selection
- **Assignable to**: Single agent
- **Files**: `src/services/data-service/DataService.test.ts`

#### 1.9 Integration Tests
- Test App.tsx orchestration
- Test module integration flow
- Test complete user journey (camera → recognition → audio)
- **Assignable to**: Single agent
- **Files**: `src/App.test.tsx`

#### 1.10 E2E Tests (Optional)
- Setup Playwright or Cypress
- Test camera permission flow
- Test audio playback in browser
- Test mobile responsiveness
- **Assignable to**: Single agent
- **Files**: `e2e/` directory

---

## Milestone 2: Real Photo Recognition 📸

**Priority**: HIGH  
**Status**: Not Started  
**Dependencies**: Milestone 1 (recommended but not required)  
**Estimated Effort**: 3-4 sprints

### Objectives
- Replace placeholder recognition with real photo matching
- Implement perceptual hashing or ML-based recognition
- Add photo upload/management UI
- Test recognition accuracy

### Issues

#### 2.1 Research Photo Recognition Approaches
- Evaluate perceptual hashing (image-phash, blockhash)
- Evaluate ML models (TensorFlow.js, ONNX Runtime)
- Document pros/cons and recommendation
- Create technical spec
- **Assignable to**: Research/advisory agent
- **Files**: `docs/photo-recognition-research.md`

#### 2.2 Implement Perceptual Hashing
- Add image hashing library (blockhash-js or similar)
- Create hash generation utility
- Store hashes in concert data
- Implement hash comparison algorithm
- **Assignable to**: Single agent
- **Files**: `src/modules/photo-recognition/hashingService.ts`, `src/modules/photo-recognition/usePhotoRecognition.ts`

#### 2.3 Add Photo Hash Database
- Update Concert type with photoHash field
- Create script to generate hashes for existing photos
- Update data.json with photo hashes
- **Assignable to**: Single agent
- **Files**: `src/types/index.ts`, `public/data.json`, `scripts/generate-hashes.ts`

#### 2.4 Photo Upload UI (Admin Tool)
- Create admin page for uploading photos
- Generate hash on upload
- Store photo reference in data
- **Assignable to**: Single agent
- **Files**: `src/pages/admin/PhotoUpload.tsx`

#### 2.5 Optimize Recognition Performance
- Implement debouncing for recognition checks
- Add recognition confidence threshold
- Cache recent recognition results
- Optimize frame capture rate
- **Assignable to**: Single agent
- **Files**: `src/modules/photo-recognition/usePhotoRecognition.ts`

#### 2.6 Recognition Accuracy Testing
- Create test dataset of photos
- Measure recognition accuracy
- Test different lighting conditions
- Document performance benchmarks
- **Assignable to**: Testing/QA agent
- **Files**: `docs/recognition-accuracy.md`

---

## Milestone 3: Enhanced Audio Experience 🎵

**Priority**: MEDIUM  
**Status**: Not Started  
**Dependencies**: None  
**Estimated Effort**: 2 sprints

### Objectives
- Improve audio transitions and effects
- Add user controls for audio
- Implement audio preloading
- Add playlist features

### Issues

#### 3.1 Audio Crossfade
- Implement smooth crossfade between tracks
- Add configurable crossfade duration
- Test crossfade with multiple transitions
- **Assignable to**: Single agent
- **Files**: `src/modules/audio-playback/useAudioPlayback.ts`

#### 3.2 Audio Preloading
- Preload audio when photo is recognized
- Implement preload queue
- Add loading state UI
- **Assignable to**: Single agent
- **Files**: `src/modules/audio-playback/useAudioPlayback.ts`, `src/modules/concert-info/InfoDisplay.tsx`

#### 3.3 Audio Controls UI
- Add play/pause button
- Add volume slider
- Add track progress indicator
- Add skip to next/previous
- **Assignable to**: Single agent
- **Files**: `src/components/AudioControls.tsx`

#### 3.4 Playlist Mode
- Auto-advance to next concert after song ends
- Add shuffle mode
- Add repeat mode
- **Assignable to**: Single agent
- **Files**: `src/modules/playlist/usePlaylist.ts`

#### 3.5 Audio Visualizer (Optional)
- Add audio-reactive visual effects
- Implement frequency analyzer
- Create visualizer component
- **Assignable to**: Single agent
- **Files**: `src/modules/audio-visualizer/AudioVisualizer.tsx`

---

## Milestone 4: User Experience Enhancements 🎨

**Priority**: MEDIUM  
**Status**: Not Started  
**Dependencies**: None  
**Estimated Effort**: 2-3 sprints

### Objectives
- Improve UI/UX based on user feedback
- Add user preferences and settings
- Implement PWA features
- Mobile optimization

### Issues

#### 4.1 User Settings Panel
- Create settings UI component
- Add motion detection sensitivity slider
- Add audio volume preference
- Persist settings to localStorage
- **Assignable to**: Single agent
- **Files**: `src/modules/settings/Settings.tsx`, `src/services/storage-service/`

#### 4.2 Favorites System
- Add ability to favorite concerts
- Display favorites list
- Persist favorites to localStorage
- Add favorites filter
- **Assignable to**: Single agent (or multiple agents in parallel)
- **Files**: `src/modules/favorites/useFavorites.ts`, `src/modules/favorites-ui/FavoriteButton.tsx`, `src/services/storage-service/`

#### 4.3 PWA Implementation
- Add service worker
- Enable offline support
- Add app manifest
- Add install prompt
- **Assignable to**: Single agent
- **Files**: `public/manifest.json`, `src/sw.ts`, `vite.config.ts`

#### 4.4 Mobile Optimizations
- Optimize touch interactions
- Test on multiple devices
- Improve performance on low-end devices
- Add haptic feedback
- **Assignable to**: Mobile specialist agent
- **Files**: Multiple UI components

#### 4.5 Loading States & Animations
- Add skeleton loaders
- Improve transition animations
- Add loading indicators
- Add error recovery UI
- **Assignable to**: Single agent
- **Files**: Multiple UI components

#### 4.6 Onboarding Flow
- Create first-time user tutorial
- Add camera permission instructions
- Show feature highlights
- Add skip option
- **Assignable to**: Single agent
- **Files**: `src/components/Onboarding.tsx`

#### 4.7 Story Mode Feature
- Add text reflections/stories to concerts
- Display after song plays
- Add story editor for admin
- **Assignable to**: Single agent
- **Files**: `src/modules/story/StoryDisplay.tsx`, `src/types/index.ts`

---

## Milestone 5: Data & Backend 🗄️

**Priority**: LOW-MEDIUM  
**Status**: Not Started  
**Dependencies**: None (but benefits from Milestone 2)  
**Estimated Effort**: 2-3 sprints

### Objectives
- Migrate from static JSON to database
- Add API layer
- Implement user accounts (optional)
- Enable multi-user features

### Issues

#### 5.1 Database Schema Design
- Design PostgreSQL schema for concerts
- Add photos table
- Add users table (if needed)
- Document schema
- **Assignable to**: Database specialist agent
- **Files**: `docs/database-schema.md`, `migrations/`

#### 5.2 API Layer Setup
- Create Vercel serverless functions
- Add /api/concerts endpoint
- Add /api/photos endpoint
- Add error handling and validation
- **Assignable to**: Backend agent
- **Files**: `api/concerts.ts`, `api/photos.ts`

#### 5.3 Database Integration
- Set up Supabase or Neon PostgreSQL
- Implement database connection
- Add connection pooling
- Add environment variables
- **Assignable to**: Backend agent
- **Files**: `api/db.ts`, `.env.example`

#### 5.4 Migrate Data Service to API
- Update DataService to call API
- Remove static JSON dependency
- Add API error handling
- Maintain backward compatibility
- **Assignable to**: Single agent
- **Files**: `src/services/data-service/DataService.ts`

#### 5.5 User Authentication (Optional)
- Add authentication provider (Supabase Auth, Auth0)
- Create login/signup UI
- Add protected routes
- Implement session management
- **Assignable to**: Auth specialist agent
- **Files**: `src/modules/auth/`, `api/auth.ts`

#### 5.6 Photo Upload API
- Create photo upload endpoint
- Add image optimization
- Store photos in cloud storage (S3, Cloudinary)
- Generate thumbnails
- **Assignable to**: Backend agent
- **Files**: `api/upload.ts`

---

## Milestone 6: Advanced Features 🚀

**Priority**: LOW  
**Status**: Not Started  
**Dependencies**: Previous milestones  
**Estimated Effort**: 3-4 sprints

### Objectives
- Add advanced features requested in README
- External hardware integration
- Social features
- Analytics

### Issues

#### 6.1 External Speaker Integration
- Research ESP32/Google Home integration
- Create communication protocol
- Build hardware prototype
- Test audio routing
- **Assignable to**: Hardware specialist agent
- **Files**: `docs/hardware-integration.md`, `api/speaker.ts`

#### 6.2 Multi-language Support
- Add i18n library (react-i18next)
- Create translation files
- Translate all UI text
- Add language selector
- **Assignable to**: Single agent
- **Files**: `src/i18n/`, `src/locales/`

#### 6.3 Social Sharing
- Add share button for concerts
- Generate social preview images
- Add share to social media
- **Assignable to**: Single agent
- **Files**: `src/modules/social/ShareButton.tsx`

#### 6.4 Analytics Integration
- Add privacy-friendly analytics (Plausible, Umami)
- Track recognition success rate
- Track user engagement
- Create analytics dashboard
- **Assignable to**: Analytics agent
- **Files**: `src/services/analytics/`

#### 6.5 Search & Discovery
- Add concert search feature
- Add filtering by venue, date, band
- Add sorting options
- Create browse mode (without camera)
- **Assignable to**: Single agent
- **Files**: `src/modules/search/`, `src/pages/Browse.tsx`

#### 6.6 Concert Recommendations
- Implement recommendation algorithm
- Show similar concerts
- Personalized suggestions based on favorites
- **Assignable to**: ML/recommendation agent
- **Files**: `src/modules/recommendations/`

---

## Milestone 7: Production Readiness & Documentation 📋

**Priority**: MEDIUM-HIGH  
**Status**: Not Started  
**Dependencies**: All previous milestones  
**Estimated Effort**: 1-2 sprints

### Objectives
- Finalize documentation
- Performance optimization
- Security audit
- Launch preparation

### Issues

#### 7.1 Performance Optimization
- Analyze bundle size
- Implement code splitting
- Optimize image loading
- Add lazy loading
- Measure Core Web Vitals
- **Assignable to**: Performance specialist agent
- **Files**: Multiple

#### 7.2 Security Audit
- Run security scan
- Fix vulnerabilities
- Add security headers
- Implement CSP
- Add rate limiting to API
- **Assignable to**: Security specialist agent
- **Files**: `vercel.json`, API files

#### 7.3 Accessibility Audit
- Run a11y tests
- Fix WCAG violations
- Add ARIA labels
- Test keyboard navigation
- Test screen reader support
- **Assignable to**: Accessibility specialist agent
- **Files**: Multiple UI components

#### 7.4 User Documentation
- Write user guide
- Create FAQ
- Add troubleshooting section
- Create video tutorial
- **Assignable to**: Documentation agent
- **Files**: `docs/user-guide.md`, `docs/faq.md`

#### 7.5 Developer Documentation
- Update all module READMEs
- Document API endpoints
- Create contribution guide
- Add deployment guide
- **Assignable to**: Documentation agent
- **Files**: Module READMEs, `CONTRIBUTING.md`, `docs/api.md`

#### 7.6 Error Monitoring
- Add error tracking (Sentry)
- Set up error alerting
- Create error dashboard
- **Assignable to**: DevOps agent
- **Files**: `src/services/error-tracking/`

#### 7.7 Launch Checklist
- Create pre-launch checklist
- Test all features
- Verify all documentation
- Set up monitoring
- Plan rollout strategy
- **Assignable to**: Project manager agent
- **Files**: `docs/launch-checklist.md`

---

## Parallel Development Strategy

Thanks to the modular architecture, multiple milestones can progress simultaneously:

### Phase 1 (Weeks 1-4): Foundation
- **Team A**: Milestone 1 - Testing Infrastructure (1.1-1.10)
- **Team B**: Milestone 2 - Photo Recognition (2.1-2.3)
- **Team C**: Milestone 3 - Audio Enhancements (3.1-3.2)

### Phase 2 (Weeks 5-8): Features
- **Team A**: Milestone 2 - Photo Recognition (2.4-2.6)
- **Team B**: Milestone 3 - Audio Features (3.3-3.5)
- **Team C**: Milestone 4 - UX Enhancements (4.1-4.3)

### Phase 3 (Weeks 9-12): Advanced
- **Team A**: Milestone 4 - UX Features (4.4-4.7)
- **Team B**: Milestone 5 - Backend (5.1-5.4)
- **Team C**: Milestone 6 - Advanced Features (6.1-6.3)

### Phase 4 (Weeks 13-14): Launch
- **All Teams**: Milestone 7 - Production Readiness (7.1-7.7)

---

## Issue Tracking

All issues will be created in GitHub Issues with:
- **Labels**: milestone-1, milestone-2, etc., plus type labels (testing, feature, documentation, etc.)
- **Projects**: GitHub Projects board for tracking
- **Assignments**: Can be assigned to AI agents (GitHub Copilot) one at a time
- **Dependencies**: Documented in issue description

---

## Success Metrics

- **Testing**: >70% code coverage across all modules
- **Performance**: <100KB initial bundle, 60 FPS camera, <100ms recognition
- **Reliability**: >95% uptime, <1% error rate
- **User Satisfaction**: Positive feedback, smooth user experience
- **Development Velocity**: Issues completed per sprint

---

## Next Steps

1. ✅ Review and approve this roadmap
2. Create GitHub Issues for Milestone 1 (highest priority)
3. Set up GitHub Projects board
4. Assign first batch of issues to AI agents
5. Begin parallel development
6. Hold regular sync meetings to coordinate integration

---

**Last Updated**: 2025-11-09  
**Status**: Draft - Awaiting Review
