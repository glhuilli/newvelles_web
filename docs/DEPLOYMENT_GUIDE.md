# Newvelles Web - Deployment Guide

**Version:** 1.0
**Last Updated:** 2026-04-19

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Standard Deployment](#standard-deployment)
4. [Deployment Options](#deployment-options)
5. [Verifying Deployment](#verifying-deployment)
6. [Troubleshooting](#troubleshooting)
7. [Post-Deployment](#post-deployment)
8. [Common Scenarios](#common-scenarios)

---

## Prerequisites

### Required Tools

Before deploying, ensure you have the following tools installed:

| Tool | Version | Installation | Verification |
|------|---------|--------------|--------------|
| **Docker** | 20.10+ | [docker.com](https://docker.com) | `docker --version` |
| **AWS CLI** | 2.x | [AWS Docs](https://aws.amazon.com/cli/) | `aws --version` |
| **Node.js** | 18.x | [nodejs.org](https://nodejs.org) | `node --version` |
| **npm** | 9.x+ | (comes with Node.js) | `npm --version` |
| **jq** | 1.6+ | `brew install jq` (macOS) | `jq --version` |
| **Git** | 2.x+ | [git-scm.com](https://git-scm.com) | `git --version` |

### AWS Configuration

**1. Configure AWS CLI credentials:**

```bash
aws configure
```

Provide:
- AWS Access Key ID
- AWS Secret Access Key
- Default region: `us-west-2`
- Default output format: `json`

**2. Verify Lightsail access:**

```bash
aws lightsail get-container-services \
  --service-name newvelles-web-service \
  --region us-west-2
```

Should return service details without errors.

### IAM Permissions Required

Your AWS IAM user needs these permissions:
- `lightsail:PushContainerImage`
- `lightsail:CreateContainerServiceDeployment`
- `lightsail:GetContainerServices`
- `lightsail:GetContainerImages`
- `lightsail:GetContainerServiceDeployments`

### Local Dependencies

**Install Node.js dependencies:**

```bash
npm install
```

**Verify Python setup:**

```bash
python3 --version  # Should be 3.8+
pip3 --version
```

---

## Pre-Deployment Checklist

Before deploying, verify:

- [ ] All code changes committed to Git
- [ ] Local tests passing (`npm test`)
- [ ] Docker daemon running
- [ ] AWS CLI configured
- [ ] No uncommitted changes in critical files (`git status`)
- [ ] Deployment scripts executable:
  ```bash
  ls -l bin/deploy.sh bin/health-check.sh bin/rollback.sh
  # Should show -rwxr-xr-x (executable)
  ```

### Making Scripts Executable (if needed)

```bash
chmod +x bin/deploy.sh
chmod +x bin/health-check.sh
chmod +x bin/rollback.sh
```

---

## Standard Deployment

### Quick Start

For a standard deployment with all checks:

```bash
./bin/deploy.sh
```

This will:
1. ✅ Run all tests (unit + integration + E2E)
2. 🏗️  Build Vite frontend
3. 📦 Generate version tag from git
4. 🐳 Build Docker image
5. ☁️  Push to AWS Lightsail
6. 🚀 Deploy to production
7. ⏳ Wait for deployment completion
8. 🏥 Run comprehensive health checks
9. 💾 Save deployment metadata

**Expected duration:** 6-8 minutes

---

## Deployment Options

### Option 1: Skip Tests (Faster Deployment)

If tests already passed locally:

```bash
./bin/deploy.sh --skip-tests
```

**Duration:** ~4-5 minutes
**Use case:** Quick deployments when tests verified separately

### Option 2: Custom Version Tag

For special releases or hotfixes:

```bash
./bin/deploy.sh --tag v1.5.0-hotfix
```

**Use case:** Marking specific versions for tracking

### Option 3: Force Deployment (Skip Health Check Failures)

Deploy even if health checks fail (not recommended):

```bash
./bin/deploy.sh --force
```

**⚠️ Warning:** Only use if you're certain health check failures are false positives

### Option 4: Combined Options

```bash
./bin/deploy.sh --skip-tests --tag v2.0.0
```

---

## Step-by-Step Deployment (Detailed)

### Step 1: Run Tests

```bash
npm test
```

**Expected output:**
```
✓ tests/unit/searchFilter.test.js (71 tests)
✓ tests/integration/api.test.js (8 tests)
✓ tests/e2e/accessibility.spec.js (27 tests)

Test Files  3 passed (3)
     Tests  106 passed (106)
```

**If tests fail:**
- Fix failing tests before deploying
- Or skip tests with `--skip-tests` (not recommended)

### Step 2: Commit Changes

```bash
git status
# Verify no untracked critical files

git add .
git commit -m "Feature: Add new functionality"
```

**Note:** Deployment version tag is based on latest commit SHA

### Step 3: Execute Deployment Script

```bash
./bin/deploy.sh
```

**Monitor output for each phase:**

#### Phase 1: Testing
```
🧪 Running tests...
✅ All tests passed
```

#### Phase 2: Frontend Build
```
🏗️  Building Vite frontend...
✅ Frontend build successful
```

#### Phase 3: Version Tagging
```
📦 Generated version tag: a3f4b2c-20260419-183045
```

#### Phase 4: Docker Build
```
🐳 Building Docker image...
   Image: newvelles-web-container:a3f4b2c-20260419-183045
[+] Building 87.3s (15/15) FINISHED
✅ Docker image built successfully
```

#### Phase 5: Push to Lightsail
```
☁️  Pushing image to Lightsail...
   Service: newvelles-web-service
   Region: us-west-2
✅ Image pushed to Lightsail
```

#### Phase 6: Deployment
```
🚀 Deploying to Lightsail...
✅ Deployment initiated
```

#### Phase 7: Wait for Completion
```
⏳ Waiting for deployment to complete...
   This may take 2-5 minutes. Please wait...

   Status: UPDATING | Deployment: ACTIVATING (attempt 1/30)
   Status: UPDATING | Deployment: ACTIVATING (attempt 2/30)
   ...
   Status: RUNNING | Deployment: ACTIVE (attempt 8/30)
✅ Deployment complete (status: RUNNING)
```

#### Phase 8: Health Checks
```
🏥 Running comprehensive health checks...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏥 Health Check Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Target: https://newvelles.com
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Lightsail Service: RUNNING (Deployment: ACTIVE)

✓ Health endpoint: 200 OK
   Status: healthy
   Groupings: 42
   Version: v1.2.3

✓ Homepage: 200 OK

✓ News API: 200 OK (42 groupings)

✓ Metadata API: 200 OK

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 All health checks PASSED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### Phase 9: Success
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 Deployment Successful!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  📦 Version:     a3f4b2c-20260419-183045
  🐳 Image:       :newvelles-web-service.newvelles-web-container.42
  🌲 Branch:      main
  📅 Deployed:    2026-04-19T18:30:45Z
  👤 Deployed by: user@hostname

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Next steps:
  • Visit your site to verify the deployment
  • Check logs in AWS Lightsail Console if needed
  • Run ./bin/rollback.sh if you need to rollback
```

---

## Verifying Deployment

### Manual Verification

**1. Visit the site:**
```
https://newvelles.com
```

**2. Check the /health endpoint:**
```bash
curl https://newvelles.com/health | jq
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-04-19T18:30:45Z",
  "news_groupings": 42,
  "metadata_version": "v1.2.3",
  "metadata_datetime": "Apr 19, 2026 18:15:00 UTC"
}
```

**3. Verify news data loads:**
```bash
curl https://newvelles.com/news | jq '. | length'
# Should return number of groupings (e.g., 42)
```

**4. Check deployment metadata:**
```bash
cat .deployments/current.json | jq
```

### AWS Console Verification

**Navigate to:**
1. AWS Console → Lightsail
2. Containers → `newvelles-web-service`
3. Deployments tab
4. Verify latest deployment is "Active"

---

## Troubleshooting

### Issue 1: Tests Fail

**Symptom:**
```
❌ Tests failed
```

**Solutions:**
1. Fix failing tests and redeploy
2. Skip tests temporarily: `./bin/deploy.sh --skip-tests`
3. Check test logs for specific failures

### Issue 2: Docker Build Fails

**Symptom:**
```
❌ Docker build failed
```

**Common causes:**
- Docker daemon not running
- Insufficient disk space
- Dockerfile syntax error

**Solutions:**
```bash
# Restart Docker daemon
# macOS: Restart Docker Desktop

# Check disk space
df -h

# Clean up old Docker images
docker system prune -a
```

### Issue 3: Lightsail Push Fails

**Symptom:**
```
❌ Failed to push image to Lightsail
```

**Common causes:**
- AWS credentials not configured
- IAM permissions missing
- Network connectivity issues

**Solutions:**
```bash
# Verify AWS credentials
aws sts get-caller-identity

# Test Lightsail access
aws lightsail get-container-services \
  --service-name newvelles-web-service \
  --region us-west-2

# Check IAM permissions in AWS Console
```

### Issue 4: Deployment Timeout

**Symptom:**
```
❌ Deployment timed out after 5 minutes
```

**Solutions:**
1. Check AWS Lightsail Console for error messages
2. Verify container image size isn't too large
3. Check Lightsail service logs in AWS Console
4. Manually verify deployment status:
   ```bash
   aws lightsail get-container-services \
     --service-name newvelles-web-service \
     --region us-west-2 \
     --query "containerServices[0].state"
   ```

### Issue 5: Health Checks Fail

**Symptom:**
```
❌ Some health checks FAILED
```

**Solutions:**
1. **Identify which check failed** (Lightsail status, /health, /, /news, /metadata)
2. **Check application logs:**
   ```bash
   aws lightsail get-container-log \
     --service-name newvelles-web-service \
     --container-name flask
   ```
3. **Test endpoint manually:**
   ```bash
   curl -v https://newvelles.com/health
   ```
4. **Rollback if necessary:**
   ```bash
   ./bin/rollback.sh --previous
   ```

### Issue 6: Frontend Not Loading

**Symptom:**
- Site loads but frontend is blank
- 404 errors for static assets

**Solutions:**
1. Verify Vite build completed: check `dist/` directory locally
2. Check browser console for errors
3. Verify app.py serves from `dist/`:
   ```python
   app = Flask(__name__, static_folder='dist', static_url_path='')
   ```
4. Rebuild and redeploy

---

## Post-Deployment

### 1. Verify in Browser

- [ ] Visit https://newvelles.com
- [ ] Search functionality works
- [ ] News groupings load correctly
- [ ] Articles expand properly
- [ ] No console errors (F12 DevTools)

### 2. Monitor Initial Traffic

Watch for:
- Error rates in logs
- Performance issues
- User-reported bugs

### 3. Document Changes

Update:
- `CHANGELOG.md` (if applicable)
- Deployment log/spreadsheet
- Team communication channels

### 4. Cleanup (Optional)

Remove old deployment metadata (keep last 10):
```bash
cd .deployments
ls -t *.json | tail -n +11 | xargs rm -f
```

---

## Common Scenarios

### Scenario 1: Hotfix Deployment

**Situation:** Critical bug in production needs immediate fix

**Steps:**
1. Create hotfix branch:
   ```bash
   git checkout -b hotfix/fix-critical-bug
   ```
2. Make fix and commit:
   ```bash
   git add .
   git commit -m "Hotfix: Fix critical bug"
   ```
3. Deploy with custom tag:
   ```bash
   ./bin/deploy.sh --tag hotfix-$(date +%Y%m%d-%H%M%S)
   ```
4. Merge hotfix to main after verification

**Duration:** 4-5 minutes (skip tests for speed)

### Scenario 2: New Feature Deployment

**Situation:** Deploying new feature after development

**Steps:**
1. Ensure all tests pass:
   ```bash
   npm test
   ```
2. Commit feature:
   ```bash
   git add .
   git commit -m "Feature: Add new functionality"
   ```
3. Standard deployment:
   ```bash
   ./bin/deploy.sh
   ```
4. Verify feature works in production

**Duration:** 6-8 minutes (full testing)

### Scenario 3: Rollback After Bad Deployment

**Situation:** Deployed version has issues

**Steps:**
1. Identify issue via monitoring/user reports
2. Rollback to previous version:
   ```bash
   ./bin/rollback.sh --previous
   ```
3. Verify rollback successful
4. Debug issue locally
5. Redeploy fixed version

**See:** [ROLLBACK_GUIDE.md](./ROLLBACK_GUIDE.md) for detailed rollback procedures

### Scenario 4: Off-Hours Deployment

**Situation:** Deploying during low-traffic hours

**Steps:**
1. Schedule deployment time (e.g., 2 AM UTC)
2. Run deployment:
   ```bash
   ./bin/deploy.sh
   ```
3. Monitor health checks
4. Set up monitoring alerts for issues

**Benefit:** Minimal user impact from 30-60s downtime

### Scenario 5: First-Time Deployment

**Situation:** Deploying to Lightsail for the first time

**Prerequisites:**
1. Create Lightsail Container Service (AWS Console)
2. Configure domain/DNS (if applicable)
3. Set up environment variables

**Steps:**
1. Verify prerequisites checklist
2. Run deployment:
   ```bash
   ./bin/deploy.sh
   ```
3. Configure custom domain (if needed):
   - AWS Console → Lightsail → Containers
   - Custom domains tab → Add domain
4. Test all endpoints

---

## Best Practices

### ✅ Do's

- Always run tests before deploying
- Commit all changes before deployment
- Monitor deployment progress
- Verify health checks pass
- Keep deployment metadata for audit trail
- Deploy during low-traffic hours when possible
- Have rollback plan ready

### ❌ Don'ts

- Don't deploy uncommitted changes
- Don't skip health checks (unless emergency)
- Don't deploy on Friday afternoons (weekend coverage)
- Don't force deployment without understanding health check failures
- Don't delete deployment metadata from `.deployments/`
- Don't deploy multiple times simultaneously

---

## Quick Reference

### Deployment Commands

| Command | Description |
|---------|-------------|
| `./bin/deploy.sh` | Standard deployment with tests |
| `./bin/deploy.sh --skip-tests` | Skip tests, faster deployment |
| `./bin/deploy.sh --tag v1.0.0` | Deploy with custom version tag |
| `./bin/deploy.sh --force` | Deploy even if health checks fail |
| `./bin/health-check.sh` | Run health checks manually |
| `./bin/rollback.sh` | Interactive rollback |
| `./bin/rollback.sh --previous` | Rollback to previous version |
| `./bin/rollback.sh --list` | List available versions |

### Health Check Endpoints

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `/health` | Application health | `{"status": "healthy", ...}` |
| `/` | Homepage | HTML (200 OK) |
| `/news` | News data API | JSON array of groupings |
| `/metadata` | Metadata API | `{"datetime": "...", "version": "..."}` |

### AWS CLI Commands

| Command | Description |
|---------|-------------|
| `aws lightsail get-container-services --service-name newvelles-web-service --region us-west-2` | Check service status |
| `aws lightsail get-container-log --service-name newvelles-web-service --container-name flask` | View container logs |
| `aws lightsail get-container-images --service-name newvelles-web-service --region us-west-2` | List container images |

---

## Getting Help

### Documentation

- [DEPLOYMENT_STRATEGY.md](./DEPLOYMENT_STRATEGY.md) - Overall strategy and architecture
- [ROLLBACK_GUIDE.md](./ROLLBACK_GUIDE.md) - Rollback procedures
- [REDESIGN_PLAN.md](../REDESIGN_PLAN.md) - Project roadmap

### AWS Resources

- [AWS Lightsail Documentation](https://docs.aws.amazon.com/lightsail/)
- [Lightsail Container Service Guide](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-container-services.html)

### Support

- Check AWS Lightsail Console for logs and status
- Review deployment script output for error messages
- Consult [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) (if available)

---

**Last Updated:** 2026-04-19
**Maintained by:** Development Team
**Review frequency:** Quarterly or after deployment process changes
