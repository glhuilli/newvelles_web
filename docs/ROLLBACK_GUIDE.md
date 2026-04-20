# Newvelles Web - Rollback Guide

**Version:** 1.0
**Last Updated:** 2026-04-19

## Table of Contents

1. [Overview](#overview)
2. [When to Rollback](#when-to-rollback)
3. [Quick Rollback](#quick-rollback)
4. [Rollback Methods](#rollback-methods)
5. [Step-by-Step Rollback](#step-by-step-rollback)
6. [Verification After Rollback](#verification-after-rollback)
7. [Troubleshooting Rollback Issues](#troubleshooting-rollback-issues)
8. [Emergency Procedures](#emergency-procedures)
9. [Post-Rollback Actions](#post-rollback-actions)

---

## Overview

The rollback mechanism allows you to quickly revert to a previous stable deployment when issues arise in production. Rollbacks use deployment metadata stored in `.deployments/` and redeploy a previous container image via AWS Lightsail.

### Key Features

- **One-command rollback**: `./bin/rollback.sh --previous`
- **Interactive selection**: Choose from last 10 deployments
- **Metadata-driven**: Uses deployment history from `.deployments/`
- **Health verification**: Runs health checks after rollback
- **Fast execution**: 2-4 minutes typical rollback time

### Rollback vs. Forward Fix

| Approach | When to Use | Duration | Risk |
|----------|-------------|----------|------|
| **Rollback** | Critical bug, immediate fix needed | 2-4 min | Low |
| **Forward Fix** | Minor issue, fix is simple | 6-8 min | Medium |

**Rule of thumb**: If you can't fix and test the issue in <10 minutes, rollback first.

---

## When to Rollback

### Immediate Rollback (Critical)

Rollback immediately if you observe:

- ❌ **Site completely down** (500 errors, no response)
- ❌ **Critical functionality broken** (news not loading, API errors)
- ❌ **Database corruption** (data loss, integrity issues)
- ❌ **Security vulnerability introduced**
- ❌ **Performance degradation >5x slower**

### Consider Rollback (High Priority)

Rollback if you observe:

- ⚠️ **Health checks failing** after deployment
- ⚠️ **JavaScript errors** in browser console (widespread)
- ⚠️ **Visual breakage** (layout issues, missing content)
- ⚠️ **Increased error rate** in logs (>10%)

### Forward Fix Acceptable (Low Priority)

Forward fix if:

- ✅ **Minor visual issues** (small CSS tweaks)
- ✅ **Non-critical bugs** (edge cases, rare scenarios)
- ✅ **Performance minor** (<2x slower)
- ✅ **Quick fix available** (<10 minutes to fix + deploy)

---

## Quick Rollback

### Fastest Rollback (Emergency)

If site is down and you need to rollback immediately:

```bash
./bin/rollback.sh --previous --force
```

**What this does:**
- Rolls back to the immediately previous deployment
- Skips confirmation prompt
- Deploys previous version
- Runs health checks

**Duration:** 2-3 minutes

**Use case:** Site is down, need immediate fix

---

## Rollback Methods

### Method 1: Rollback to Previous Version (Most Common)

```bash
./bin/rollback.sh --previous
```

**Confirmation prompt shown:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  Rollback Confirmation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Version: d7e9f1a-20260418-142033
  Git SHA: d7e9f1a
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Continue with rollback? (yes/no):
```

Type `yes` to proceed.

### Method 2: Interactive Rollback

```bash
./bin/rollback.sh
```

**Shows deployment list:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📜 Available Deployments for Rollback
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1] a3f4b2c-20260419-183045 (current)
    Git: a3f4b2c | Branch: main
    Deployed: 2026-04-19 18:30:45 UTC
    By: user@hostname

[2] d7e9f1a-20260418-142033
    Git: d7e9f1a | Branch: main
    Deployed: 2026-04-18 14:20:33 UTC
    By: user@hostname

[3] f2b8d3e-20260417-091522
    Git: f2b8d3e | Branch: main
    Deployed: 2026-04-17 09:15:22 UTC
    By: user@hostname

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Select deployment version to rollback to:
Enter version number or full version string:
```

Enter `2` (or full version string) to select.

### Method 3: Specific Version Rollback

```bash
./bin/rollback.sh --version d7e9f1a-20260418-142033
```

**Use case:** Rollback to specific known-good version (not just previous)

### Method 4: List Available Versions Only

```bash
./bin/rollback.sh --list
```

**Shows available versions without rollback**

---

## Step-by-Step Rollback

### Step 1: Assess the Situation

**Before rolling back, gather information:**

1. **What is broken?**
   - Site down completely?
   - Specific functionality broken?
   - Performance issue?

2. **When did it break?**
   - Immediately after deployment?
   - After some time?

3. **What changed?**
   ```bash
   # View recent deployments
   ls -lt .deployments/*.json | head -3

   # Compare current vs previous
   cat .deployments/current.json | jq
   ```

4. **Check logs:**
   ```bash
   # AWS Lightsail logs
   aws lightsail get-container-log \
     --service-name newvelles-web-service \
     --container-name flask \
     --region us-west-2
   ```

### Step 2: Decide on Rollback Target

**Choose rollback version:**

- **Previous version** (most common):
  ```bash
  ./bin/rollback.sh --previous
  ```

- **Specific known-good version**:
  ```bash
  # List versions first
  ./bin/rollback.sh --list

  # Rollback to specific version
  ./bin/rollback.sh --version f2b8d3e-20260417-091522
  ```

### Step 3: Execute Rollback

**Run rollback command:**

```bash
./bin/rollback.sh --previous
```

**Monitor output:**

#### Phase 1: List Deployments
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📜 Available Deployments for Rollback
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Shows deployment history]
```

#### Phase 2: Target Selection
```
Selected previous deployment: d7e9f1a-20260418-142033
```

#### Phase 3: Confirmation
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  Rollback Confirmation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Version: d7e9f1a-20260418-142033
  Git SHA: d7e9f1a
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Continue with rollback? (yes/no): yes
```

#### Phase 4: Rollback Deployment
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 Starting Rollback
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   Image: :newvelles-web-service.newvelles-web-container.38

📄 Creating rollback configuration...
✅ Configuration created

🚀 Deploying rollback...
✅ Rollback deployment initiated
```

#### Phase 5: Wait for Completion
```
⏳ Waiting for rollback to complete...
   This may take 2-5 minutes. Please wait...

   Status: UPDATING | Deployment: ACTIVATING (attempt 1/30)
   Status: UPDATING | Deployment: ACTIVATING (attempt 2/30)
   ...
   Status: RUNNING | Deployment: ACTIVE (attempt 6/30)
✅ Rollback complete (status: RUNNING)
```

#### Phase 6: Health Checks
```
🏥 Running health checks...

✓ Lightsail Service: RUNNING (Deployment: ACTIVE)
✓ Health endpoint: 200 OK
✓ Homepage: 200 OK
✓ News API: 200 OK
✓ Metadata API: 200 OK

✅ Health checks passed
```

#### Phase 7: Success
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Rollback Successful!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  📦 Rolled back to: d7e9f1a-20260418-142033
  🐳 Image: :newvelles-web-service.newvelles-web-container.38

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Next steps:
  • Verify the site is working correctly
  • Check application logs for any issues
  • Document why rollback was necessary
```

### Step 4: Verify Rollback Success

**See:** [Verification After Rollback](#verification-after-rollback) section below

---

## Verification After Rollback

### Automated Verification

Health checks run automatically after rollback. If they pass, basic functionality is restored.

### Manual Verification

**1. Visit the site:**
```
https://newvelles.com
```

**Verify:**
- [ ] Homepage loads
- [ ] News groupings appear
- [ ] Search works
- [ ] Sub-groupings expand
- [ ] Articles load
- [ ] No JavaScript errors (F12 console)

**2. Check /health endpoint:**
```bash
curl https://newvelles.com/health | jq
```

Expected:
```json
{
  "status": "healthy",
  "timestamp": "2026-04-19T18:45:23Z",
  "news_groupings": 42,
  "metadata_version": "v1.2.3"
}
```

**3. Verify deployment metadata:**
```bash
cat .deployments/current.json | jq '.version'
# Should show rolled-back version
```

**4. Check AWS Lightsail Console:**
- Navigate to Lightsail → Containers → `newvelles-web-service`
- Verify deployment status is "Active"
- Check container logs for errors

---

## Troubleshooting Rollback Issues

### Issue 1: No Deployment History Found

**Symptom:**
```
❌ No deployment history found
💡 The .deployments/ directory doesn't exist yet
```

**Cause:** No deployments have been made yet, or `.deployments/` was deleted

**Solution:**
- Cannot rollback without deployment history
- Deploy a known-good version manually
- Restore `.deployments/` from backup if available

### Issue 2: Version Not Found

**Symptom:**
```
❌ Version not found: d7e9f1a-20260418-142033
```

**Cause:** Specified version doesn't exist in `.deployments/`

**Solution:**
```bash
# List available versions
./bin/rollback.sh --list

# Use correct version from list
./bin/rollback.sh --version [correct-version]
```

### Issue 3: Container Image Not Found

**Symptom:**
```
❌ Could not find container image for version d7e9f1a-20260418-142033
💡 The deployment may have been cleaned up from Lightsail
```

**Cause:** Lightsail automatically deletes old container images after ~30 days

**Solution:**
- Rollback to a more recent version
- Or redeploy from Git commit:
  ```bash
  git checkout d7e9f1a
  ./bin/deploy.sh
  ```

### Issue 4: Rollback Deployment Fails

**Symptom:**
```
❌ Failed to initiate rollback deployment
```

**Cause:**
- AWS connectivity issues
- IAM permission issues
- Lightsail service in bad state

**Solution:**
1. Check AWS credentials:
   ```bash
   aws sts get-caller-identity
   ```

2. Check Lightsail service status:
   ```bash
   aws lightsail get-container-services \
     --service-name newvelles-web-service \
     --region us-west-2
   ```

3. Check AWS Lightsail Console for error messages

4. If service is in bad state, contact AWS support

### Issue 5: Health Checks Fail After Rollback

**Symptom:**
```
⚠️  Health checks failed after rollback
```

**Possible causes:**
- Previous version also had issues
- Infrastructure problem (not code issue)
- S3 data source unavailable

**Solution:**
1. Check what failed:
   ```bash
   ./bin/health-check.sh --verbose
   ```

2. Check application logs:
   ```bash
   aws lightsail get-container-log \
     --service-name newvelles-web-service \
     --container-name flask
   ```

3. Try rolling back to an earlier version:
   ```bash
   ./bin/rollback.sh --list
   # Select older version
   ./bin/rollback.sh --version [older-version]
   ```

4. If all rollbacks fail, check infrastructure:
   - S3 bucket accessible?
   - Lightsail service healthy?
   - Network connectivity?

### Issue 6: Rollback Timeout

**Symptom:**
```
❌ Rollback timed out after 5 minutes
```

**Solution:**
1. Check AWS Lightsail Console deployment status
2. Wait additional time (deployments can take 5-10 minutes in rare cases)
3. Manually verify deployment:
   ```bash
   aws lightsail get-container-services \
     --service-name newvelles-web-service \
     --region us-west-2 \
     --query "containerServices[0].state"
   ```
4. Run health checks manually:
   ```bash
   ./bin/health-check.sh
   ```

---

## Emergency Procedures

### Scenario 1: Site Completely Down

**Immediate actions:**

1. **Rollback to previous version immediately:**
   ```bash
   ./bin/rollback.sh --previous --force
   ```

2. **Monitor rollback progress** (2-3 minutes)

3. **Verify site is back up:**
   ```bash
   curl https://newvelles.com/health
   ```

4. **Investigate issue later:**
   - Check logs of failed deployment
   - Debug locally
   - Create fix
   - Redeploy when fixed

### Scenario 2: Rollback Fails, Site Still Down

**If rollback fails and site is still down:**

1. **Try rolling back to earlier version:**
   ```bash
   ./bin/rollback.sh --list
   # Select version from 2-3 deployments ago
   ./bin/rollback.sh --version [older-stable-version]
   ```

2. **If still failing, check infrastructure:**
   ```bash
   # Check Lightsail service
   aws lightsail get-container-services \
     --service-name newvelles-web-service \
     --region us-west-2

   # Check for AWS service issues
   # Visit: https://status.aws.amazon.com/
   ```

3. **Manual intervention via AWS Console:**
   - Navigate to Lightsail → Containers
   - Check service status
   - View deployment logs
   - Consider restarting service (if needed)

4. **Last resort - redeploy from known-good commit:**
   ```bash
   # Checkout known-good commit
   git log --oneline
   git checkout [known-good-commit]

   # Deploy
   ./bin/deploy.sh --skip-tests
   ```

### Scenario 3: Data Corruption Issue

**If rollback causes data issues:**

⚠️ **Important:** This deployment doesn't include a database, but if your application does:

1. **Do NOT rollback database** unless you're certain
2. **Rollback code only**
3. **Verify data integrity:**
   ```bash
   # Check /news endpoint for data
   curl https://newvelles.com/news | jq
   ```
4. **If S3 data is corrupted:**
   - Check S3 bucket versioning
   - Restore previous S3 object version if needed

### Scenario 4: Multiple Failed Rollback Attempts

**If you've tried 2-3 rollbacks and all fail:**

1. **Stop attempting rollbacks** (avoid making it worse)

2. **Diagnose root cause:**
   - Infrastructure issue?
   - AWS service outage?
   - Configuration problem?

3. **Check AWS Service Health:**
   - https://status.aws.amazon.com/

4. **Review Lightsail logs:**
   ```bash
   aws lightsail get-container-log \
     --service-name newvelles-web-service \
     --container-name flask \
     --region us-west-2 \
     --page-token [if-needed]
   ```

5. **Contact AWS Support** if infrastructure issue

---

## Post-Rollback Actions

### Immediate Actions (Within 1 Hour)

1. **Verify site stability:**
   - Monitor for errors
   - Check user reports
   - Watch health endpoints

2. **Document the incident:**
   - What broke?
   - What was rolled back?
   - Why did rollback work/not work?

3. **Notify team:**
   - Communicate rollback to team
   - Explain issue
   - Coordinate fix

### Short-term Actions (Within 24 Hours)

4. **Debug the issue:**
   - Reproduce locally
   - Identify root cause
   - Create fix

5. **Test the fix:**
   ```bash
   # Run full test suite
   npm test

   # Test fix locally
   npm run dev
   ```

6. **Deploy fixed version:**
   ```bash
   git commit -m "Fix: [describe fix]"
   ./bin/deploy.sh
   ```

### Long-term Actions (Within 1 Week)

7. **Post-mortem:**
   - What went wrong?
   - How can we prevent this?
   - What can we improve?

8. **Update processes:**
   - Add more tests?
   - Better staging environment?
   - Additional health checks?

9. **Update documentation:**
   - Document specific issue
   - Update troubleshooting guide
   - Share learnings with team

---

## Best Practices

### ✅ Do's

- **Rollback quickly** when site is down
- **Verify after rollback** with manual testing
- **Document rollback reason** for future reference
- **Debug issue locally** before redeploying
- **Test fix thoroughly** before redeploying
- **Communicate with team** about rollback

### ❌ Don'ts

- **Don't panic** - rollback is designed to be safe
- **Don't skip verification** after rollback
- **Don't rollback without confirmation** (unless emergency)
- **Don't redeploy without fixing** the issue
- **Don't delete deployment metadata** (you may need it)
- **Don't rollback database** without careful consideration

---

## Quick Reference

### Rollback Commands

| Command | Description |
|---------|-------------|
| `./bin/rollback.sh --previous` | Rollback to immediately previous version |
| `./bin/rollback.sh --previous --force` | Emergency rollback (skip confirmation) |
| `./bin/rollback.sh` | Interactive rollback with version selection |
| `./bin/rollback.sh --version VERSION` | Rollback to specific version |
| `./bin/rollback.sh --list` | List available versions |

### Verification Commands

| Command | Description |
|---------|-------------|
| `./bin/health-check.sh` | Run health checks |
| `curl https://newvelles.com/health \| jq` | Check health endpoint |
| `cat .deployments/current.json \| jq` | View current deployment |
| `ls -lt .deployments/*.json` | List recent deployments |

### AWS CLI Commands

| Command | Description |
|---------|-------------|
| `aws lightsail get-container-services --service-name newvelles-web-service --region us-west-2` | Check service status |
| `aws lightsail get-container-log --service-name newvelles-web-service --container-name flask` | View logs |
| `aws lightsail get-container-images --service-name newvelles-web-service --region us-west-2` | List images |

---

## Getting Help

### Documentation

- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Deployment procedures
- [DEPLOYMENT_STRATEGY.md](./DEPLOYMENT_STRATEGY.md) - Overall strategy
- [REDESIGN_PLAN.md](../REDESIGN_PLAN.md) - Project roadmap

### AWS Resources

- [AWS Status Dashboard](https://status.aws.amazon.com/)
- [Lightsail Console](https://lightsail.aws.amazon.com/)
- [AWS Support](https://console.aws.amazon.com/support/)

---

**Last Updated:** 2026-04-19
**Maintained by:** Development Team
**Review frequency:** Quarterly or after significant rollback incidents
