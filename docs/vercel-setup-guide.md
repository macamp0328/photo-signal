# Vercel Deployment Setup Guide

> **Purpose**: Step-by-step guide for configuring Vercel to automatically deploy this project from the `main` branch.

---

## Overview

This project is configured to deploy to Vercel using Vercel's GitHub App integration. Deployments are **automatically triggered** when changes are pushed to the `main` branch only (preview deployments for PRs are disabled to optimize for free tier usage).

**Key Configuration**:

- **Auto-deploy**: Main branch only
- **Preview deployments**: Disabled
- **Build command**: `npm run build`
- **Output directory**: `dist`
- **Framework**: Vite

---

## Prerequisites

1. **GitHub Account**: Access to this repository (macamp0328/photo-signal)
2. **Vercel Account**: Free tier is sufficient
   - Sign up at [vercel.com](https://vercel.com)
   - Recommended: Sign in with GitHub for easier integration

---

## Initial Setup (First-Time Configuration)

### Step 1: Create Vercel Account

1. Go to [vercel.com](https://vercel.com)
2. Click **"Sign Up"**
3. Choose **"Continue with GitHub"** (recommended)
4. Authorize Vercel to access your GitHub account

### Step 2: Import Project from GitHub

1. From Vercel dashboard, click **"Add New"** → **"Project"**
2. In the "Import Git Repository" section:
   - Click **"Import"** next to `macamp0328/photo-signal`
   - If repository isn't visible:
     - Click **"Adjust GitHub App Permissions"**
     - Grant Vercel access to the repository
     - Return to import screen

3. Configure project:
   - **Project Name**: `photo-signal` (or custom name)
   - **Framework Preset**: Vercel should auto-detect "Vite"
   - **Root Directory**: `.` (leave as default)
   - **Build and Output Settings**:
     - Build Command: `npm run build` (auto-detected from vercel.json)
     - Output Directory: `dist` (auto-detected from vercel.json)
     - Install Command: `npm install` (auto-detected)

4. Click **"Deploy"**

### Step 3: Verify Initial Deployment

1. Wait for deployment to complete (typically 1-2 minutes)
2. You'll see:
   - ✅ Green checkmark for successful deployment
   - 🔗 Production URL (e.g., `photo-signal.vercel.app`)
3. Click the production URL to verify the site works

---

## Vercel Configuration File (`vercel.json`)

The repository includes a `vercel.json` file at the root with the following configuration:

```json
{
  "git": {
    "deploymentEnabled": {
      "main": true
    }
  },
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "vite",
  "regions": ["iad1"]
}
```

**Configuration Explained**:

| Setting                      | Value           | Purpose                                                |
| ---------------------------- | --------------- | ------------------------------------------------------ |
| `git.deploymentEnabled.main` | `true`          | Only deploy when changes are pushed to `main` branch   |
| `buildCommand`               | `npm run build` | Command to build production bundle                     |
| `outputDirectory`            | `dist`          | Directory containing build output                      |
| `devCommand`                 | `npm run dev`   | Command for local development (not used in production) |
| `installCommand`             | `npm install`   | Command to install dependencies                        |
| `framework`                  | `vite`          | Framework detection for optimizations                  |
| `regions`                    | `["iad1"]`      | AWS US East (North Virginia) deployment region         |

---

## Deployment Workflow

### Automatic Deployments (Main Branch Only)

**When it deploys**:

- ✅ Direct pushes to `main` branch
- ✅ Merged pull requests into `main`
- ✅ Fast-forward merges to `main`

**When it does NOT deploy**:

- ❌ Pull request branches (preview deployments disabled)
- ❌ Feature branches
- ❌ Draft pull requests

**Why main-only?**

- Optimizes for Vercel's free tier build minutes
- Reduces unnecessary builds for work-in-progress PRs
- Production deployment only happens after code review and merge

### Deployment Process

1. **Trigger**: Code pushed/merged to `main`
2. **Build**: Vercel runs `npm install` → `npm run build`
3. **Deploy**: Uploads `dist/` directory to CDN
4. **Verify**: Production URL updated automatically

---

## Verifying Deployment Status

### Option 1: Vercel Dashboard

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click on your project (e.g., `photo-signal`)
3. View **Deployments** tab:
   - ✅ **Ready** = Successful deployment
   - ⏳ **Building** = In progress
   - ❌ **Error** = Failed (check logs)

### Option 2: GitHub Integration

1. Go to repository on GitHub: https://github.com/macamp0328/photo-signal
2. Click on **Commits** tab
3. Look for Vercel status check next to each commit:
   - ✅ Green checkmark = Deployed successfully
   - ❌ Red X = Deployment failed
   - Click "Details" to view Vercel deployment logs

### Option 3: Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Check deployment status
vercel ls

# View deployment details
vercel inspect <deployment-url>
```

---

## Troubleshooting

### Issue: Deployments Not Triggering

**Symptoms**:

- No new deployments appear in Vercel dashboard
- GitHub commits don't show Vercel status check

**Solutions**:

1. **Check GitHub App Integration**:
   - Go to Vercel dashboard → Project Settings → Git
   - Verify GitHub repository is connected
   - If not connected, click "Connect Git Repository"

2. **Verify Branch Configuration**:
   - Go to Vercel dashboard → Project Settings → Git
   - Check "Production Branch" is set to `main`
   - Ensure branch name matches exactly (case-sensitive)

3. **Check Vercel GitHub App Permissions**:
   - Go to GitHub → Settings → Applications → Vercel
   - Ensure Vercel has access to the repository
   - Grant access if missing

4. **Reinstall Vercel GitHub Integration**:
   - Go to Vercel dashboard → Project Settings → Git
   - Click "Disconnect" (if connected)
   - Click "Connect Git Repository" and reauthorize

5. **Verify `vercel.json` Configuration**:
   - Ensure `git.deploymentEnabled.main: true` is set
   - Check file is in repository root
   - Verify JSON syntax is valid

### Issue: Build Failures

**Symptoms**:

- Deployment status shows "Error"
- Production URL shows "Deployment Failed"

**Solutions**:

1. **Check Build Logs**:
   - Vercel dashboard → Deployments → Click failed deployment
   - Review build logs for error messages

2. **Test Build Locally**:

   ```bash
   # Clean install dependencies
   rm -rf node_modules package-lock.json
   npm install

   # Run full quality checks
   npm run lint
   npm run format:check
   npm run type-check
   npm run build
   ```

3. **Common Build Issues**:
   - **TypeScript errors**: Run `npm run type-check` locally
   - **Missing dependencies**: Ensure `package.json` includes all dependencies
   - **Linting errors**: Run `npm run lint:fix`
   - **Out of memory**: Contact Vercel support to increase build memory

### Issue: Site Not Loading After Deployment

**Symptoms**:

- Deployment succeeds but site shows blank page
- Console errors in browser

**Solutions**:

1. **Check Browser Console**:
   - Open DevTools (F12)
   - Look for JavaScript errors
   - Check for CORS or loading errors

2. **Verify Build Output**:

   ```bash
   # Build locally and check dist/ directory
   npm run build
   ls -la dist/

   # Should contain:
   # - index.html
   # - assets/ directory with JS/CSS files
   ```

3. **Test Production Build Locally**:

   ```bash
   # Preview production build
   npm run preview

   # Visit http://localhost:4173
   # If it works locally but not on Vercel, check:
   # - Environment variables (if any)
   # - API endpoints (should be relative paths)
   ```

### Issue: Deployment Succeeds But Changes Not Visible

**Symptoms**:

- Vercel shows successful deployment
- Site still shows old version

**Solutions**:

1. **Hard Refresh Browser**:
   - Chrome/Firefox: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Safari: Cmd+Option+R

2. **Check Deployment URL**:
   - Each deployment has a unique URL (e.g., `photo-signal-abc123.vercel.app`)
   - Production URL may take a few seconds to update
   - Try the deployment-specific URL to verify changes

3. **Clear Browser Cache**:
   - Clear cache for the production domain
   - Try in incognito/private browsing mode

---

## Environment Variables (If Needed)

Currently, this project **does not require environment variables**. It's a static site with no backend APIs or secrets.

If you add environment variables in the future:

1. Go to Vercel dashboard → Project Settings → Environment Variables
2. Add variables for each environment:
   - **Production**: Used for production deployments
   - **Preview**: Used for preview deployments (currently disabled)
   - **Development**: Used for local development via Vercel CLI
3. Redeploy to apply changes

**Security Note**: Never commit secrets to the repository. Use Vercel's environment variables feature for sensitive data.

---

## Advanced Configuration

### Custom Domain

To use a custom domain (e.g., `photosignal.com`):

1. Go to Vercel dashboard → Project Settings → Domains
2. Click **"Add"**
3. Enter your domain name
4. Follow DNS configuration instructions
5. Wait for DNS propagation (up to 48 hours)

### Deployment Hooks

To trigger deployments from external services:

1. Go to Vercel dashboard → Project Settings → Git → Deploy Hooks
2. Click **"Create Hook"**
3. Name the hook and select branch
4. Copy the webhook URL
5. Use with CI/CD or automation tools

### Performance Monitoring

Vercel automatically provides:

- **Analytics**: Page views, performance metrics
- **Speed Insights**: Core Web Vitals tracking
- **Logs**: Runtime and build logs

Access from Vercel dashboard → Project → Analytics/Logs tabs.

---

## Testing Deployment

### Manual Test

After setup, test the deployment workflow:

1. Make a small change (e.g., update README.md)
2. Commit and push to `main` branch:
   ```bash
   git add README.md
   git commit -m "test: verify Vercel deployment"
   git push origin main
   ```
3. Monitor deploymentt:
   - Watch GitHub commit status check
   - Check Vercel dashboard for new deployment
   - Visit production URL to verify change appears

### Automated Test

The repository includes GitHub Actions CI that runs on every push/PR:

- Linting with ESLint
- Formatting with Prettier
- Type-checking with TypeScript
- Building with Vite
- Testing with Vitest
- Bundle size checks

**Note**: GitHub Actions does NOT trigger Vercel deployments. Vercel uses its own GitHub App integration.

---

## Deployment Checklist

Use this checklist when setting up or debugging Vercel deployments:

### Initial Setup

- [ ] Vercel account created
- [ ] GitHub repository connected to Vercel
- [ ] Project imported and first deployment successful
- [ ] Production URL accessible and site loads correctly
- [ ] `vercel.json` configuration verified

### After Each Deployment

- [ ] Deployment status is "Ready" in Vercel dashboard
- [ ] Production URL shows latest changes
- [ ] No console errors in browser DevTools
- [ ] Camera and audio features work (if testing functionality)
- [ ] Mobile view renders correctly

### Troubleshooting

- [ ] GitHub Actions CI checks pass
- [ ] Build succeeds locally with `npm run build`
- [ ] Preview build works locally with `npm run preview`
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] No linting errors (`npm run lint`)
- [ ] Vercel GitHub App has repository access
- [ ] Production branch is set to `main` in Vercel settings

---

## GitHub Actions vs Vercel

**Common Confusion**: This project uses BOTH GitHub Actions CI and Vercel deployments. Here's the difference:

| Feature           | GitHub Actions CI                  | Vercel Deployment                |
| ----------------- | ---------------------------------- | -------------------------------- |
| **Purpose**       | Quality checks (lint, test, build) | Deploy to production CDN         |
| **Trigger**       | Every push + PR                    | Only `main` branch               |
| **Location**      | `.github/workflows/ci.yml`         | Vercel's servers                 |
| **Configuration** | GitHub Actions workflow            | `vercel.json` + Vercel dashboard |
| **Runs**          | On every commit to any branch      | Only on `main` commits           |
| **Output**        | CI status check on PR              | Live website URL                 |

**Workflow**:

1. Create PR → GitHub Actions runs CI checks
2. CI checks pass → Request code review
3. PR approved and merged → Vercel deploys to production

---

## Cost Optimization

This project is configured to **stay within Vercel's free tier**:

**Free Tier Limits** (as of 2024):

- 100 GB bandwidth/month
- 6,000 build minutes/month (100 hours)
- Unlimited deployments

**Optimizations Used**:

1. ✅ **Main-only deployments**: Disables preview deployments to save build minutes
2. ✅ **Efficient build**: Vite produces optimized bundles (~75 KB gzipped)
3. ✅ **No serverless functions**: Static site only (no API routes)
4. ✅ **Single region**: `iad1` (US East) reduces latency for US users
5. ✅ **Minimal dependencies**: Only essential packages included

**Estimated Monthly Usage**:

- **Bandwidth**: ~1-5 GB (assuming moderate traffic)
- **Build minutes**: ~1-5 minutes per deployment (~30-150 minutes/month)
- **Well within free tier limits** ✅

---

## Security Best Practices

### DO:

- ✅ Use environment variables for any secrets (when needed)
- ✅ Enable HTTPS (automatic with Vercel)
- ✅ Keep dependencies updated with `npm audit`
- ✅ Review Vercel deployment logs for security warnings

### DON'T:

- ❌ Commit API keys or secrets to repository
- ❌ Disable HTTPS (always use secure connections)
- ❌ Expose sensitive user data in client-side code
- ❌ Ignore security warnings in build logs

---

## Additional Resources

### Official Documentation

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Git Integration](https://vercel.com/docs/concepts/git)
- [Vercel CLI Reference](https://vercel.com/docs/cli)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html#vercel)

### Project Documentation

- [SETUP.md](../SETUP.md) - Development environment setup
- [README.md](../README.md) - Project overview and features
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guidelines

### Support

- [Vercel Community](https://github.com/vercel/vercel/discussions)
- [Vercel Status](https://www.vercel-status.com/) - Check for outages
- [Project Issues](https://github.com/macamp0328/photo-signal/issues) - Report project-specific issues

---

## Quick Reference

### Vercel Dashboard URLs

- Main dashboard: https://vercel.com/dashboard
- Project settings: https://vercel.com/[username]/photo-signal/settings
- Deployments: https://vercel.com/[username]/photo-signal/deployments

### Useful Commands

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# List deployments
vercel ls

# Pull environment variables
vercel env pull

# Trigger deployment manually
vercel --prod

# View logs
vercel logs [deployment-url]
```

### Support Checklist

When asking for help, include:

- [ ] Vercel deployment URL
- [ ] Build logs (from Vercel dashboard)
- [ ] GitHub commit SHA
- [ ] Browser console errors (if site not loading)
- [ ] Steps to reproduce the issue

---

**Last Updated**: 2025-11-10  
**Vercel Version**: Latest (auto-updated)  
**Project**: Photo Signal v0.0.0
