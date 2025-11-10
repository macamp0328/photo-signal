# Codecov Setup Guide

> **Purpose**: Step-by-step instructions for setting up Codecov coverage tracking for the Photo Signal repository.

**Time Required**: 5-10 minutes  
**See also**: [docs/code-analysis-tooling-guide.md](./code-analysis-tooling-guide.md)

---

## What You'll Need

- GitHub account with admin access to `macamp0328/photo-signal` repository
- Web browser

---

## Step-by-Step Setup

### Step 1: Sign Up for Codecov

1. Go to [https://codecov.io](https://codecov.io)
2. Click **"Sign up"** in the top-right corner
3. Click **"Sign up with GitHub"**
4. Authorize Codecov to access your GitHub account
   - Review the permissions requested
   - Click **"Authorize codecov"**

**Screenshot:**
![Codecov Sign Up](https://docs.codecov.com/img/login.png)

---

### Step 2: Add Your Repository

1. After signing in, you'll see your Codecov dashboard
2. Click **"Add a repository"** or **"Not yet setup"** tab
3. Find `macamp0328/photo-signal` in the list
   - You can use the search box to filter repositories
4. Click **"Setup repo"** or the toggle switch next to the repository name

**Note**: If you don't see your repository:
- Click **"Refresh repositories"** button
- Ensure you have admin access to the repository on GitHub
- Check that the Codecov GitHub App has access to the repository

---

### Step 3: Get Your Upload Token

Once the repository is added:

1. You'll be taken to the repository setup page
2. Look for the **"Repository Upload Token"** section
3. Click **"Copy"** to copy the token to your clipboard
   - The token looks like: `1a2b3c4d-5e6f-7g8h-9i0j-k1l2m3n4o5p6`
   - Keep this token secure - it's like a password!

**Alternative path** if you're already past the setup page:
1. Go to your Codecov dashboard at [https://app.codecov.io](https://app.codecov.io)
2. Select the `photo-signal` repository
3. Click **"Settings"** in the left sidebar
4. Under **"General"**, find **"Repository Upload Token"**
5. Click to reveal the token, then copy it

**Screenshot showing token location:**
```
Settings → General → Repository Upload Token
[●●●●●●●●-●●●●-●●●●-●●●●-●●●●●●●●●●●●] [Copy]
```

---

### Step 4: Add Token to GitHub Repository Secrets

Now that you have the token, add it to your GitHub repository:

1. Go to your GitHub repository: [https://github.com/macamp0328/photo-signal](https://github.com/macamp0328/photo-signal)

2. Click **"Settings"** tab (top navigation, far right)
   - If you don't see Settings, you may not have admin access

3. In the left sidebar, click **"Secrets and variables"**

4. Click **"Actions"** (under "Secrets and variables")

5. Click the green **"New repository secret"** button

6. Fill in the form:
   - **Name**: `CODECOV_TOKEN` (must be exactly this)
   - **Secret**: Paste the token you copied from Codecov
   - Click **"Add secret"**

**Visual guide:**
```
Settings → Secrets and variables → Actions → New repository secret

Name:    CODECOV_TOKEN
Secret:  [paste your token here]

         [Add secret]
```

---

### Step 5: Verify the Setup

The token is now configured! Here's how to verify it works:

#### Option A: Wait for Next PR or Push

1. The next time you push code or create a PR, the CI workflow will run
2. Check the workflow run in the **"Actions"** tab
3. Look for the step: **"Upload coverage reports to Codecov"**
4. It should show: ✅ Success with a message like:
   ```
   Uploading coverage reports to Codecov
   ✓ Coverage report uploaded successfully
   ```

#### Option B: Manual Workflow Run (Optional)

1. Go to the **"Actions"** tab in your repository
2. Click **"CI"** workflow in the left sidebar
3. Click **"Run workflow"** dropdown
4. Select **"Run workflow"** to trigger a manual run
5. Wait for it to complete and check the Codecov upload step

---

### Step 6: View Coverage Reports

Once the token is working:

1. Go to [https://app.codecov.io/gh/macamp0328/photo-signal](https://app.codecov.io/gh/macamp0328/photo-signal)
2. You'll see coverage statistics and trends
3. On future PRs, you'll get automated comments showing coverage changes

**Example PR comment from Codecov:**
```
codecov[bot] commented 2 minutes ago

## Codecov Report
Base: 70.5%   Head: 72.4%   +1.9% 🎉

Coverage increased by 1.9%

| Files | Coverage Δ |
|-------|-----------|
| src/modules/camera-view/CameraView.tsx | 95.2% → 96.1% (+0.9%) |

[View full report on Codecov.io →]
```

---

## Troubleshooting

### "Invalid token" or Upload Fails

**Cause**: Token may be incorrect or repository not configured

**Fix**:
1. Double-check the token in GitHub Secrets matches the one in Codecov
2. Ensure the secret name is exactly `CODECOV_TOKEN` (case-sensitive)
3. Re-copy the token from Codecov and update the GitHub secret

### Can't Find Repository in Codecov

**Cause**: Codecov doesn't have access to the repository

**Fix**:
1. Go to [https://github.com/apps/codecov](https://github.com/apps/codecov)
2. Click **"Configure"**
3. Select your account (`macamp0328`)
4. Under **"Repository access"**, ensure `photo-signal` is included
5. Save changes and refresh Codecov

### No Coverage Report in PR

**Cause**: CI workflow hasn't run yet, or token not configured

**Fix**:
1. Verify the token is added to GitHub Secrets (Step 4)
2. Push a new commit to trigger the workflow
3. Check the workflow logs for errors in the Codecov upload step

### "Codecov token not found" Warning

**Cause**: Token is optional for public repos, but you have a private repo

**Fix**:
1. This warning is expected if the token isn't set
2. Follow Steps 3-4 to add the token
3. The warning will disappear on the next workflow run

---

## What Codecov Does

Once set up, Codecov will:

- ✅ Track coverage over time (trends)
- ✅ Show coverage changes in PR comments
- ✅ Highlight lines not covered by tests
- ✅ Provide detailed coverage reports
- ✅ Compare coverage between branches

**All at no cost** for up to 5 private repositories!

---

## Security Notes

- The `CODECOV_TOKEN` is **secret** - never commit it to code or share it publicly
- GitHub Secrets are encrypted and only accessible to workflows
- Codecov uses the token only to upload coverage reports, not to access your code
- You can regenerate the token in Codecov settings if it's compromised

---

## Next Steps

After setup is complete:

1. Coverage reports will appear automatically on PRs
2. Review coverage trends in the Codecov dashboard
3. Aim to maintain or improve coverage with each PR
4. Check the [Codecov documentation](https://docs.codecov.com/) for advanced features

---

## Quick Reference

| What | Where |
|------|-------|
| **Codecov Dashboard** | https://app.codecov.io/gh/macamp0328/photo-signal |
| **Get Token** | Codecov → Settings → General → Repository Upload Token |
| **Add Secret** | GitHub → Settings → Secrets and variables → Actions → New repository secret |
| **Secret Name** | `CODECOV_TOKEN` (exactly, case-sensitive) |
| **Verify Setup** | Check next PR or workflow run in Actions tab |

---

## Support

If you encounter issues:

1. Check the [Codecov documentation](https://docs.codecov.com/)
2. Review the [GitHub Secrets documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
3. Check workflow logs in the Actions tab for error messages
4. Contact Codecov support at https://codecov.io/support
