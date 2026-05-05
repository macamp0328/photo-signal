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

The fix was simple once I saw it. Compute five versions of the fingerprint per print ahead of time, covering the range from dim venue lighting to overexposed daylight. At runtime, test against all five and take the closest match. Lighting robustness without any machine learning.

The threshold is 18 out of 64 bits. It runs in a Web Worker, checking about every 80 milliseconds while it's tracking something. The UI never has to compete with it.

The easy path was QR codes. But that would have made it a different project.

---

## Draft B — From the user's experience inward

Point your phone at a print. The app finds it in about a second.

That works in any corner of the bathroom, under the overhead light, near the window. Doesn't matter.

Here's why that was harder than it sounds.

Gallery lighting is inconsistent. The same photo can look meaningfully different depending on where you're standing. A system that works in one spot might fail two feet to the left. And I wasn't going to put QR codes on the prints. These were photographs. They had to stand as photographs.

I ended up using perceptual hashing. It creates a fingerprint of what an image looks like, based on its visual structure. Similar-looking images get similar fingerprints. You measure the distance.

The fix for the lighting problem: compute five versions of the fingerprint per print ahead of time, from dim venue to bright daylight. At runtime, compare against all five and take the nearest match. No machine learning. Just pre-computation.

The threshold is 18 out of 64 bits. It runs off the main thread so the UI stays smooth.

The app also glitches sometimes. The image shifts, red channel one way, blue the other. Once every five minutes or so. The TV hasn't been fully repaired.

What recognition problems have you run into?

---

## Draft C — The Failure Modes (the system knows when to quit)

The app is running on a phone, in a bathroom, pointed at printed photographs.

There's a lot that can go wrong.

Every frame gets evaluated before recognition even starts. Too blurry? Rejected. Too much glare? Rejected. Underexposed or overexposed? Rejected. The sharpness check uses Laplacian variance — if the score drops below 85, the frame is probably moving or out of focus and gets thrown away. No match attempted.

When a frame passes those gates, the match still has to prove itself. The best candidate has to hold for 180 milliseconds before it confirms. And the second-best candidate has to be at least 5 bits worse — if two photos are close, the result is ambiguous, and the system won't guess.

Very strong matches skip the delay entirely. Under 10 bits of distance — about 84% similar — it confirms in a single frame.

The point of all this: the system knows exactly where it fails. Not a feeling. A reason. BLURRED. GLARE. UNDEREXPOSED. MARGIN_FAIL. Named states, documented behavior, specific thresholds.

"It didn't work" is not an acceptable answer from a recognition system. The thing has to know why.

The repo is public if you want to dig in.

---

## Notes

- **Draft A** leads with the constraint — good for readers who appreciate the product/architecture reasoning. Engineering story told from the builder's perspective.
- **Draft B** starts from what the user experiences and works inward — more accessible, still technically specific. The ending (stochastic glitch, "TV hasn't been fully repaired") adds personality.
- **The threshold is 18 bits, not 14.** The original draft had this wrong. Both new drafts use the correct number.
- The secondary candidate gap (5 bits worse) is a real implementation detail — signals the system actively avoids false positives, not just low-threshold matching.
- The stochastic glitch is real: `@keyframes chromaticShift`, fires at 0.3% per second on a 1-second `setInterval` tick, roughly once every 5 minutes.
- The multi-exposure insight (five gamma-adjusted variants from dim venue to overexposed daylight, minimum Hamming distance) is the genuinely clever part. Don't undersell it — it's lighting robustness without ML. The default is five variants (gamma 2.0, 1.4, 1.0, 0.7, 0.5); the old three-variant (dark/normal/bright) description is outdated.
- Don't go into DCT math or homography. The depth is in the specifics, not the formulas.
- Engineers in the comments may ask about false positives, dataset size, or performance. Be ready to discuss. The repo is public — invite them to look.
- **Draft C** is the failure-modes angle — frame quality gates, the confirmation delay, the margin requirement. Good if you want to show precision thinking rather than just the clever lighting solution. "The system knows exactly where it fails. Not a feeling. A reason." is the thesis. Named states come from STATES_AND_DESIGN_LANGUAGE.md — a real doc that exists so agents and humans share vocabulary.
