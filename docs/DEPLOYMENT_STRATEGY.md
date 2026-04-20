# Newvelles Web - Deployment Strategy

**Version:** 1.0
**Last Updated:** 2026-04-19
**Status:** Active

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Technical Decisions](#technical-decisions)
4. [Deployment Flow](#deployment-flow)
5. [Health Check Strategy](#health-check-strategy)
6. [Rollback Strategy](#rollback-strategy)
7. [Deployment Metadata](#deployment-metadata)
8. [Security Considerations](#security-considerations)
9. [Cost Analysis](#cost-analysis)
10. [Future Improvements](#future-improvements)

---

## Overview

Newvelles Web uses a **manual script-based deployment strategy** designed for:
- **Simplicity**: Single-command deployment via `./bin/deploy.sh`
- **Reliability**: Triple health check verification after deployment
- **Safety**: One-command rollback via `./bin/rollback.sh`
- **Cost-effectiveness**: Zero additional costs (no CI/CD services)
- **Transparency**: Full deployment metadata tracking for audit trail

### Key Characteristics

- **Platform**: AWS Lightsail Container Service (micro instance, $7/month)
- **Deployment Model**: Manual push via local scripts
- **Downtime**: 30-60 seconds acceptable during deployment
- **Testing**: Local test suite execution before deployment
- **Monitoring**: Comprehensive post-deployment health checks

---

## Architecture

### Infrastructure Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         Local Environment                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Developer                                                        │
│     │                                                             │
│     │ ./bin/deploy.sh                                            │
│     ▼                                                             │
│  ┌──────────────┐                                                │
│  │ Vite Build   │ npm run build → dist/                          │
│  └──────┬───────┘                                                │
│         │                                                         │
│         ▼                                                         │
│  ┌──────────────┐                                                │
│  │ Docker Build │ Multi-stage: Node.js + Python                  │
│  └──────┬───────┘                                                │
│         │                                                         │
│         │ docker build -t newvelles-web-container:VERSION        │
│         ▼                                                         │
└─────────────────────────────────────────────────────────────────┘
         │
         │ aws lightsail push-container-image
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AWS Lightsail Container Service               │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ newvelles-web-service (us-west-2)                       │   │
│  │                                                           │   │
│  │  Container: flask                                        │   │
│  │  ├─ Image: :newvelles-web-container.VERSION             │   │
│  │  ├─ Port: 5000 → HTTP                                   │   │
│  │  └─ Healthcheck: /health every 30s                      │   │
│  │                                                           │   │
│  │  Public Endpoint: https://newvelles.com                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
         │
         │ Health checks
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Health Verification                          │
├─────────────────────────────────────────────────────────────────┤
│  1. Lightsail service status (RUNNING/ACTIVE)                   │
│  2. /health endpoint (status, groupings, version)               │
│  3. / homepage (loads correctly)                                │
│  4. /news API (returns data)                                    │
│  5. /metadata API (returns version info)                        │
└─────────────────────────────────────────────────────────────────┘
```

### File Structure

```
newvelles_web/
├── bin/
│   ├── deploy.sh              # Main deployment orchestration
│   ├── health-check.sh        # Triple health check verification
│   └── rollback.sh            # Rollback to previous version
├── .deployments/              # Deployment metadata (gitignored)
│   ├── abc123-20260419.json   # Version metadata
│   ├── def456-20260418.json   # Previous version
│   └── current.json → abc123-20260419.json  # Symlink to current
├── Dockerfile                 # Multi-stage: Vite + Flask
├── .dockerignore             # Optimize build context
├── newvelles_web/
│   └── app.py                # Flask app with /health endpoint
└── docs/
    ├── DEPLOYMENT_STRATEGY.md    # This file
    ├── DEPLOYMENT_GUIDE.md       # Step-by-step deployment
    └── ROLLBACK_GUIDE.md         # Rollback procedures
```

---

## Technical Decisions

### 1. Manual Deployment vs CI/CD

**Decision**: Use manual script-based deployment

**Rationale**:
- **Simplicity**: No CI/CD pipeline complexity
- **Cost**: Zero additional costs (no GitHub Actions minutes, no 3rd party services)
- **Control**: Developer explicitly triggers deployment
- **Transparency**: Local execution shows real-time progress
- **Low deployment frequency**: ~1-2 deploys per week doesn't justify automation overhead

**Trade-offs**:
- ✅ No CI/CD maintenance burden
- ✅ No secrets management in GitHub
- ✅ Zero additional costs
- ❌ Requires manual execution
- ❌ No automatic deployment on merge

### 2. Downtime Acceptance

**Decision**: Accept 30-60 seconds downtime during deployment

**Rationale**:
- **Cost**: Blue-green deployment requires 2x containers ($14/month vs $7/month)
- **Use case**: News aggregator, not mission-critical transactional system
- **Frequency**: Deployments during low-traffic hours minimize impact
- **Simplicity**: Single container deployment is much simpler

**Trade-offs**:
- ✅ 50% cost savings
- ✅ Simpler deployment process
- ✅ Easier to troubleshoot
- ❌ 30-60s downtime per deployment
- ❌ Not suitable for high-availability requirements

### 3. Docker Multi-Stage Build

**Decision**: Use multi-stage Dockerfile (Node.js + Python)

**Rationale**:
- **Separation of concerns**: Frontend (Vite) and backend (Flask) built separately
- **Optimization**: Final image only contains Python runtime + built frontend
- **Reproducibility**: Same build process locally and in Docker
- **Size**: Smaller final image (no Node.js in production image)

**Implementation**:
```dockerfile
# Stage 1: Build Vite frontend
FROM node:18-alpine AS frontend-builder
RUN npm run build  # Outputs to dist/

# Stage 2: Python Flask + built frontend
FROM python:3.11-alpine
COPY --from=frontend-builder /frontend/dist /app/dist
```

### 4. Health Check Strategy

**Decision**: Triple verification (Lightsail + 4 endpoint checks)

**Rationale**:
- **Confidence**: Multiple checks reduce false positives
- **Coverage**: Verifies both infrastructure and application health
- **Retry logic**: 10 attempts × 10s delay handles transient issues
- **Automated**: Integrated into deployment script

**Checks performed**:
1. AWS Lightsail service status (RUNNING/ACTIVE)
2. `/health` endpoint (validates S3 data access)
3. `/` homepage (frontend loads)
4. `/news` API (backend returns data)
5. `/metadata` API (version info available)

### 5. Rollback Mechanism

**Decision**: Metadata-based rollback via Lightsail API

**Rationale**:
- **No extra infrastructure**: Uses existing Lightsail deployment history
- **Audit trail**: Deployment metadata stored in `.deployments/`
- **Fast**: Redeploy previous container image
- **Versioned**: Can rollback to any of last 10 deployments

**Implementation**:
- Store deployment metadata as JSON (version, git sha, timestamp, container image)
- Query Lightsail API for container image references
- Redeploy selected version
- Run health checks after rollback

### 6. Version Tagging

**Decision**: `{git-sha}-{timestamp}` format

**Rationale**:
- **Unique**: Git SHA ensures traceability to code
- **Chronological**: Timestamp enables sorting
- **Debugging**: Easy to identify deployment time
- **Rollback**: Clear version selection

**Example**: `a3f4b2c-20260419-183045`

---

## Deployment Flow

### Full Deployment Process

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Pre-deployment Testing                              │
├─────────────────────────────────────────────────────────────┤
│ npm test                                                     │
│   ├─ 71 unit tests                                          │
│   ├─ 8 integration tests                                    │
│   └─ 27 E2E tests                                           │
│                                                              │
│ Exit on failure unless --skip-tests specified               │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Build Frontend                                      │
├─────────────────────────────────────────────────────────────┤
│ npm run build                                                │
│   └─ Outputs to dist/ (index.html + assets)                │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Version Tagging                                     │
├─────────────────────────────────────────────────────────────┤
│ GIT_SHA=$(git rev-parse --short HEAD)                       │
│ TIMESTAMP=$(date +%Y%m%d-%H%M%S)                            │
│ VERSION="${GIT_SHA}-${TIMESTAMP}"                           │
│                                                              │
│ Example: a3f4b2c-20260419-183045                            │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Docker Build                                        │
├─────────────────────────────────────────────────────────────┤
│ docker build -t newvelles-web-container:$VERSION .          │
│   ├─ Stage 1: Node.js builds Vite frontend                 │
│   └─ Stage 2: Python Flask + dist/                         │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 5: Push to Lightsail                                   │
├─────────────────────────────────────────────────────────────┤
│ aws lightsail push-container-image \                        │
│   --service-name newvelles-web-service \                    │
│   --label newvelles-web-container \                         │
│   --image newvelles-web-container:$VERSION                  │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 6: Create Deployment                                   │
├─────────────────────────────────────────────────────────────┤
│ aws lightsail create-container-service-deployment \         │
│   --containers file://containers-deploy.json \              │
│   --public-endpoint file://public-endpoint.json             │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 7: Wait for Deployment                                 │
├─────────────────────────────────────────────────────────────┤
│ Poll every 10s, up to 30 attempts (5 minutes)              │
│ Wait for: STATUS=RUNNING && DEPLOYMENT=ACTIVE               │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 8: Health Checks                                       │
├─────────────────────────────────────────────────────────────┤
│ ./bin/health-check.sh                                        │
│   ├─ Lightsail service status                              │
│   ├─ /health endpoint                                       │
│   ├─ / homepage                                             │
│   ├─ /news API                                              │
│   └─ /metadata API                                          │
│                                                              │
│ Exit on failure unless --force specified                    │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 9: Save Deployment Metadata                            │
├─────────────────────────────────────────────────────────────┤
│ .deployments/${VERSION}.json                                │
│ {                                                            │
│   "version": "a3f4b2c-20260419-183045",                     │
│   "git_sha": "a3f4b2c...",                                  │
│   "git_branch": "main",                                     │
│   "timestamp": "2026-04-19T18:30:45Z",                      │
│   "container_image": ":newvelles-web-service...",           │
│   "deployment_status": "ACTIVE",                            │
│   "health_check_passed": true,                              │
│   "deployed_by": "user@hostname"                            │
│ }                                                            │
│                                                              │
│ Update symlink: current.json → ${VERSION}.json              │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ ✅ Deployment Complete                                       │
└─────────────────────────────────────────────────────────────┘
```

### Deployment Time Breakdown

| Phase | Duration | Notes |
|-------|----------|-------|
| Tests | 30-60s | Can skip with `--skip-tests` |
| Vite build | 5-10s | Optimized production build |
| Docker build | 60-90s | Multi-stage, cached layers |
| Push to Lightsail | 30-60s | Depends on image size |
| Lightsail deployment | 120-180s | Container start + health checks |
| Health checks | 20-40s | 5 checks with retries |
| **Total** | **~6-8 minutes** | Without skipping tests |

---

## Health Check Strategy

### Triple Verification Approach

The health check strategy verifies deployment success through multiple layers:

#### 1. Infrastructure Layer (Lightsail)

```bash
aws lightsail get-container-services \
  --service-name newvelles-web-service \
  --query "containerServices[0].state"
# Expected: RUNNING

aws lightsail get-container-services \
  --service-name newvelles-web-service \
  --query "containerServices[0].currentDeployment.state"
# Expected: ACTIVE
```

**Purpose**: Verify AWS infrastructure reports healthy state

#### 2. Application Layer (Endpoints)

Each endpoint is checked with **10 retry attempts × 10s delay**:

**`/health` endpoint**:
```json
{
  "status": "healthy",
  "timestamp": "2026-04-19T18:30:45Z",
  "news_groupings": 42,
  "metadata_version": "v1.2.3",
  "metadata_datetime": "Apr 19, 2026 18:15:00 UTC"
}
```
- Validates S3 data access
- Confirms backend can fetch news
- Returns version information

**`/` homepage**:
- HTTP 200 OK
- Confirms frontend serves correctly

**`/news` API**:
```json
[
  {
    "label": "Argentina",
    "tags": ["Argentina", "Messi", "World Cup"],
    "articles": [...]
  }
]
```
- Validates API returns news data
- Confirms backend-frontend integration

**`/metadata` API**:
```json
{
  "datetime": "Apr 19, 2026 18:15:00 UTC",
  "version": "v1.2.3"
}
```
- Confirms metadata service operational

#### 3. Response Validation

- **Status codes**: All must return 200 OK
- **Content parsing**: JSON endpoints validated with `jq`
- **Response time**: Tracked for performance monitoring
- **Retry logic**: Handles transient failures gracefully

### Health Check Failure Handling

If health checks fail:
1. **Deployment script exits with error code 1**
2. **Manual investigation required**
3. **Rollback recommended**: `./bin/rollback.sh --previous`

Override with `--force` flag if needed (not recommended).

---

## Rollback Strategy

### When to Rollback

- Health checks fail after deployment
- Application errors detected in production
- Performance degradation observed
- User-reported issues after deployment

### Rollback Process

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: List Available Versions                             │
├─────────────────────────────────────────────────────────────┤
│ ./bin/rollback.sh --list                                     │
│                                                              │
│ [1] a3f4b2c-20260419-183045 (current)                       │
│     Git: a3f4b2c | Branch: main                             │
│     Deployed: 2026-04-19 18:30:45 UTC                       │
│     By: user@hostname                                        │
│                                                              │
│ [2] d7e9f1a-20260418-142033                                 │
│     Git: d7e9f1a | Branch: main                             │
│     Deployed: 2026-04-18 14:20:33 UTC                       │
│     By: user@hostname                                        │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Select Target Version                               │
├─────────────────────────────────────────────────────────────┤
│ Interactive: Enter version number (1, 2, 3...)              │
│ or                                                           │
│ Automatic: ./bin/rollback.sh --previous                     │
│ or                                                           │
│ Specific: ./bin/rollback.sh --version d7e9f1a-...           │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Load Deployment Metadata                            │
├─────────────────────────────────────────────────────────────┤
│ Read .deployments/${TARGET_VERSION}.json                    │
│   ├─ container_image                                        │
│   ├─ git_sha                                                │
│   ├─ git_branch                                             │
│   └─ timestamp                                              │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Confirmation Prompt                                 │
├─────────────────────────────────────────────────────────────┤
│ Version: d7e9f1a-20260418-142033                            │
│ Git SHA: d7e9f1a                                            │
│                                                              │
│ Continue with rollback? (yes/no):                           │
│                                                              │
│ Skip with --force flag                                      │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 5: Create Rollback Deployment                          │
├─────────────────────────────────────────────────────────────┤
│ aws lightsail create-container-service-deployment \         │
│   --containers file://containers-rollback.json              │
│                                                              │
│ {                                                            │
│   "flask": {                                                │
│     "image": ":newvelles-web-service...42",                 │
│     "ports": { "5000": "HTTP" }                             │
│   }                                                          │
│ }                                                            │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 6: Wait for Rollback Completion                        │
├─────────────────────────────────────────────────────────────┤
│ Poll every 10s, up to 30 attempts (5 minutes)              │
│ Wait for: STATUS=RUNNING && DEPLOYMENT=ACTIVE               │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 7: Health Checks After Rollback                        │
├─────────────────────────────────────────────────────────────┤
│ ./bin/health-check.sh                                        │
│   └─ Verify rollback was successful                        │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 8: Update Current Deployment Marker                    │
├─────────────────────────────────────────────────────────────┤
│ ln -sf ${TARGET_VERSION}.json .deployments/current.json     │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ ✅ Rollback Complete                                         │
└─────────────────────────────────────────────────────────────┘
```

### Rollback Time

- **Total duration**: 2-4 minutes
- **Downtime**: 30-60 seconds

### Rollback Limitations

- Can only rollback to versions in `.deployments/` (last 10 by default)
- Container image must still exist in Lightsail (typically kept for 30 days)
- Database migrations require manual consideration (if applicable)

---

## Deployment Metadata

### Metadata Schema

Each deployment creates a JSON file in `.deployments/`:

```json
{
  "version": "a3f4b2c-20260419-183045",
  "git_sha": "a3f4b2c1d5e7f9a2b4c6d8e0f2a4b6c8d0e2f4a6",
  "git_branch": "main",
  "timestamp": "2026-04-19T18:30:45Z",
  "container_image": ":newvelles-web-service.newvelles-web-container.42",
  "deployment_status": "ACTIVE",
  "health_check_passed": true,
  "deployed_by": "user@hostname"
}
```

### Fields Explained

| Field | Description | Example |
|-------|-------------|---------|
| `version` | Unique version tag | `a3f4b2c-20260419-183045` |
| `git_sha` | Full Git commit SHA | `a3f4b2c1d5e7...` |
| `git_branch` | Git branch deployed from | `main` |
| `timestamp` | ISO 8601 deployment time | `2026-04-19T18:30:45Z` |
| `container_image` | Lightsail image reference | `:newvelles-web-service...42` |
| `deployment_status` | Deployment state | `ACTIVE` |
| `health_check_passed` | Health check result | `true` |
| `deployed_by` | Deployer identity | `user@hostname` |

### Current Deployment Tracking

- **Symlink**: `.deployments/current.json` → latest deployment
- **Purpose**: Quickly identify active version
- **Updated**: After successful deployment and rollback

### Cleanup Policy

- Keep last **10 deployments** in `.deployments/`
- Older metadata files can be manually deleted
- Lightsail automatically cleans up old container images after ~30 days

---

## Security Considerations

### 1. AWS Credentials

- **Storage**: Use AWS CLI configuration (`~/.aws/credentials`)
- **Permissions**: IAM user needs:
  - `lightsail:PushContainerImage`
  - `lightsail:CreateContainerServiceDeployment`
  - `lightsail:GetContainerServices`
  - `lightsail:GetContainerImages`
  - `lightsail:GetContainerServiceDeployments`
- **Best practice**: Use IAM role with minimum required permissions

### 2. Secrets Management

- **Environment variables**: Pass secrets via Lightsail environment config
- **Never commit**: `.env`, credentials, API keys
- **Container runtime**: Secrets injected at container startup

### 3. Docker Image Security

- **Base images**: Official Alpine Linux images (minimal attack surface)
- **Updates**: Regularly update base images
- **Scanning**: Consider image vulnerability scanning (future)

### 4. HTTPS/TLS

- **Lightsail**: Automatic HTTPS with AWS-managed certificates
- **Domain**: Custom domain configured via Lightsail DNS

### 5. Health Endpoint Exposure

- **Public access**: `/health` is publicly accessible (by design)
- **Information disclosure**: Only exposes aggregate stats (news count, version)
- **No sensitive data**: Does not expose credentials or internal IPs

---

## Cost Analysis

### Current Costs

| Component | Cost/Month | Notes |
|-----------|------------|-------|
| Lightsail Container (micro) | $7.00 | 512MB RAM, 0.25 vCPU |
| Data transfer | $0.00 | First 500GB free |
| **Total** | **$7.00** | |

### Cost Comparison with Alternatives

#### Blue-Green Deployment (Zero Downtime)
- **Requires**: 2× containers
- **Cost**: $14/month (100% increase)
- **Benefit**: Zero downtime
- **Decision**: Not justified for current use case

#### CI/CD with GitHub Actions
- **Free tier**: 2,000 minutes/month
- **Usage**: ~5 minutes per deployment × 8 deploys = 40 minutes/month
- **Cost**: $0 (within free tier)
- **However**: Adds complexity, secret management, and maintenance burden
- **Decision**: Avoided for simplicity

#### Alternative Hosting (Comparison)

| Platform | Cost/Month | Pros | Cons |
|----------|------------|------|------|
| AWS EC2 t3.micro | $7.50 | More control | Manual container management |
| Heroku Hobby | $7.00 | Easy deployment | Limited customization |
| DigitalOcean App Platform | $5.00 | Simple | Less AWS integration |
| **Lightsail Container** | **$7.00** | **AWS integration, managed** | **Limited scaling** |

---

## Future Improvements

### Short-term (1-3 months)

1. **Automated Cleanup Script**
   - Delete deployment metadata older than 10 versions
   - Archive to S3 for long-term audit trail

2. **Deployment Notifications**
   - Send email/Slack notification on deployment success/failure
   - Integration with existing notification systems

3. **Performance Monitoring**
   - Add Lighthouse CI for performance regression detection
   - Track deployment success rate and downtime duration

### Medium-term (3-6 months)

4. **Blue-Green Deployment**
   - If downtime becomes problematic
   - Requires 2× containers ($14/month)
   - Zero-downtime deployments

5. **Automated Testing in Staging**
   - Create staging Lightsail environment ($7/month)
   - Run E2E tests against staging before production deployment

6. **Container Image Scanning**
   - Integrate Trivy or similar for vulnerability scanning
   - Block deployment if critical vulnerabilities found

### Long-term (6-12 months)

7. **Migration to ECS/Fargate**
   - If scaling requirements increase
   - More flexible container orchestration
   - Higher cost (~$15-30/month)

8. **Infrastructure as Code**
   - Terraform for Lightsail configuration
   - Version-controlled infrastructure
   - Reproducible environments

9. **CI/CD Pipeline**
   - If deployment frequency increases significantly (>3/week)
   - GitHub Actions for automated testing + deployment
   - Requires secret management and maintenance

---

## Conclusion

This deployment strategy prioritizes **simplicity, cost-effectiveness, and reliability** for a low-traffic news aggregation application. The manual script-based approach provides full control, zero additional costs, and transparent execution while maintaining production-ready health checks and rollback capabilities.

As the application scales or deployment frequency increases, the strategy can evolve to incorporate CI/CD automation, blue-green deployments, or more sophisticated monitoring while maintaining the core principle of reliable deployments with minimal complexity.

---

**Document maintained by**: Development Team
**Review frequency**: Quarterly or after major changes
**Related documents**:
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Step-by-step deployment instructions
- [ROLLBACK_GUIDE.md](./ROLLBACK_GUIDE.md) - Rollback procedures and troubleshooting
- [REDESIGN_PLAN.md](../REDESIGN_PLAN.md) - Overall project roadmap
