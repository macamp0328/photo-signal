# CodeQL Setup Guide for Private Repositories

> **Purpose**: Step-by-step instructions for enabling CodeQL code scanning on the Photo Signal private repository.

**Time Required**: 5 minutes  
**See also**: [docs/code-analysis-tooling-guide.md](./code-analysis-tooling-guide.md)

---

## Understanding the Issue

If you see this error in your GitHub Actions:

```
Code scanning is not enabled for this repository. 
Please enable code scanning in the repository settings.
```

This means CodeQL cannot upload results because **code scanning is not enabled** for this private repository.

---

## Why This Happens

- **Public repositories**: CodeQL works automatically (free)
- **Private repositories**: Requires **GitHub Advanced Security** (may require paid plan)

GitHub Advanced Security includes:
- Code scanning (CodeQL)
- Secret scanning
- Dependency review

---

## Solution Options

### Option 1: Enable Code Scanning (Recommended)

**Prerequisites**: GitHub Advanced Security access (check your plan)

#### Step 1: Check Your GitHub Plan

1. Go to your account settings: https://github.com/settings/billing
2. Check if "GitHub Advanced Security" is available
3. For personal accounts:
   - **GitHub Free**: Advanced Security not available for private repos
   - **GitHub Pro**: May not include Advanced Security
   - **GitHub Team/Enterprise**: Advanced Security available

#### Step 2: Enable Code Scanning

1. Go to your repository: https://github.com/macamp0328/photo-signal

2. Click **Settings** tab (top navigation)

3. In the left sidebar, navigate to:
   - **Security** → **Code security and analysis**

4. Find the **"Code scanning"** section

5. Click one of these options:
   - **"Set up" → "Default"** (easiest - uses recommended settings)
   - **"Set up" → "Advanced"** (if you want to customize)

6. If you choose "Default":
   - GitHub will automatically create a CodeQL workflow
   - Click **"Enable CodeQL"**
   - Done!

7. If you choose "Advanced":
   - GitHub will guide you through workflow configuration
   - You can use the existing `.github/workflows/codeql.yml` file

#### Step 3: Verify It Works

1. Go to **Actions** tab
2. Find the "CodeQL Security Analysis" workflow
3. Click "Run workflow" to test
4. Wait for it to complete
5. Check the **Security** tab - you should see "Code scanning" available

---

### Option 2: Make Repository Public (Free Alternative)

If you don't have GitHub Advanced Security access:

1. Go to repository **Settings** tab
2. Scroll to bottom → **Danger Zone**
3. Click **"Change visibility"**
4. Select **"Make public"**
5. Confirm the change

**Benefits:**
- CodeQL works automatically (free)
- All GitHub security features enabled

**Considerations:**
- Code becomes publicly visible
- Anyone can see your repository

---

### Option 3: Use CodeQL CLI Locally (Advanced)

Run CodeQL analysis on your local machine (free):

#### Install CodeQL CLI

```bash
# Download latest release
# Visit: https://github.com/github/codeql-cli-binaries/releases

# Example for macOS (adjust for your OS)
wget https://github.com/github/codeql-cli-binaries/releases/download/v2.15.3/codeql-osx64.zip
unzip codeql-osx64.zip

# Add to PATH
export PATH="$PATH:/path/to/codeql"
```

#### Create CodeQL Database

```bash
cd /home/runner/work/photo-signal/photo-signal

# Create database for JavaScript/TypeScript
codeql database create codeql-db \
  --language=javascript \
  --source-root=.
```

#### Run Analysis

```bash
# Download query packs
codeql pack download codeql/javascript-queries

# Run analysis
codeql database analyze codeql-db \
  codeql/javascript-queries:codeql-suites/javascript-security-extended.qls \
  --format=sarif-latest \
  --output=results.sarif

# View results
codeql sarif analyze results.sarif --verbose
```

#### Interpret Results

Results are saved in `results.sarif` (SARIF format):
- Open in VS Code with SARIF viewer extension
- Or view in GitHub Security tab (if you upload manually)
- Or parse JSON to see alerts

**Limitations:**
- Manual process (not automated)
- No GitHub UI integration
- You manage updates yourself

---

### Option 4: Disable CodeQL Workflow (Not Recommended)

If you don't need CodeQL scanning right now:

1. Remove or disable the workflow:

```bash
# Option A: Delete the workflow file
rm .github/workflows/codeql.yml

# Option B: Disable in GitHub UI
# Go to Actions → CodeQL Security Analysis → "..." → "Disable workflow"
```

**Why this is not recommended:**
- Loses security scanning benefits
- Less protection against vulnerabilities
- Doesn't align with the original goal of comprehensive code analysis

---

## Recommended Path

**For this project (photo-signal), we recommend:**

1. **Try Option 1 first**: Check if you have GitHub Advanced Security access
   - If yes: Enable code scanning (5 minutes)
   - If no: Continue to step 2

2. **Consider Option 2**: Make repository public
   - Pros: Free CodeQL, helps portfolio, open source
   - Cons: Code is public

3. **Use Option 3 as fallback**: Local CodeQL analysis
   - Pros: Still get security benefits
   - Cons: Manual, less convenient

4. **Avoid Option 4**: Don't disable - security is important!

---

## Troubleshooting

### "I don't see 'Code scanning' in Settings"

**Cause**: GitHub Advanced Security not available on your plan

**Solution**: 
- Make repository public (Option 2)
- Or use local CodeQL (Option 3)
- Or upgrade GitHub plan

### "Set up button is grayed out"

**Cause**: Insufficient permissions

**Solution**:
- You need admin access to the repository
- Contact repository owner to enable it

### "Workflow still fails after enabling"

**Cause**: May need to re-trigger workflow

**Solution**:
1. Go to Actions tab
2. Find the failed workflow run
3. Click "Re-run jobs"
4. Should succeed now

---

## What Happens When Enabled

Once code scanning is enabled:

✅ CodeQL analyzes code on every PR  
✅ Security alerts appear in Security tab  
✅ PR checks show CodeQL status  
✅ Automated scanning on schedule (weekly)  
✅ Vulnerability detection before merge  

---

## Cost Comparison

| Option | Monthly Cost | Automation | UI Integration |
|--------|--------------|------------|----------------|
| Public repo | **$0** | ✅ Full | ✅ Full |
| GitHub Pro + Advanced Security | ~$4/user | ✅ Full | ✅ Full |
| Local CodeQL | **$0** | ❌ Manual | ❌ Limited |
| Disable CodeQL | **$0** | ❌ None | ❌ None |

---

## Next Steps

1. **Choose your option** (we recommend Option 1 or 2)
2. **Follow the steps** in the relevant section above
3. **Test the workflow** - trigger a new run
4. **Verify results** - check Security tab for findings

---

## Support

If you encounter issues:

1. Check [GitHub's CodeQL documentation](https://docs.github.com/en/code-security/code-scanning)
2. Review [CodeQL troubleshooting guide](https://docs.github.com/en/code-security/code-scanning/troubleshooting-code-scanning)
3. Contact GitHub Support (if you have a paid plan)
4. Ask in [GitHub Community](https://github.community/)

---

## References

- [GitHub Advanced Security Documentation](https://docs.github.com/en/get-started/learning-about-github/about-github-advanced-security)
- [CodeQL CLI Documentation](https://codeql.github.com/docs/codeql-cli/)
- [CodeQL Queries Repository](https://github.com/github/codeql)
- [SARIF Format Specification](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html)
