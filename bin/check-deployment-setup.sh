#!/bin/bash
#
# Newvelles Web - Deployment Setup Verification
# ==============================================
# Verifies all prerequisites are met before attempting deployment
#
# Usage: ./bin/check-deployment-setup.sh
#

set -u  # Treat unset variables as an error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Track overall status
ALL_CHECKS_PASSED=true

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔍 Deployment Prerequisites Check${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check 1: AWS CLI
echo -n "Checking AWS CLI... "
if command -v aws &> /dev/null; then
    AWS_VERSION=$(aws --version 2>&1 | cut -d' ' -f1 | cut -d'/' -f2)
    echo -e "${GREEN}✓${NC} Installed (version ${AWS_VERSION})"
else
    echo -e "${RED}✗${NC} Not found"
    echo -e "  ${YELLOW}Install:${NC} brew install awscli"
    ALL_CHECKS_PASSED=false
fi

# Check 2: AWS Credentials
echo -n "Checking AWS credentials... "
if aws sts get-caller-identity &> /dev/null; then
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    USER_ARN=$(aws sts get-caller-identity --query Arn --output text)
    echo -e "${GREEN}✓${NC} Configured"
    echo -e "  Account: ${CYAN}${ACCOUNT_ID}${NC}"
    echo -e "  User: ${CYAN}${USER_ARN}${NC}"

    # Verify correct account
    if [ "$ACCOUNT_ID" != "617641631577" ]; then
        echo -e "  ${YELLOW}⚠️  Warning: Expected account 617641631577${NC}"
    fi
else
    echo -e "${RED}✗${NC} Not configured"
    echo -e "  ${YELLOW}Configure:${NC} aws configure"
    ALL_CHECKS_PASSED=false
fi

# Check 3: Docker
echo -n "Checking Docker... "
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | tr -d ',')
    echo -e "${GREEN}✓${NC} Installed (version ${DOCKER_VERSION})"

    # Check if Docker daemon is running
    echo -n "Checking Docker daemon... "
    if docker info &> /dev/null; then
        echo -e "${GREEN}✓${NC} Running"
    else
        echo -e "${RED}✗${NC} Not running"
        echo -e "  ${YELLOW}Start Docker Desktop and try again${NC}"
        ALL_CHECKS_PASSED=false
    fi
else
    echo -e "${RED}✗${NC} Not found"
    echo -e "  ${YELLOW}Install:${NC} Download from https://www.docker.com/products/docker-desktop"
    ALL_CHECKS_PASSED=false
fi

# Check 4: lightsailctl
echo -n "Checking lightsailctl... "
if command -v lightsailctl &> /dev/null; then
    LIGHTSAIL_VERSION=$(lightsailctl --version 2>&1)
    echo -e "${GREEN}✓${NC} Installed (${LIGHTSAIL_VERSION})"
    LIGHTSAIL_PATH=$(command -v lightsailctl)
    echo -e "  Location: ${CYAN}${LIGHTSAIL_PATH}${NC}"
else
    echo -e "${RED}✗${NC} Not found"
    echo -e "  ${YELLOW}This is REQUIRED for pushing Docker images to Lightsail${NC}"
    echo -e "  ${YELLOW}Install:${NC}"
    echo -e "    mkdir -p ~/.local/bin"
    echo -e "    curl -s \"https://s3.us-west-2.amazonaws.com/lightsailctl/latest/darwin-amd64/lightsailctl\" -o ~/.local/bin/lightsailctl"
    echo -e "    chmod +x ~/.local/bin/lightsailctl"
    echo -e "    echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.zshrc"
    echo -e "    source ~/.zshrc"
    ALL_CHECKS_PASSED=false
fi

# Check 5: Node.js and npm
echo -n "Checking Node.js... "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓${NC} Installed (${NODE_VERSION})"

    echo -n "Checking npm... "
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        echo -e "${GREEN}✓${NC} Installed (v${NPM_VERSION})"
    else
        echo -e "${RED}✗${NC} Not found"
        ALL_CHECKS_PASSED=false
    fi
else
    echo -e "${RED}✗${NC} Not found"
    echo -e "  ${YELLOW}Install:${NC} brew install node@18"
    ALL_CHECKS_PASSED=false
fi

# Check 6: Lightsail Service Access
echo -n "Checking Lightsail service... "
if aws lightsail get-container-services --service-name newvelles-web-service --region us-west-2 &> /dev/null; then
    SERVICE_STATE=$(aws lightsail get-container-services --service-name newvelles-web-service --region us-west-2 --query "containerServices[0].state" --output text)
    echo -e "${GREEN}✓${NC} Accessible"
    echo -e "  Service: ${CYAN}newvelles-web-service${NC}"
    echo -e "  Region: ${CYAN}us-west-2${NC}"
    echo -e "  State: ${CYAN}${SERVICE_STATE}${NC}"

    if [ "$SERVICE_STATE" != "RUNNING" ]; then
        echo -e "  ${YELLOW}⚠️  Warning: Service is not in RUNNING state${NC}"
        echo -e "  ${YELLOW}Wait for current deployment to complete before deploying${NC}"
    fi
else
    echo -e "${RED}✗${NC} Cannot access service"
    echo -e "  ${YELLOW}Check AWS credentials and IAM permissions${NC}"
    ALL_CHECKS_PASSED=false
fi

# Check 7: Node dependencies
echo -n "Checking node_modules... "
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} Installed"
else
    echo -e "${YELLOW}⚠${NC} Not found"
    echo -e "  ${YELLOW}Run:${NC} npm install"
fi

# Check 8: Python
echo -n "Checking Python... "
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    echo -e "${GREEN}✓${NC} Installed (${PYTHON_VERSION})"
else
    echo -e "${RED}✗${NC} Not found"
    echo -e "  ${YELLOW}Install:${NC} brew install python@3.11"
    ALL_CHECKS_PASSED=false
fi

# Check 9: Project files
echo -n "Checking project structure... "
MISSING_FILES=""
for file in "Dockerfile" "requirements.txt" "setup.py" "public-endpoint.json" "bin/deploy.sh" "bin/health-check.sh"; do
    if [ ! -f "$file" ]; then
        MISSING_FILES="${MISSING_FILES} ${file}"
    fi
done

if [ -z "$MISSING_FILES" ]; then
    echo -e "${GREEN}✓${NC} All required files present"
else
    echo -e "${RED}✗${NC} Missing files:${MISSING_FILES}"
    ALL_CHECKS_PASSED=false
fi

# Summary
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ "$ALL_CHECKS_PASSED" = true ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    echo ""
    echo -e "${BLUE}You're ready to deploy:${NC}"
    echo -e "  ${CYAN}./bin/deploy.sh${NC}              # Full deployment with tests"
    echo -e "  ${CYAN}./bin/deploy.sh --skip-tests${NC} # Skip tests (faster)"
else
    echo -e "${RED}❌ Some checks failed${NC}"
    echo ""
    echo -e "${YELLOW}Please fix the issues above before deploying.${NC}"
    echo -e "${YELLOW}See docs/DEPLOYMENT_SETUP.md for detailed setup instructions.${NC}"
    exit 1
fi
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
