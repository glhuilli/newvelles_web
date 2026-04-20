#!/bin/bash
#
# Newvelles Web Health Check Script
# ==================================
# Comprehensive triple-check verification of deployment health
#
# Checks performed:
#   1. AWS Lightsail service status
#   2. Endpoint reachability (/, /health, /news, /metadata)
#   3. Response validation (status codes and content)
#
# Usage:
#   ./bin/health-check.sh                              # Check production
#   ./bin/health-check.sh --url https://example.com    # Check custom URL
#   ./bin/health-check.sh --verbose                    # Verbose output
#

set -e  # Exit immediately if a command exits with non-zero status
set -u  # Treat unset variables as an error

# Configuration
DEFAULT_URL="https://newvelles.com"
SERVICE_NAME="newvelles-web-service"
REGION="us-west-2"
MAX_ATTEMPTS=10
DELAY=10

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default options
BASE_URL="$DEFAULT_URL"
VERBOSE=false

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --url)
      BASE_URL="$2"
      shift 2
      ;;
    --verbose|-v)
      VERBOSE=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --url URL       Check health of custom URL (default: https://newvelles.com)"
      echo "  --verbose, -v   Show verbose output with timing information"
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

# Print header
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🏥 Health Check Report${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "   Target: ${CYAN}${BASE_URL}${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Track overall status
FAILED=0

# Check 1: Lightsail Service Status
check_lightsail_status() {
  if [ "$VERBOSE" = true ]; then
    echo -e "${BLUE}Checking Lightsail service status...${NC}"
  fi

  local status=$(aws lightsail get-container-services \
    --service-name "$SERVICE_NAME" \
    --region "$REGION" \
    --query "containerServices[0].state" \
    --output text 2>/dev/null)

  local deployment_status=$(aws lightsail get-container-services \
    --service-name "$SERVICE_NAME" \
    --region "$REGION" \
    --query "containerServices[0].currentDeployment.state" \
    --output text 2>/dev/null)

  if [ "$status" = "RUNNING" ] && [ "$deployment_status" = "ACTIVE" ]; then
    echo -e "${GREEN}✓${NC} Lightsail Service: ${GREEN}${status}${NC} (Deployment: ${GREEN}${deployment_status}${NC})"
    return 0
  else
    echo -e "${RED}✗${NC} Lightsail Service: ${RED}${status}${NC} (Deployment: ${RED}${deployment_status}${NC})"
    return 1
  fi
}

# Check 2: Individual endpoint health
check_endpoint() {
  local endpoint=$1
  local description=$2
  local start_time=$(date +%s)

  for attempt in $(seq 1 $MAX_ATTEMPTS); do
    if [ "$VERBOSE" = true ] && [ $attempt -gt 1 ]; then
      echo -e "${BLUE}   Attempt $attempt/$MAX_ATTEMPTS for $description...${NC}"
    fi

    # Make request and capture response
    response=$(curl -s -w "\n%{http_code}" -o /tmp/health-response-$$.json "${BASE_URL}${endpoint}" 2>&1)
    http_code="${response##*$'\n'}"

    if [ "$http_code" = "200" ]; then
      local end_time=$(date +%s)
      local duration=$((end_time - start_time))

      # Parse response based on endpoint
      if [ "$endpoint" = "/health" ]; then
        # Parse health endpoint JSON
        if command -v jq &> /dev/null; then
          local status=$(jq -r '.status // "unknown"' /tmp/health-response-$$.json 2>/dev/null)
          local groupings=$(jq -r '.news_groupings // "unknown"' /tmp/health-response-$$.json 2>/dev/null)
          local version=$(jq -r '.metadata_version // "unknown"' /tmp/health-response-$$.json 2>/dev/null)

          echo -e "${GREEN}✓${NC} ${description}: ${GREEN}${http_code} OK${NC}"
          echo -e "   Status: ${CYAN}${status}${NC}"
          echo -e "   Groupings: ${CYAN}${groupings}${NC}"
          echo -e "   Version: ${CYAN}${version}${NC}"
        else
          echo -e "${GREEN}✓${NC} ${description}: ${GREEN}${http_code} OK${NC}"
          echo -e "${YELLOW}   (Install jq for detailed response parsing)${NC}"
        fi
      elif [ "$endpoint" = "/news" ]; then
        # Validate news endpoint returns data
        if command -v jq &> /dev/null; then
          local count=$(jq '. | length' /tmp/health-response-$$.json 2>/dev/null)
          echo -e "${GREEN}✓${NC} ${description}: ${GREEN}${http_code} OK${NC} (${count} groupings)"
        else
          echo -e "${GREEN}✓${NC} ${description}: ${GREEN}${http_code} OK${NC}"
        fi
      else
        echo -e "${GREEN}✓${NC} ${description}: ${GREEN}${http_code} OK${NC}"
      fi

      if [ "$VERBOSE" = true ]; then
        echo -e "   Response time: ${duration}s"
      fi

      rm -f /tmp/health-response-$$.json
      return 0
    fi

    # If not successful and more attempts remain, wait and retry
    if [ $attempt -lt $MAX_ATTEMPTS ]; then
      echo -e "${YELLOW}⟳${NC} ${description}: Attempt $attempt/$MAX_ATTEMPTS (HTTP ${http_code})"
      sleep $DELAY
    fi
  done

  # All attempts failed
  echo -e "${RED}✗${NC} ${description}: ${RED}FAILED${NC} (HTTP ${http_code} after ${MAX_ATTEMPTS} attempts)"
  rm -f /tmp/health-response-$$.json
  return 1
}

# Run all health checks
echo -e "${BLUE}Running health checks...${NC}"
echo ""

# Check 1: Lightsail Status
check_lightsail_status || FAILED=1
echo ""

# Check 2: Health endpoint (most important)
check_endpoint "/health" "Health endpoint" || FAILED=1
echo ""

# Check 3: Homepage
check_endpoint "/" "Homepage" || FAILED=1
echo ""

# Check 4: News API
check_endpoint "/news" "News API" || FAILED=1
echo ""

# Check 5: Metadata API
check_endpoint "/metadata" "Metadata API" || FAILED=1
echo ""

# Print summary
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 All health checks PASSED${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  exit 0
else
  echo -e "${RED}❌ Some health checks FAILED${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo -e "${YELLOW}Troubleshooting tips:${NC}"
  echo -e "  • Check AWS Lightsail Console for deployment logs"
  echo -e "  • Verify the container is running: aws lightsail get-container-services --service-name $SERVICE_NAME"
  echo -e "  • Check application logs for errors"
  echo -e "  • Consider rolling back: ./bin/rollback.sh"
  echo ""
  exit 1
fi
