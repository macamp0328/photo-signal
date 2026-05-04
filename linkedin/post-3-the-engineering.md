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

## Draft A — Constraint drives design

Gallery lighting is messy. Overhead fixtures, shadows, angles, color temperature. I knew this going in.

But the real constraint wasn't lighting. It was the photographs.

I didn't want to modify the prints. No QR codes, no invisible markers. These were photographs from concerts I actually went to. They had to stand as photographs. The technology had to work around that, not the other way around.

So: perceptual hashing. Each print gets a 64-bit fingerprint based on visual structure — not exact pixels. Similar images produce similar hashes. Measure the distance between them.

The wrinkle: the same print under different lighting hashes differently. A warm overhead lamp shifts the apparent brightness of everything on the wall. Solve that wrong and recognition breaks constantly.

Fix: pre-compute three hash variants per print — dark, normal, bright — at build time. At runtime, match against all three and take the minimum Hamming distance. Lighting robustness without a neural network.

Threshold: 18 out of 64 bits. A secondary candidate has to be at least 5 bits worse than the best match. Dialed in on real prints, in the actual gallery, under the actual lights.

The check runs in a Web Worker — never on the main thread. ~80ms while tracking a candidate, ~120ms idle.

The easy path was QR codes. But that would have made it a different project.

---

## Draft B — From the user's experience inward

You point your phone at a print. The app finds it in about a second.

That sounds simple. Here's why it isn't.

Gallery lighting is inconsistent. The same photo under a warm overhead lamp looks meaningfully different from the same photo in a cool corner. A recognition approach that works in one spot can fail two feet to the left. And I wasn't going to put QR codes on the prints — these were photographs. They had to stand as photographs.

The solution uses perceptual hashing: a 64-bit fingerprint derived from the visual structure of an image, not its exact pixels. Similar-looking images produce similar hashes. Measure the distance. Take the nearest match.

The lighting problem needed a specific fix: three hash variants per print — dark, normal, bright — computed at build time. At runtime, match against all three and use the minimum distance. The match threshold is 18 out of 64 bits, with a required gap of at least 5 bits over the next closest candidate.

The recognition runs in a Web Worker. The main thread never sees it. Check interval adapts: ~80ms while tracking a candidate, ~120ms idle.

At the moment of match, the rectangle overlay's bloom animation fires. The concert color palette — derived from the band name and day of the week — replaces the amber dead-signal ambient. The song starts.

The app also occasionally glitches. Red channel shifts a few pixels left, blue shifts right. Chromatic aberration. Fires at about 0.3% per second — roughly once every five minutes. The TV hasn't been fully repaired.

---

## Notes

- **Draft A** leads with the constraint — good for readers who appreciate the product/architecture reasoning. Engineering story told from the builder's perspective.
- **Draft B** starts from what the user experiences and works inward — more accessible, still technically specific. The ending (stochastic glitch, "TV hasn't been fully repaired") adds personality.
- **The threshold is 18 bits, not 14.** The original draft had this wrong. Both new drafts use the correct number.
- The secondary candidate gap (5 bits worse) is a real implementation detail — signals the system actively avoids false positives, not just low-threshold matching.
- The stochastic glitch is real: `@keyframes chromaticShift`, fires at 0.3% per second on a 1-second `setInterval` tick, roughly once every 5 minutes.
- The multi-exposure insight (dark/normal/bright variants, minimum Hamming distance) is the genuinely clever part. Don't undersell it — it's lighting robustness without ML.
- Don't go into DCT math or homography. The depth is in the specifics, not the formulas.
- Engineers in the comments may ask about false positives, dataset size, or performance. Be ready to discuss. The repo is public — invite them to look.
