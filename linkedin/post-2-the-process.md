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

## Draft

I didn't write the code. Here's what I did instead.

Claude Code and GitHub Copilot handled all the implementation on Photo Signal — every component, every hook, every test. Multiple AI agents ran in parallel, each in an isolated git branch with its own dev server port so they never stepped on each other.

My job looked like this:

— Write precise specs. Vague requirements produce vague code. I learned to be exact.
— Review every PR the agents opened. Read for correctness, performance, and whether it matched the intent.
— Hold the quality bar. Every commit — human or agent — clears the same 7-step gate: lint, format, type-check, module README sync, tests, build, bundle size. No exceptions. No skipping.
— Make the calls the agents can't make. The biggest one: no QR codes. The prints had to work unmodified, under variable gallery lighting. That one call shaped the entire recognition architecture.

This isn't "AI wrote my code for me." It's closer to leading a team where every engineer ships fast, never complains, and needs you to know exactly what you want.

The bottleneck shifted from implementation to clarity of thought. That's a different skill. I think it's the more durable one.

Curious whether others are finding the same — where's the friction in your AI-assisted workflow?

---

## Notes

- The 7-step pre-commit gate is a concrete detail that signals real engineering discipline. It's not marketing language — every commit actually clears it.
- The "no QR codes" decision is the best example of a product call that shaped the whole system. It shows you don't just direct implementation — you make architectural decisions.
- The closing question is intentional. Engineers who've worked with AI tools will have opinions. That's a comment thread.
- Don't editorialize about AI replacing developers. Keep it grounded in your specific experience on this specific project.
