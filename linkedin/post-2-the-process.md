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

Sometime in 2025. A few weeks in. The AI could build — components, hooks, tests, all of it. Genuinely impressive. But the output felt like it was made by someone who had never heard the music.

I shelved it.

Picked it up again this year. Something had shifted. Meaningfully better in ways that are hard to quantify and easy to feel. The first version felt like scaffolding. This one felt like a project.

My job looked like this:

I made calls. No QR codes — the prints had to work unmodified, under variable gallery lighting. That one decision shaped the entire recognition architecture.

I chose tooling I had never used. pHash, Cloudflare Workers, Vite. None of them. I read enough to think they were probably right, and if I was wrong I could change it. It's an art project in my bathroom. Two-way door. I didn't lose sleep.

The CI gate enforces the quality bar — seven steps, every commit, no exceptions. One of them is a custom script that checks whether every exported function in every module has documentation in that module's README. Agents commit. The check runs too.

And I kept writing the same note into every prompt: add more of me into it.

Not "make it more polished." The unmatched state should look like analog TV static — I named it dead signal. The color palette for each concert is derived from the band name and the day of the week, hashed deterministically. The scan lines fade back in as a song nears its end. These weren't requirements. They were creative instructions I had to repeat until they stuck.

That's the actual job. Know enough to have an opinion. Be stubborn about the right things. Recognize when the stakes are low enough to just try something.

---

## Draft B — The Instruction (thesis-first)

Every prompt I wrote for this project had the same note somewhere in it: add more of me into it.

It sounds vague. It took months to operationalize.

Not "improve the UI." Not "add more polish." The unmatched state should have a name — I called it dead signal — and it should look like analog static. The color palette for each concert should be derived from the band name and day of the week: FNV-1a hash of the artist, each day owns a 51° arc of the color wheel, accent offset by the golden angle. The CRT phosphor glow is a specific amber, not a default. As a song nears its end, the scan lines fade back in — the broadcast signal fades with it. The EXIF data from the original concert photos drives film grain: higher ISO, more noise in the matched UI.

None of this came from the AI. It came from me saying the same thing until it stuck.

I'd started this project once before, in 2025. Put it down. The AI could build — everything it was asked to. But the result felt like it was made by someone who had never heard the music. Picked it back up this year. Something had shifted. The first version felt like scaffolding. This one felt like a project.

The infrastructure: I chose tooling I had never used. pHash, Cloudflare Workers, Vite. Read enough to think they were probably right. It's an art project in my bathroom — if I was wrong, I could change it. Two-way door. I didn't lose sleep.

The job isn't prompting. It's knowing what you want clearly enough to keep asking for it until you get it.

---

## Notes

- **Draft A** opens with the timeline — good for readers who respond to narrative arc and the "trying to figure it out" story. More personal, more journey.
- **Draft B** opens with the central insight ("add more of me") — good if you want to lead with what's most distinctive and let the timeline be supporting evidence. More philosophical.
- Both drafts remove bullet points to match Post 1's voice.
- Real codebase details used: `dead signal` (actual state name in code), the module README sync CI step, the FNV-1a hash / 51° day arc / golden angle for color palettes, EXIF-driven film grain, scan lines fading with song progress.
- The 7-step gate is real; the module README sync step is the most unusual one — signals that docs are enforced, not aspirational.
- Don't editorialize about AI replacing developers. Keep it grounded in your specific experience on this specific project.
