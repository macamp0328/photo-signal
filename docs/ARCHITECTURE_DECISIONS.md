# Architecture Decisions

Lightweight decision log for Photo Signal. Captures the "why" behind key architectural choices
so future agents and maintainers don't re-litigate settled questions.

Format: reverse chronological. Add new entries at the top.

---

### ADR-007: Multi-exposure hash variants for lighting robustness

**Context:** Gallery lighting varies significantly — a photo under a ceiling spotlight looks very
different from the same photo in a dim corner. A single pHash per photo produced too many missed
matches under unusual lighting.

**Decision:** Each photo is hashed at three gamma-adjusted exposures: dark, normal, and bright.
All three variants are stored in `data.recognition.v2.json` and checked at recognition time.

**Rationale:** Tripling the hash count adds minimal storage (64-bit hashes are tiny) and the
lookup remains O(n). It is far simpler than training a lighting-invariant feature descriptor.

---

### ADR-006: Feature flags required for all environmental effects

**Context:** Environmental effects (EXIF-driven grain, time-of-day tinting, session ambience)
interact with hardware APIs and vary widely across devices. Without toggles, a broken effect
in production has no fast recovery path other than a new deploy.

**Decision:** Every environmental effect must have a flag in `src/modules/secret-settings/config.ts`.
Default to `true` for subtle effects, `false` for experimental or sensor-dependent ones.

**Rationale:** The settings panel doubles as a debugging tool. Flags let maintainers (and agents
during development) isolate a specific effect without touching code.

---

### ADR-005: Web Worker for photo recognition

**Context:** pHash computation involves repeated canvas reads, pixel manipulation, and hash
comparisons. Running this on the main thread causes frame drops and jank in the camera view.

**Decision:** Recognition runs entirely in a dedicated Web Worker
(`src/modules/photo-recognition/worker/`). The hook communicates via `postMessage`. The worker
uses an adaptive check interval (~80ms while tracking a candidate, ~120ms idle).

**Rationale:** Keeps the main thread free for rendering and interaction. The adaptive interval
avoids wasting CPU when there is nothing to match.

---

### ADR-004: Static JSON data layer, not a database

**Context:** The dataset is approximately 100 concerts. Options included SQLite, a REST API, or
static JSON files served alongside the app.

**Decision:** Two static JSON files in `public/`: `data.app.v2.json` (concert metadata) and
`data.recognition.v2.json` (pHash index). Both are fetched once on app load via
`src/services/data-service.ts`.

**Rationale:** No server needed. No auth surface. Vercel serves them from the CDN edge. The
dataset is small enough that a full in-memory load at startup is instantaneous. `data-service.ts`
provides the abstraction boundary if this ever needs to change.

---

### ADR-003: pHash as the sole recognition algorithm

**Context:** Earlier iterations supported multiple hash algorithms (`HashAlgorithm` union type
and an `algorithms/` subdirectory). Running multiple algorithms in parallel increased CPU cost
and complexity with no measurable accuracy gain for gallery-quality prints.

**Decision:** Single algorithm: pHash (64-bit perceptual hash). The `HashAlgorithm` type is kept
as `'phash'` for forward compatibility, but no other algorithm is loaded at runtime.

**Rationale:** pHash is well-suited to printed photographs: it is rotation/scale-tolerant within
reasonable bounds and robust to minor lighting variation (augmented further by ADR-007). Fewer
algorithms means a smaller worker bundle and simpler threshold tuning.

---

### ADR-002: CSS Modules, not Tailwind or styled-components

**Context:** The visual identity is deliberate and precise — CRT glow, scan lines, zine
typography, per-concert color palettes. Utility-class systems impose constraints on specificity
and make bespoke animations awkward.

**Decision:** CSS Modules (`*.module.css`) colocated with each component. CSS custom properties
on `<html>` carry dynamic values (palette, glow intensity); CSS transitions handle smoothing.

**Rationale:** Full expressive control, zero runtime overhead, and scoped class names prevent
style leakage between modules. The existing aesthetic cannot be replicated cleanly with utility
classes.

---

### ADR-001: React hooks only — no external state library

**Context:** Photo Signal has a simple, linear data flow: camera stream → recognition result →
audio + UI. Options included Redux, Zustand, Jotai, and React Context.

**Decision:** Standard React hooks (`useState`, `useEffect`, `useRef`, `useContext`). No external
state library.

**Rationale:** The app has one active "matched concert" at a time and a handful of settings
flags. The complexity does not justify a state library. Adding one would make it harder for
agents to understand data flow at a glance. If state complexity grows substantially, this
decision should be revisited.
