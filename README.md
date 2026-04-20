# Newvelles Web

Modern web application for accessing news summaries from the Newvelles project. Features a newspaper-inspired UI with real-time search, keyboard navigation, and comprehensive accessibility support.

**Live**: https://newvelles.com/

## Features

- 📰 **Newspaper-style UI** - Professional, readable design with serif typography
- 🔍 **Real-time Search** - Instant filtering with highlighted matches
- ⌨️ **Keyboard Navigation** - Full arrow key support, Tab navigation
- ♿ **Accessibility** - WCAG AA compliant, screen reader friendly
- 📱 **Responsive Design** - Works on desktop and mobile
- ⚡ **Performance** - Vite-powered frontend, optimized Docker builds
- 🧪 **Well Tested** - 106 tests (71 unit, 8 integration, 27 E2E)

## Tech Stack

**Frontend**:
- Vanilla JavaScript (ES6 modules)
- Vite (build tool)
- Vitest + Playwright (testing)

**Backend**:
- Flask (Python 3.11)
- AWS S3 (news data storage)

**Deployment**:
- AWS Lightsail Container Service
- Docker (multi-stage build)
- Automated deployment pipeline

## Quick Start

### Local Development

1. **Install dependencies**:
```bash
npm install
pip install -r requirements.txt
```

2. **Run development server**:
```bash
# Frontend (hot reload)
npm run dev

# Backend (Flask)
python run.py
```

3. **Open**: http://localhost:5173 (Vite dev server proxies to Flask)

### Run Tests

```bash
# All tests (unit + integration + E2E)
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# E2E tests only
npm run test:e2e

# Watch mode
npm run test:watch
```

## Deployment

### Prerequisites

1. Install AWS CLI and configure credentials
2. Install Docker Desktop
3. Install lightsailctl plugin
4. Verify setup:
```bash
./bin/check-deployment-setup.sh
```

See [docs/DEPLOYMENT_SETUP.md](docs/DEPLOYMENT_SETUP.md) for detailed setup instructions.

### Deploy to AWS Lightsail

```bash
# Standard deployment (with tests)
./bin/deploy.sh

# Quick deployment (skip tests)
./bin/deploy.sh --skip-tests

# Custom version tag
./bin/deploy.sh --tag v1.5.0
```

See [docs/QUICK_DEPLOYMENT.md](docs/QUICK_DEPLOYMENT.md) for quick reference.

### Rollback

If deployment has issues:
```bash
./bin/rollback.sh
```

### Health Check

```bash
./bin/health-check.sh

# Or manually
curl https://newvelles.com/health
```

## Project Structure

```
newvelles_web/
├── src/                      # Frontend source
│   ├── components/          # UI components (App.js)
│   ├── data/                # Data layer (search, API)
│   ├── styles/              # CSS (design system + components)
│   └── main.js              # Entry point
├── newvelles_web/           # Backend (Flask)
│   ├── app.py               # Flask routes
│   ├── latest_news.py       # S3 data fetching
│   └── metadata.py          # News metadata
├── tests/
│   ├── unit/                # Vitest unit tests
│   ├── integration/         # Vitest integration tests
│   └── e2e/                 # Playwright E2E tests
├── bin/                      # Deployment scripts
│   ├── deploy.sh            # Main deployment pipeline
│   ├── health-check.sh      # Health verification
│   ├── rollback.sh          # Rollback to previous version
│   └── check-deployment-setup.sh  # Prerequisites check
├── docs/                     # Documentation
│   ├── DEPLOYMENT_SETUP.md  # Complete deployment guide
│   └── QUICK_DEPLOYMENT.md  # Quick reference
├── Dockerfile               # Multi-stage Docker build
├── vite.config.js           # Vite configuration
├── playwright.config.js     # Playwright E2E config
└── CLAUDE.md                # Development notes & history
```

## API Endpoints

- `GET /` - Serve frontend application
- `GET /news` - Fetch news groupings (JSON)
- `GET /metadata` - Fetch news metadata (version, timestamp)
- `GET /health` - Health check (deployment verification)

## Configuration

**Backend** (`newvelles_web/config/newvelles-web.ini`):
```ini
[PARAMS]
local=False  # Use S3 data (True = local test data)
```

**Docker**: Port 5000 (HTTP)

**AWS Lightsail**:
- Service: newvelles-web-service
- Region: us-west-2
- Power: micro (512 MB RAM, 0.25 vCPUs)

## Development Notes

### Phase 3: UI/UX Redesign
- Modern newspaper aesthetic
- Real-time search with match highlighting
- Full keyboard navigation support
- Comprehensive accessibility (ARIA, semantic HTML)
- Skeleton loading states

### Phase 4: Deployment Restoration
- Fixed port mismatch (5001 → 5000)
- Installed lightsailctl plugin
- Refreshed stale service credentials
- Created comprehensive deployment docs
- Automated prerequisites verification

See [CLAUDE.md](CLAUDE.md) for complete development history.

## Monitoring

**Logs**:
```bash
# Via AWS Console
https://lightsail.aws.amazon.com/ → Containers → newvelles-web-service → Deployments

# Via CLI
aws lightsail get-container-log \
  --service-name newvelles-web-service \
  --container-name flask \
  --region us-west-2
```

**Metrics**:
- AWS Lightsail Console → Metrics tab
- Monitor CPU, memory, requests

## Contributing

1. Create a feature branch
2. Make changes and add tests
3. Ensure all tests pass: `npm test`
4. Deploy to staging (if available)
5. Create PR with description

## License

MIT License

## Links

- **Live Site**: https://newvelles.com/
- **Lightsail URL**: https://newvelles-web-service.nbof67v3f3gck.us-west-2.cs.amazonlightsail.com/
- **AWS Console**: https://lightsail.aws.amazon.com/
- **GitHub**: https://github.com/glhuilli/newvelles_web

## Support

For deployment issues, see:
- [docs/DEPLOYMENT_SETUP.md](docs/DEPLOYMENT_SETUP.md) - Complete setup guide
- [docs/QUICK_DEPLOYMENT.md](docs/QUICK_DEPLOYMENT.md) - Quick reference
- [CLAUDE.md](CLAUDE.md) - Phase 4 troubleshooting section
