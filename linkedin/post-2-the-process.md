# Post 2 — "What AI-First Product Engineering Actually Looks Like"

**Theme**: The process — directing AI agents, maintaining quality, making the calls
**When to post**: Day 4–5 after Post 1
**Tone**: Direct, grounded, slightly contrarian
**Hashtags**: `#ClaudeCode #ProductEngineering #SoftwareEngineering #AItools`

---

## Multimedia

**What to capture before posting:**

- Screen recording GIF (15–30 seconds) of a Claude Code session: the agent reading code, writing a diff, terminal showing tests running and passing. Keep it legible — zoom in if needed.
- Alternatively: a clean screenshot of the CI pipeline with all 7 checks green. Label the steps if possible so viewers can read them: lint, format, type-check, README sync, tests, build, bundle size.

**What to post**: The GIF or screenshot as the main visual. It grounds the post in something concrete and shows the discipline behind the workflow.

---

## Draft A — The Journey (chronological)

I started this project once before.

Sometime in 2025. Got a few weeks in, put it down. The AI could build things fine. But the output felt like it was made by someone who had never heard the music.

Picked it back up this year. Something had changed. Hard to put a number on it, easy to feel.

Here's what I actually did:

No QR codes. The prints had to work as actual photographs, under real gallery lighting, no modifications. That one call shaped everything downstream.

I picked up tools I had never used. pHash, Cloudflare Workers, Vite. All of them new to me. Read enough to think they were probably right, and if I was wrong? Bathroom art project. I could change it.

Every prompt I wrote had the same note buried in it: add more of me into it.

Not "improve the UI." The unmatched state should look like analog TV static. I named it dead signal. The color palette for each concert gets derived from the band name and day of the week. The scan lines fade back in as a song nears its end. None of that came from a spec. I kept asking until it stuck.

That's what the job actually is. Know what you want. Be annoying about it until you get it.

---

## Draft B — The Instruction (thesis-first)

Every prompt I wrote had the same note in it: add more of me into it.

It took months to figure out what that actually meant.

Not "improve the UI." The unmatched state should look like analog TV static. I named it dead signal. The color palette for each concert gets derived from the band name and day of the week. The scan lines fade back in as a song nears its end. The ISO from the original concert photo drives the film grain in the matched UI. All of it specific, and mine.

None of that came from the AI. I just kept asking.

I'd started this once before, in 2025. Put it down. The AI could build fine. But the output felt like it was made by someone who had never heard the music. Picked it back up this year. Something had shifted. The first version felt like scaffolding. This one felt like a project.

On the tooling: I picked up things I had never used. pHash, Cloudflare Workers, Vite. Read enough to think they were probably right. It's a bathroom art project. If I was wrong, I could just change it.

Knowing what you want, and being annoying enough to ask for it. That's the job.

---

## Notes

- **Draft A** opens with the timeline — good for readers who respond to narrative arc and the "trying to figure it out" story. More personal, more journey.
- **Draft B** opens with the central insight ("add more of me") — good if you want to lead with what's most distinctive and let the timeline be supporting evidence. More philosophical.
- Both drafts remove bullet points to match Post 1's voice.
- Real codebase details used: `dead signal` (actual state name in code), the module README sync CI step, the FNV-1a hash / 51° day arc / golden angle for color palettes, EXIF-driven film grain, scan lines fading with song progress.
- The 7-step gate is real; the module README sync step is the most unusual one — signals that docs are enforced, not aspirational.
- Don't editorialize about AI replacing developers. Keep it grounded in your specific experience on this specific project.
