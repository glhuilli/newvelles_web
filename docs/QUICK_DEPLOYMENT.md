# Quick Deployment Guide

Fast reference for deploying Newvelles Web to AWS Lightsail.

## Prerequisites (One-Time Setup)

### 1. Install lightsailctl

```bash
mkdir -p ~/.local/bin
curl -s "https://s3.us-west-2.amazonaws.com/lightsailctl/latest/darwin-amd64/lightsailctl" -o ~/.local/bin/lightsailctl
chmod +x ~/.local/bin/lightsailctl
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### 2. Verify Setup

```bash
./bin/check-deployment-setup.sh
```

If any checks fail, see [DEPLOYMENT_SETUP.md](./DEPLOYMENT_SETUP.md) for detailed instructions.

## Deploy

### Standard Deployment

```bash
./bin/deploy.sh
```

This will:
1. ✓ Run 106 tests (~7 seconds)
2. ✓ Build Vite frontend (~1 minute)
3. ✓ Build Docker image (~30 seconds)
4. ✓ Push to Lightsail (~1 minute)
5. ✓ Deploy and wait for active (~3 minutes)
6. ✓ Run health checks

**Total time**: ~6 minutes

### Fast Deployment (Skip Tests)

```bash
./bin/deploy.sh --skip-tests
```

**Total time**: ~5 minutes

### Custom Version Tag

```bash
./bin/deploy.sh --tag v1.5.0
```

## Common Issues

### "lightsailctl plugin not found"

```bash
# Install it
mkdir -p ~/.local/bin
curl -s "https://s3.us-west-2.amazonaws.com/lightsailctl/latest/darwin-amd64/lightsailctl" -o ~/.local/bin/lightsailctl
chmod +x ~/.local/bin/lightsailctl
export PATH="$HOME/.local/bin:$PATH"
```

### "403 Forbidden" when pushing image

Service needs credential refresh (especially after long periods of no deployment):

```bash
aws lightsail update-container-service \
  --service-name newvelles-web-service \
  --region us-west-2 \
  --power micro \
  --scale 1

# Wait 2-3 minutes, then retry deployment
```

### "Deployment already in progress"

Wait for current deployment to finish:

```bash
# Check status every 10 seconds
watch -n 10 'aws lightsail get-container-services --service-name newvelles-web-service --region us-west-2 --query "containerServices[0].state" --output text'
```

### "Docker daemon not running"

Start Docker Desktop application and wait for it to fully initialize.

## Verify Deployment

### Automated

```bash
./bin/health-check.sh
```

### Manual

```bash
# Health endpoint
curl https://newvelles.com/health

# News API
curl https://newvelles.com/news | jq 'length'

# Visit in browser
open https://newvelles.com/
```

## Rollback

If deployment has issues:

```bash
./bin/rollback.sh
```

Select a previous version from the list to rollback to.

## Service Info

- **Service**: newvelles-web-service
- **Region**: us-west-2
- **URL**: https://newvelles.com/
- **Current Version**: 15
- **Container**: Flask on port 5000

## Need Help?

- **Detailed Guide**: [DEPLOYMENT_SETUP.md](./DEPLOYMENT_SETUP.md)
- **Dev Notes**: [../CLAUDE.md](../CLAUDE.md) (Phase 4 section)
- **AWS Console**: https://lightsail.aws.amazon.com/
