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

I didn't want to modify the prints.

No QR codes, no invisible markers. These were photographs from concerts I actually went to. They had to stand on their own, as photographs. The technology had to work around that.

So I landed on perceptual hashing. It creates a fingerprint of what an image looks like, not its exact pixels. Similar images get similar fingerprints. You measure the distance between them. It's kind of elegant.

The wrinkle: the same print under different lighting hashes differently. A warm overhead lamp shifts the apparent brightness of everything on the wall. Solve that wrong and recognition breaks constantly.

The fix was simple once I saw it. Compute three versions of the fingerprint per print ahead of time: dark, normal, and bright. At runtime, test against all three and take the closest match. Lighting robustness without any machine learning.

The threshold is 18 out of 64 bits. It runs in a Web Worker, checking about every 80 milliseconds while it's tracking something. The UI never has to compete with it.

The easy path was QR codes. But that would have made it a different project.

---

## Draft B — From the user's experience inward

Point your phone at a print. The app finds it in about a second.

That works in any corner of the bathroom, under the overhead light, near the window. Doesn't matter.

Here's why that was harder than it sounds.

Gallery lighting is inconsistent. The same photo can look meaningfully different depending on where you're standing. A system that works in one spot might fail two feet to the left. And I wasn't going to put QR codes on the prints. These were photographs. They had to stand as photographs.

I ended up using perceptual hashing. It creates a fingerprint of what an image looks like, based on its visual structure. Similar-looking images get similar fingerprints. You measure the distance.

The fix for the lighting problem: compute three versions of the fingerprint per print ahead of time. Dark, normal, and bright. At runtime, compare against all three and take the nearest match. No machine learning. Just pre-computation.

The threshold is 18 out of 64 bits. It runs off the main thread so the UI stays smooth.

The app also glitches sometimes. The image shifts, red channel one way, blue the other. Once every five minutes or so. The TV hasn't been fully repaired.

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
