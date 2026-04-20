#!/bin/bash
#
# Newvelles Web Rollback Script
# ==============================
# Quick rollback to a previous stable deployment
#
# Usage:
#   ./bin/rollback.sh                        # Interactive rollback
#   ./bin/rollback.sh --previous             # Rollback to immediately previous version
#   ./bin/rollback.sh --version abc123-...   # Rollback to specific version
#   ./bin/rollback.sh --list                 # List available versions
#

set -e  # Exit immediately if a command exits with non-zero status
set -u  # Treat unset variables as an error

# Configuration
SERVICE_NAME="newvelles-web-service"
REGION="us-west-2"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEPLOYMENTS_DIR="$PROJECT_ROOT/.deployments"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default options
TARGET_VERSION=""
ROLLBACK_TO_PREVIOUS=false
LIST_ONLY=false
FORCE=false

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --previous)
      ROLLBACK_TO_PREVIOUS=true
      shift
      ;;
    --version)
      TARGET_VERSION="$2"
      shift 2
      ;;
    --list)
      LIST_ONLY=true
      shift
      ;;
    --force)
      FORCE=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --previous           Rollback to the immediately previous deployment"
      echo "  --version VERSION    Rollback to a specific version"
      echo "  --list               List all available deployment versions"
      echo "  --force              Skip confirmation prompt"
      echo "  --help, -h           Show this help message"
      exit 0
      ;;
    *)
      echo -e "${RED}❌ Unknown option: $1${NC}"
      echo "Run '$0 --help' for usage information"
      exit 1
      ;;
  esac
done

# Navigate to project root
cd "$PROJECT_ROOT"

# Check if deployments directory exists
if [ ! -d "$DEPLOYMENTS_DIR" ]; then
  echo -e "${RED}❌ No deployment history found${NC}"
  echo -e "${YELLOW}💡 The .deployments/ directory doesn't exist yet${NC}"
  echo -e "${YELLOW}💡 Deploy at least once before attempting rollback${NC}"
  exit 1
fi

# Function to list all deployments
list_deployments() {
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}📜 Available Deployments for Rollback${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  local count=0
  local current_version=""

  # Get current deployment
  if [ -f "$DEPLOYMENTS_DIR/current.json" ]; then
    current_version=$(basename "$(readlink "$DEPLOYMENTS_DIR/current.json")" .json)
  fi

  # List all deployment files (sorted by timestamp, newest first)
  for deployment_file in $(ls -t "$DEPLOYMENTS_DIR"/*.json 2>/dev/null | grep -v current.json); do
    count=$((count + 1))
    local filename=$(basename "$deployment_file")
    local version="${filename%.json}"

    # Parse deployment metadata
    if command -v jq &> /dev/null; then
      local git_sha=$(jq -r '.git_sha' "$deployment_file" 2>/dev/null | cut -c1-7)
      local timestamp=$(jq -r '.timestamp' "$deployment_file" 2>/dev/null)
      local branch=$(jq -r '.git_branch' "$deployment_file" 2>/dev/null)
      local deployed_by=$(jq -r '.deployed_by' "$deployment_file" 2>/dev/null)

      # Format timestamp for display
      if command -v date &> /dev/null; then
        timestamp=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$timestamp" "+%Y-%m-%d %H:%M:%S %Z" 2>/dev/null || echo "$timestamp")
      fi

      # Mark current deployment
      local marker=""
      if [ "$version" = "$current_version" ]; then
        marker="${GREEN}(current)${NC}"
      fi

      echo -e "${CYAN}[$count]${NC} ${version} ${marker}"
      echo -e "    Git: ${git_sha} | Branch: ${branch}"
      echo -e "    Deployed: ${timestamp}"
      echo -e "    By: ${deployed_by}"
      echo ""
    else
      echo -e "${CYAN}[$count]${NC} ${version}"
      echo ""
    fi
  done

  if [ $count -eq 0 ]; then
    echo -e "${YELLOW}No deployments found${NC}"
    echo ""
  fi

  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# If --list flag is set, just show the list and exit
if [ "$LIST_ONLY" = true ]; then
  list_deployments
  exit 0
fi

# Show available deployments
list_deployments

# Determine target version for rollback
if [ -n "$TARGET_VERSION" ]; then
  # Specific version provided
  if [ ! -f "$DEPLOYMENTS_DIR/${TARGET_VERSION}.json" ]; then
    echo -e "${RED}❌ Version not found: ${TARGET_VERSION}${NC}"
    exit 1
  fi
elif [ "$ROLLBACK_TO_PREVIOUS" = true ]; then
  # Rollback to previous (second most recent)
  TARGET_VERSION=$(ls -t "$DEPLOYMENTS_DIR"/*.json 2>/dev/null | grep -v current.json | sed -n '2p' | xargs basename | sed 's/.json$//')
  if [ -z "$TARGET_VERSION" ]; then
    echo -e "${RED}❌ No previous deployment found${NC}"
    exit 1
  fi
  echo -e "${BLUE}Selected previous deployment: ${CYAN}${TARGET_VERSION}${NC}"
  echo ""
else
  # Interactive selection
  echo -e "${BLUE}Select deployment version to rollback to:${NC}"
  read -p "Enter version number or full version string: " selection

  # Check if input is a number (menu selection)
  if [[ "$selection" =~ ^[0-9]+$ ]]; then
    TARGET_VERSION=$(ls -t "$DEPLOYMENTS_DIR"/*.json 2>/dev/null | grep -v current.json | sed -n "${selection}p" | xargs basename | sed 's/.json$//')
  else
    TARGET_VERSION="$selection"
  fi

  if [ -z "$TARGET_VERSION" ] || [ ! -f "$DEPLOYMENTS_DIR/${TARGET_VERSION}.json" ]; then
    echo -e "${RED}❌ Invalid selection${NC}"
    exit 1
  fi
fi

# Load target deployment metadata
METADATA_FILE="$DEPLOYMENTS_DIR/${TARGET_VERSION}.json"

if command -v jq &> /dev/null; then
  CONTAINER_IMAGE=$(jq -r '.container_image' "$METADATA_FILE")
  GIT_SHA=$(jq -r '.git_sha' "$METADATA_FILE" | cut -c1-7)
  GIT_BRANCH=$(jq -r '.git_branch' "$METADATA_FILE")
  TIMESTAMP=$(jq -r '.timestamp' "$METADATA_FILE")
else
  echo -e "${YELLOW}⚠️  jq not installed, using AWS CLI to find image${NC}"
  CONTAINER_IMAGE=""
fi

# Confirmation prompt (unless --force)
if [ "$FORCE" = false ]; then
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}⚠️  Rollback Confirmation${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "  Version: ${CYAN}${TARGET_VERSION}${NC}"
  if [ -n "$GIT_SHA" ]; then
    echo -e "  Git SHA: ${CYAN}${GIT_SHA}${NC}"
  fi
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  read -p "Continue with rollback? (yes/no): " confirm

  if [ "$confirm" != "yes" ] && [ "$confirm" != "y" ]; then
    echo -e "${YELLOW}Rollback cancelled${NC}"
    exit 0
  fi
  echo ""
fi

# Start rollback process
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔄 Starting Rollback${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# If we don't have the container image from metadata, query Lightsail
if [ -z "$CONTAINER_IMAGE" ]; then
  echo -e "${BLUE}📝 Querying Lightsail for deployment history...${NC}"

  # Get all deployments and find the one matching our target
  # Note: This is a simplified approach - in production you'd want more robust matching
  CONTAINER_IMAGE=$(aws lightsail get-container-service-deployments \
    --service-name "$SERVICE_NAME" \
    --region "$REGION" \
    --query "deployments[?contains(containers.flask.image, '${TARGET_VERSION}')].containers.flask.image | [0]" \
    --output text 2>/dev/null)

  if [ -z "$CONTAINER_IMAGE" ] || [ "$CONTAINER_IMAGE" = "None" ]; then
    echo -e "${RED}❌ Could not find container image for version ${TARGET_VERSION}${NC}"
    echo -e "${YELLOW}💡 The deployment may have been cleaned up from Lightsail${NC}"
    exit 1
  fi
fi

echo -e "   Image: ${CYAN}${CONTAINER_IMAGE}${NC}"
echo ""

# Create rollback deployment configuration
echo -e "${BLUE}📄 Creating rollback configuration...${NC}"
cat > containers-rollback.json <<EOF
{
  "flask": {
    "image": "$CONTAINER_IMAGE",
    "ports": {
      "5000": "HTTP"
    }
  }
}
EOF
echo -e "${GREEN}✅ Configuration created${NC}"
echo ""

# Deploy the rollback
echo -e "${BLUE}🚀 Deploying rollback...${NC}"
if aws lightsail create-container-service-deployment \
  --region "$REGION" \
  --service-name "$SERVICE_NAME" \
  --containers file://containers-rollback.json \
  --public-endpoint file://public-endpoint.json; then
  echo -e "${GREEN}✅ Rollback deployment initiated${NC}"
else
  echo -e "${RED}❌ Failed to initiate rollback deployment${NC}"
  rm -f containers-rollback.json
  exit 1
fi
echo ""

# Wait for deployment to complete
echo -e "${BLUE}⏳ Waiting for rollback to complete...${NC}"
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
    echo -e "${GREEN}✅ Rollback complete (status: $STATUS)${NC}"
    DEPLOYMENT_COMPLETE=true
    break
  fi

  echo -e "   Status: ${YELLOW}$STATUS${NC} | Deployment: ${YELLOW}$CURRENT_DEPLOYMENT${NC} (attempt $i/30)"
  sleep 10
done

if [ "$DEPLOYMENT_COMPLETE" = false ]; then
  echo -e "${RED}❌ Rollback timed out after 5 minutes${NC}"
  echo -e "${YELLOW}⚠️  Check AWS Lightsail Console for details${NC}"
  rm -f containers-rollback.json
  exit 1
fi
echo ""

# Run health checks
echo -e "${BLUE}🏥 Running health checks...${NC}"
if "$SCRIPT_DIR/health-check.sh"; then
  echo -e "${GREEN}✅ Health checks passed${NC}"
else
  echo -e "${YELLOW}⚠️  Health checks failed after rollback${NC}"
  echo -e "${YELLOW}💡 Check AWS Lightsail Console and application logs${NC}"
fi
echo ""

# Update current deployment marker
ln -sf "${TARGET_VERSION}.json" "$DEPLOYMENTS_DIR/current.json"

# Cleanup
rm -f containers-rollback.json

# Success message
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Rollback Successful!${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  📦 Rolled back to: ${CYAN}${TARGET_VERSION}${NC}"
echo -e "  🐳 Image: ${CYAN}${CONTAINER_IMAGE}${NC}"
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "  • Verify the site is working correctly"
echo -e "  • Check application logs for any issues"
echo -e "  • Document why rollback was necessary"
echo ""
