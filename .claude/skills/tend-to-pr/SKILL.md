---
name: tend-to-pr
description: Tends to an open PR on the current branch — reads all review comments, decides to fix or decline each one (always replies), then fixes CI failures and iterates until all checks are green. Use when an agent has opened a PR and needs to respond to code review feedback and/or repair failing CI.
disable-model-invocation: true
tools: Bash, Read, Edit, Write, Glob, Grep
---

# Tend to PR

Address all pending feedback on the current branch's open PR: respond to every review comment (fix or decline — always reply) and drive CI to all-green.

If a PR number is provided as an argument, use that. Otherwise default to the PR for the current branch.

**PR to tend:** $ARGUMENTS

## Live Context

- Current branch: !`git branch --show-current`
- PR status (current branch): !`gh pr view --json number,title,state,statusCheckRollup 2>/dev/null || echo "No open PR found for this branch"`

---

## Phase 1 — Orient

Establish what needs attention before taking any action.

```bash
# Resolve PR number — normalize any form ($ARGUMENTS may be a number, #number, or URL)
if [ -n "$ARGUMENTS" ]; then
  pr_number="$(gh pr view "$ARGUMENTS" --json number --jq '.number')"
else
  pr_number="$(gh pr view --json number --jq '.number')"
fi

# Show basic PR info for the resolved PR
gh pr view "$pr_number" --json number,title,headRefName,baseRefName,state

# Get all inline review comments — --paginate fetches all pages, not just the first 30
# Capture original_line, position, and diff_hunk for comments on outdated diffs (where line is null)
gh api repos/{owner}/{repo}/pulls/"$pr_number"/comments \
  --paginate \
  --jq '[.[] | {id, path, line, original_line, position, original_position, diff_hunk, body, user: .user.login, in_reply_to_id}]'
# When reading files for inline comments, use `line` when present.
# If `line` is null (comment is on an outdated diff), fall back to `original_line` or parse `diff_hunk`.

# Get general PR comments — paginate to catch all of them
gh api repos/{owner}/{repo}/issues/"$pr_number"/comments \
  --paginate \
  --jq '[.[] | {id, body, user: .user.login}]'

# Get review thread IDs for GraphQL resolution (maps REST comment id → GraphQL thread id)
gh api graphql \
  -F owner='{owner}' -F repo='{repo}' -F number="$pr_number" \
  -f query='
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviewThreads(first: 100) {
        nodes {
          id
          isResolved
          comments(first: 1) { nodes { databaseId } }
        }
      }
    }
  }
}'
# Match thread.comments[0].databaseId to the REST comment id to find the thread id.

# Get full review objects (approval/changes-requested state)
gh pr view "$pr_number" --json reviews \
  --jq '[.reviews[] | {author: .author.login, state, body, submittedAt}]'

# Get CI check status
gh pr checks "$pr_number"
```

**Categorize what you find:**

| Category                                | Action                               |
| --------------------------------------- | ------------------------------------ |
| Inline code review thread               | Phase 2                              |
| General PR comment (non-bot)            | Phase 2                              |
| `github-actions[bot]` auto-fix messages | Skip — no reply needed               |
| Copilot suggestion comment              | Phase 2 (treat same as human review) |
| Failing CI check                        | Phase 3                              |

---

## Phase 2 — Address Review Comments

Work through every unresolved review comment one at a time.

### For each comment:

1. **Read the file at the referenced location** (for inline comments, use `path` + `line` from the API response)

2. **Evaluate the suggestion** against:
   - Does it fix a real bug or improve correctness?
   - Does it align with the conventions in `CLAUDE.md` (strict TypeScript, CSS Modules, no over-engineering, aesthetic intent preserved)?
   - Is the project's deliberate complexity (extensibility design) being respected?

3. **Decide and act:**

   **If fixing:**
   - Make the edit
   - Note what changed

   **If declining:**
   - Prepare a specific reason grounded in the codebase's conventions or design intent
   - Examples: "intentional per CLAUDE.md extensibility design", "CSS Modules scoping is by design", "this complexity is load-bearing per the aesthetic identity"

   **If ambiguous** (unclear intent, requires product judgment, or it's a comment from a human reviewer — not a bot — that you want to decline):
   - Stop and ask the user in chat before acting. Don't guess on human reviewer intent.

4. **Reply to the comment** via `gh api`:

   For inline review comment replies (`comment_id` is the `id` from the Phase 1 API response):

   ```bash
   gh api repos/{owner}/{repo}/pulls/"$pr_number"/comments/"$comment_id"/replies \
     --method POST \
     --field body="Your reply here"
   ```

   For general PR comments:

   ```bash
   gh api repos/{owner}/{repo}/issues/"$pr_number"/comments \
     --method POST \
     --field body="Your reply here"
   ```

5. **After fixing**, if you've addressed everything in a thread and have appropriate permissions, you can resolve the review thread using the GraphQL API. Use the thread `id` from the Phase 1 GraphQL query (matched via `databaseId` → REST `comment.id`):

   ```bash
   gh api graphql --field threadId="$thread_id" -f query='
   mutation ResolveThread($threadId: ID!) {
     resolveReviewThread(input: { threadId: $threadId }) {
       thread { isResolved }
     }
   }'
   ```

   This requires sufficient repository permissions; if it fails, skip resolution and rely on the GitHub UI instead.

### Reply tone

Be concise and direct. Examples:

- Fix: "Fixed — moved the close button to top-right as suggested."
- Decline: "Keeping this as-is — the three-variant exposure pattern is intentional for lighting robustness per the recognition design."
- Partial: "Updated the type annotation. Left the structure unchanged — the extensibility here is intentional per CLAUDE.md."

---

## Phase 3 — Fix CI Failures

**Max 3 fix-and-push cycles per failing check.** If a check is still failing after 3 attempts, stop and report to the user — don't spin.

### Step 1: Check what's failing

```bash
gh pr checks "$pr_number"
```

If all checks are green, skip to Phase 4.

### Step 2: For each failing check

```bash
# Get the run ID from the check URL or list
gh run list --branch $(git branch --show-current) --limit 5

# Fetch the failure logs
gh run view {run_id} --log-failed
```

**Diagnose the root cause:**

| Log signature             | Likely cause     | Fix approach                                |
| ------------------------- | ---------------- | ------------------------------------------- |
| `ESLint` errors           | Linting          | `npm run lint:fix`                          |
| `Prettier` / `Code style` | Formatting       | `npm run format`                            |
| `TS` / `error TS`         | Type errors      | Fix the specific type error                 |
| `FAIL` / `AssertionError` | Test failure     | Fix the failing test or the code under test |
| `Build failed`            | Vite build error | Fix the import/export/syntax error          |
| `Bundle size exceeded`    | Bundle too large | Investigate what grew; reduce if possible   |

### Step 3: Apply fix and verify locally

```bash
# Fix the identified issue in source files, then:
npm run pre-commit
```

If `pre-commit` still fails, iterate on the fix until it passes **before** committing. Do not commit broken code.

### Step 4: Commit and push

```bash
git add <specific files — never git add -A blindly>
git commit -m "fix: <concise description of what was fixed>" \
  -m "Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push
```

### Step 5: Wait and re-check

```bash
# Wait for CI to pick up the push, then check again
gh pr checks "$pr_number" --watch
```

If new failures appear, loop back to Step 1 (increment the cycle counter).

---

## Phase 4 — Final Status Report

Summarize everything that was done. Output a clear report:

```
## PR Tended: #{pr_number} — {title}

### Review Comments ({n} total)
- ✅ Fixed: {comment summary} → {what changed}
- ✅ Fixed: ...
- 💬 Declined: {comment summary} → {reason}
- ⏭️ Skipped: bot auto-fix message

### CI Fixes ({n} checks fixed)
- ✅ {check name}: {what was broken} → {how fixed}

### Current Status
- All required checks: PASSING ✅  (or list what's still failing)

### Needs Human Attention
{anything you couldn't resolve, or "Nothing — all done."}
```

---

## Guardrails

- **Never** use `--no-verify` or skip `npm run pre-commit` before pushing
- **Never** `git add -A` — always stage specific files
- **Always** reply to every non-bot comment, even if declining
- **Always** ask the user before declining a comment from a human reviewer (not a bot)
- **Stop and ask** if a CI failure is in infrastructure, secrets, or external services — don't attempt to fix things outside the codebase
- **Stop and ask** after 3 failed fix attempts on the same CI check
