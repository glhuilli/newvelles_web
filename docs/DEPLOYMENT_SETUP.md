# Deployment Setup Guide

Complete guide for setting up AWS Lightsail deployment for Newvelles Web.

## Prerequisites

### 1. Required Tools

Install these tools before attempting deployment:

```bash
# Homebrew (macOS)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# AWS CLI
brew install awscli

# Docker Desktop
# Download from: https://www.docker.com/products/docker-desktop

# Node.js (v18+)
brew install node@18

# Python 3.11+
brew install python@3.11
```

### 2. AWS Lightsail Control Plugin (lightsailctl)

**CRITICAL**: This plugin is required to push Docker images to Lightsail.

```bash
# Install lightsailctl to ~/.local/bin
mkdir -p ~/.local/bin
curl -s "https://s3.us-west-2.amazonaws.com/lightsailctl/latest/darwin-amd64/lightsailctl" -o ~/.local/bin/lightsailctl
chmod +x ~/.local/bin/lightsailctl

# Add to PATH (add to ~/.bashrc or ~/.zshrc)
export PATH="$HOME/.local/bin:$PATH"

# Verify installation
lightsailctl --version  # Should show v1.0.7 or later
```

### 3. AWS Credentials

Configure AWS credentials with Lightsail permissions:

```bash
aws configure
# Enter:
#   AWS Access Key ID: [your-key]
#   AWS Secret Access Key: [your-secret]
#   Default region: us-west-2
#   Default output format: json

# Verify credentials
aws sts get-caller-identity
# Should show Account: 617641631577
```

### 4. Required IAM Permissions

Your AWS user needs these permissions:
- `lightsail:*` (full Lightsail access)
- ECR permissions for image push:
  - `ecr:GetAuthorizationToken`
  - `ecr:BatchCheckLayerAvailability`
  - `ecr:GetDownloadUrlForLayer`
  - `ecr:BatchGetImage`
  - `ecr:PutImage`
  - `ecr:InitiateLayerUpload`
  - `ecr:UploadLayerPart`
  - `ecr:CompleteLayerUpload`

### 5. Docker Setup

```bash
# Start Docker Desktop (GUI application)
# Wait for Docker to fully start, then verify:
docker info
# Should show server info without errors
```

### 6. Node Dependencies

```bash
cd /path/to/newvelles_web
npm install
```

## Quick Setup Script

Run this to verify all prerequisites:

```bash
./bin/check-deployment-setup.sh
```

This will check:
- ✓ AWS CLI installed
- ✓ AWS credentials configured
- ✓ Docker running
- ✓ lightsailctl installed
- ✓ Node.js and npm available
- ✓ Lightsail service accessible

## Common Issues & Solutions

### Issue 1: lightsailctl Not Found

**Error**: `The Lightsail Control (lightsailctl) plugin was not found`

**Solution**:
```bash
# Install lightsailctl
mkdir -p ~/.local/bin
curl -s "https://s3.us-west-2.amazonaws.com/lightsailctl/latest/darwin-amd64/lightsailctl" -o ~/.local/bin/lightsailctl
chmod +x ~/.local/bin/lightsailctl

# Add to PATH permanently
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc  # or ~/.bashrc
source ~/.zshrc  # Reload shell config
```

### Issue 2: 403 Forbidden When Pushing Images

**Error**: `unexpected status from HEAD request to ECR: 403 Forbidden`

**Solution**: The Lightsail service needs to be refreshed (especially if last deployment was years ago):

```bash
aws lightsail update-container-service \
  --service-name newvelles-web-service \
  --region us-west-2 \
  --power micro \
  --scale 1

# Wait for service to complete updating (2-3 minutes)
# Then retry pushing the image
```

### Issue 3: Port Mismatch

**Error**: Health checks fail, container unreachable

**Verify**: Flask app runs on port 5000 (not 5001 or any other port)

Check `newvelles_web/app.py`:
```python
def main():
    app.run(host='0.0.0.0', port=5000, debug=True)  # Must be 5000
```

All deployment configs expect port 5000:
- `Dockerfile` - `EXPOSE 5000/tcp`
- `public-endpoint.json` - `"containerPort": 5000`
- Health check - `http://localhost:5000/health`

### Issue 4: Docker Daemon Not Running

**Error**: `Cannot connect to the Docker daemon`

**Solution**: Start Docker Desktop application and wait for it to fully initialize.

### Issue 5: Deployment Already in Progress

**Error**: `Sorry, deployment X is in progress for service "newvelles-web-service"`

**Solution**: Wait for the current deployment to complete (2-5 minutes):

```bash
watch -n 10 'aws lightsail get-container-services --service-name newvelles-web-service --region us-west-2 --query "containerServices[0].state" --output text'
# Wait for status to change to "RUNNING"
```

## Deployment Workflow

### Standard Deployment

```bash
# Full deployment with tests
./bin/deploy.sh

# Skip tests (faster for minor updates)
./bin/deploy.sh --skip-tests

# Custom version tag
./bin/deploy.sh --tag v1.5.0

# Force deployment even if health checks fail
./bin/deploy.sh --force
```

### Manual Step-by-Step Deployment

If the automated script fails, you can deploy manually:

```bash
# 1. Build frontend
npm run build

# 2. Build Docker image
docker build --platform linux/amd64 -t newvelles-web-container:latest .

# 3. Push to Lightsail (requires lightsailctl in PATH)
export PATH="$HOME/.local/bin:$PATH"
aws lightsail push-container-image \
  --region us-west-2 \
  --service-name newvelles-web-service \
  --label newvelles-web-container \
  --image newvelles-web-container:latest

# 4. Note the image reference from output (e.g., :newvelles-web-service.newvelles-web-container.16)

# 5. Create deployment config
cat > containers-deploy.json <<EOF
{
  "flask": {
    "image": ":newvelles-web-service.newvelles-web-container.16",
    "ports": {
      "5000": "HTTP"
    }
  }
}
EOF

# 6. Deploy
aws lightsail create-container-service-deployment \
  --region us-west-2 \
  --service-name newvelles-web-service \
  --containers file://containers-deploy.json \
  --public-endpoint file://public-endpoint.json

# 7. Wait for deployment (2-5 minutes)
./bin/health-check.sh
```

## Health Check

After deployment, verify the service is healthy:

```bash
# Run automated health checks
./bin/health-check.sh

# Or manually
curl https://newvelles.com/health
curl https://newvelles.com/news | jq 'length'  # Should show article count
```

Expected health response:
```json
{
  "status": "healthy",
  "timestamp": "2026-04-20T11:16:43.325178Z",
  "news_groupings": 187,
  "metadata_version": "0.2.1",
  "metadata_datetime": "2026-04-20T00:00:45-07:00"
}
```

## Rollback

If deployment fails or introduces issues:

```bash
./bin/rollback.sh
```

This will:
1. List recent deployments
2. Allow you to select which version to rollback to
3. Deploy the selected version
4. Run health checks

## Service Information

- **Service Name**: `newvelles-web-service`
- **Region**: `us-west-2`
- **Power**: `micro` (512 MB RAM, 0.25 vCPUs)
- **Scale**: 1 container
- **Lightsail URL**: https://newvelles-web-service.nbof67v3f3gck.us-west-2.cs.amazonlightsail.com/
- **Custom Domain**: https://newvelles.com/ (via `newvelles-certificates`)

## Environment Variables

The application uses these environment variables (set via `newvelles_web/config/newvelles-web.ini`):

```ini
[PARAMS]
local=False
```

For local development, set `local=True` to use local test data instead of S3.

## Troubleshooting

### Check Container Logs

```bash
# Via AWS Console
# 1. Go to https://lightsail.aws.amazon.com/
# 2. Click "Containers"
# 3. Click "newvelles-web-service"
# 4. Click "Deployments" tab
# 5. View logs for the "flask" container

# Via AWS CLI
aws lightsail get-container-log \
  --service-name newvelles-web-service \
  --container-name flask \
  --region us-west-2
```

### Test Locally First

Before deploying, test the Docker container locally:

```bash
# Build
docker build --platform linux/amd64 -t newvelles-test .

# Run locally
docker run -p 5000:5000 newvelles-test

# Test in another terminal
curl http://localhost:5000/health
curl http://localhost:5000/news
```

### Verify Image Push

```bash
# List images in Lightsail
aws lightsail get-container-images \
  --service-name newvelles-web-service \
  --region us-west-2 \
  --query "containerImages[0:5].[image,createdAt]" \
  --output table
```

## Security Notes

- Never commit AWS credentials to git
- `.env` files are excluded via `.dockerignore`
- Container logs may contain sensitive info - review before sharing
- Health endpoint is public but doesn't expose sensitive data

## Next Steps After First Setup

1. ✅ Verify all prerequisites installed
2. ✅ Run `./bin/check-deployment-setup.sh`
3. ✅ Run `npm test` to ensure all tests pass
4. ✅ Deploy: `./bin/deploy.sh`
5. ✅ Verify: Visit https://newvelles.com/
6. 📝 Document any issues encountered (update this file)

## Getting Help

- AWS Lightsail Docs: https://lightsail.aws.amazon.com/ls/docs/
- Docker Docs: https://docs.docker.com/
- Report issues: https://github.com/glhuilli/newvelles_web/issues

---

**Last Updated**: 2026-04-20
**Lightsail Service Created**: 2021-06-03
**Current Deployment Version**: 15
