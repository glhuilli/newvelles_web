#!/bin/bash
#
# Newvelles Web Deployment Script
# ================================
# Orchestrates the entire deployment process to AWS Lightsail Container Service
#
# Usage:
#   ./bin/deploy.sh                    # Standard deployment with tests
#   ./bin/deploy.sh --skip-tests       # Skip local test execution
#   ./bin/deploy.sh --tag v1.5.0       # Custom version tag
#   ./bin/deploy.sh --force            # Deploy even if health checks fail
#

set -e  # Exit immediately if a command exits with non-zero status
set -u  # Treat unset variables as an error

# Configuration
SERVICE_NAME="newvelles-web-service"
REGION="us-west-2"
CONTAINER_NAME="newvelles-web-container"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default options
SKIP_TESTS=false
VERSION_TAG=""
FORCE=false

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    --tag)
      VERSION_TAG="$2"
      shift 2
      ;;
    --force)
      FORCE=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --skip-tests    Skip running npm test before deployment"
      echo "  --tag VERSION   Use custom version tag (default: git-sha-timestamp)"
      echo "  --force         Deploy even if health checks fail"
      echo "  --help, -h      Show this help message"
      exit 0
      ;;
    *)
      echo -e "${RED}❌ Unknown option: $1${NC}"
      echo "Run '$0 --help' for usage information"
      exit 1
      ;;
  esac
done

# Ensure lightsailctl is in PATH (required for image push)
export PATH="$HOME/.local/bin:$PATH"

# Navigate to project root
cd "$PROJECT_ROOT"

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🚀 Newvelles Web Deployment${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Step 1: Run tests (unless skipped)
if [ "$SKIP_TESTS" = false ]; then
  echo -e "${BLUE}🧪 Running tests...${NC}"
  if npm test; then
    echo -e "${GREEN}✅ All tests passed${NC}"
  else
    echo -e "${RED}❌ Tests failed${NC}"
    exit 1
  fi
  echo ""
else
  echo -e "${YELLOW}⚠️  Skipping tests (--skip-tests specified)${NC}"
  echo ""
fi

# Step 2: Build Vite frontend
echo -e "${BLUE}🏗️  Building Vite frontend...${NC}"
if npm run build; then
  echo -e "${GREEN}✅ Frontend build successful${NC}"
else
  echo -e "${RED}❌ Frontend build failed${NC}"
  exit 1
fi
echo ""

# Step 3: Generate version tag
if [ -z "$VERSION_TAG" ]; then
  GIT_SHA=$(git rev-parse --short HEAD)
  TIMESTAMP=$(date +%Y%m%d-%H%M%S)
  VERSION_TAG="${GIT_SHA}-${TIMESTAMP}"
  echo -e "${BLUE}📦 Generated version tag: ${CYAN}${VERSION_TAG}${NC}"
else
  echo -e "${BLUE}📦 Using custom version tag: ${CYAN}${VERSION_TAG}${NC}"
fi
echo ""

# Step 4: Build Docker image
echo -e "${BLUE}🐳 Building Docker image...${NC}"
echo -e "   Image: ${CONTAINER_NAME}:${VERSION_TAG}"
echo -e "   Platform: linux/amd64 (required for AWS Lightsail)"
if docker build --platform linux/amd64 -t "${CONTAINER_NAME}:${VERSION_TAG}" .; then
  echo -e "${GREEN}✅ Docker image built successfully${NC}"
else
  echo -e "${RED}❌ Docker build failed${NC}"
  exit 1
fi
echo ""

# Step 5: Push to Lightsail
echo -e "${BLUE}☁️  Pushing image to Lightsail...${NC}"
echo -e "   Service: $SERVICE_NAME"
echo -e "   Region: $REGION"

if aws lightsail push-container-image \
  --region "$REGION" \
  --service-name "$SERVICE_NAME" \
  --label "$CONTAINER_NAME" \
  --image "${CONTAINER_NAME}:${VERSION_TAG}"; then
  echo -e "${GREEN}✅ Image pushed to Lightsail${NC}"
else
  echo -e "${RED}❌ Failed to push image to Lightsail${NC}"
  exit 1
fi
echo ""

# Step 6: Get the full image name from Lightsail
echo -e "${BLUE}📝 Retrieving image reference...${NC}"
IMAGE_NAME=$(aws lightsail get-container-images \
  --service-name "$SERVICE_NAME" \
  --region "$REGION" \
  --query "containerImages[0].image" \
  --output text)

if [ -z "$IMAGE_NAME" ]; then
  echo -e "${RED}❌ Failed to retrieve image name from Lightsail${NC}"
  exit 1
fi

echo -e "   Image: ${CYAN}${IMAGE_NAME}${NC}"
echo ""

# Step 7: Create deployment configuration
echo -e "${BLUE}📄 Creating deployment configuration...${NC}"
cat > containers-deploy.json <<EOF
{
  "flask": {
    "image": "$IMAGE_NAME",
    "ports": {
      "5000": "HTTP"
    }
  }
}
EOF
echo -e "${GREEN}✅ Configuration created${NC}"
echo ""

# Step 8: Deploy to Lightsail
echo -e "${BLUE}🚀 Deploying to Lightsail...${NC}"
if aws lightsail create-container-service-deployment \
  --region "$REGION" \
  --service-name "$SERVICE_NAME" \
  --containers file://containers-deploy.json \
  --public-endpoint file://public-endpoint.json; then
  echo -e "${GREEN}✅ Deployment initiated${NC}"
else
  echo -e "${RED}❌ Failed to initiate deployment${NC}"
  rm -f containers-deploy.json
  exit 1
fi
echo ""

# Step 9: Wait for deployment to complete
echo -e "${BLUE}⏳ Waiting for deployment to complete...${NC}"
echo -e "   This may take 2-5 minutes. Please wait..."
echo ""

DEPLOYMENT_COMPLETE=false
for i in {1..30}; do
  STATUS=$(aws lightsail get-container-services \
    --service-name "$SERVICE_NAME" \
    --region "$REGION" \
    --query "containerServices[0].state" \
    --output text)

  CURRENT_DEPLOYMENT=$(aws lightsail get-container-services \
    --service-name "$SERVICE_NAME" \
    --region "$REGION" \
    --query "containerServices[0].currentDeployment.state" \
    --output text)

  if [ "$STATUS" = "RUNNING" ] && [ "$CURRENT_DEPLOYMENT" = "ACTIVE" ]; then
    echo -e "${GREEN}✅ Deployment complete (status: $STATUS)${NC}"
    DEPLOYMENT_COMPLETE=true
    break
  fi

  echo -e "   Status: ${YELLOW}$STATUS${NC} | Deployment: ${YELLOW}$CURRENT_DEPLOYMENT${NC} (attempt $i/30)"
  sleep 10
done

if [ "$DEPLOYMENT_COMPLETE" = false ]; then
  echo -e "${RED}❌ Deployment timed out after 5 minutes${NC}"
  echo -e "${YELLOW}⚠️  Check AWS Lightsail Console for details${NC}"
  rm -f containers-deploy.json
  exit 1
fi
echo ""

# Step 10: Run health checks
echo -e "${BLUE}🏥 Running comprehensive health checks...${NC}"
if "$SCRIPT_DIR/health-check.sh"; then
  echo -e "${GREEN}✅ All health checks passed${NC}"
else
  if [ "$FORCE" = false ]; then
    echo -e "${RED}❌ Health checks failed${NC}"
    echo -e "${YELLOW}💡 Run with --force to deploy anyway${NC}"
    echo -e "${YELLOW}💡 Run ./bin/rollback.sh to revert if needed${NC}"
    rm -f containers-deploy.json
    exit 1
  else
    echo -e "${YELLOW}⚠️  Health checks failed but --force specified${NC}"
    echo -e "${YELLOW}⚠️  Proceeding anyway...${NC}"
  fi
fi
echo ""

# Step 11: Save deployment metadata
echo -e "${BLUE}💾 Saving deployment metadata...${NC}"
mkdir -p .deployments

# Get current git information
GIT_SHA_FULL=$(git rev-parse HEAD)
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
DEPLOYED_BY="$(whoami)@$(hostname)"
TIMESTAMP_ISO=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Create metadata file
cat > ".deployments/${VERSION_TAG}.json" <<EOF
{
  "version": "$VERSION_TAG",
  "git_sha": "$GIT_SHA_FULL",
  "git_branch": "$GIT_BRANCH",
  "timestamp": "$TIMESTAMP_ISO",
  "container_image": "$IMAGE_NAME",
  "deployment_status": "ACTIVE",
  "health_check_passed": true,
  "deployed_by": "$DEPLOYED_BY"
}
EOF

# Update current deployment symlink
ln -sf "${VERSION_TAG}.json" .deployments/current.json

echo -e "${GREEN}✅ Metadata saved to .deployments/${VERSION_TAG}.json${NC}"
echo ""

# Cleanup temporary files
rm -f containers-deploy.json

# Step 12: Display deployment summary
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 Deployment Successful!${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  📦 Version:     ${CYAN}${VERSION_TAG}${NC}"
echo -e "  🐳 Image:       ${CYAN}${IMAGE_NAME}${NC}"
echo -e "  🌲 Branch:      ${CYAN}${GIT_BRANCH}${NC}"
echo -e "  📅 Deployed:    ${CYAN}${TIMESTAMP_ISO}${NC}"
echo -e "  👤 Deployed by: ${CYAN}${DEPLOYED_BY}${NC}"
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "  • Visit your site to verify the deployment"
echo -e "  • Check logs in AWS Lightsail Console if needed"
echo -e "  • Run ${CYAN}./bin/rollback.sh${NC} if you need to rollback"
echo ""
