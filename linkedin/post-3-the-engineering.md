# Post 3 — "The Constraint That Made It Worth Building"

**Theme**: One real engineering decision, explained clearly — technical depth without a lecture  
**When to post**: Day 8–9 after Post 1  
**Tone**: Technical but accessible. One decision, one tradeoff, real numbers.  
**Hashtags**: `#ComputerVision #ProductEngineering #SoftwareEngineering #ClaudeCode`

---

## Multimedia

**What to capture before posting:**

- GIF of recognition in action: phone panning slowly across the gallery wall, the UI in search mode, then snapping to a match — song title and artist appear. 15–25 seconds.
- Optional second slide: a side-by-side of the same print photographed under different lighting (warm overhead vs. cooler ambient). Visually shows why the multi-exposure approach exists. If you can capture this cleanly, it makes the insight obvious without words.

**What to post**: Lead with the recognition GIF. It makes the engineering feel real before the explanation starts. If you have the side-by-side, add it as slide 2.

---

## Draft

Recognizing ~100 printed photographs under gallery lighting is a harder problem than it sounds.

Gallery lighting is messy. Overhead fixtures, directional lamps, shadows, angles. A QR code approach would have worked — but QR codes require modifying the prints. I didn't want that. The photos had to stand on their own, as photographs.

So the constraint drove the design.

The solution uses perceptual hashing (pHash) — a 64-bit fingerprint derived from the visual structure of an image, not its exact pixels. Similar-looking images produce similar hashes. Distance between hashes is measurable.

The wrinkle: gallery lighting shifts the apparent brightness of every print. A photo under a warm overhead lamp hashes differently than the same photo in cooler light. Solve that wrong and recognition breaks constantly.

The fix: pre-compute three hash variants per print — dark, normal, and bright exposure. At runtime, match against all three and take the minimum distance. Lighting robustness without a neural network.

It runs in a Web Worker, never on the main thread. Adaptive check interval: ~80ms when tracking a candidate, ~120ms idle. The UI never competes with the recognition pipeline.

Threshold: 14 out of 64 bits (~78% similarity). Tuned empirically on real prints under real gallery conditions.

The easy path was QR codes. The interesting path was solving the actual problem. I'm glad we took the interesting one.

---

## Notes

- The numbers are real: 14/64 Hamming distance threshold, 80ms/120ms adaptive interval. Specificity signals credibility.
- "The constraint drove the design" is a line worth keeping verbatim — it's the core engineering principle and it reads well.
- The multi-exposure insight (dark/normal/bright variants, minimum Hamming distance) is the genuinely clever part. Don't undersell it — it's lighting robustness without ML.
- Don't go into DCT math or homography. This post should be readable by a senior PM. The depth is in the specifics, not the formulas.
- Engineers in the comments may ask about false positives, dataset size, or performance. Be ready to discuss. The repo is public — invite them to look.
