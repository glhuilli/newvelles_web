# Newvelles UI/UX Improvements - Development Notes

This document captures key use cases, improvements, and fixes implemented during the Newvelles redesign project.

## Phase 3 - Interaction Polish & Accessibility (Completed)

### Search Experience Improvements

#### 1. Seamless Search Input Focus Management
**Problem**: When typing in the search box, users had to click back into the input field after each character because the re-render would lose focus.

**Solution** (src/components/App.js:324-357):
- Capture search input focus state and cursor position before re-rendering
- Restore focus and cursor position after DOM updates
- Users can now type continuously without interruption while seeing real-time filtered results

**Impact**: Smooth, uninterrupted search experience with dynamic content filtering

#### 2. Matching Article Titles in Search Results
**Problem**: When searching (e.g., "Messi"), groupings appeared in results (e.g., "Argentina") without clear indication of why they matched. This was confusing when the grouping tags didn't contain the search term.

**Solution** (src/data/searchFilter.js + src/components/App.js):
- New `getMatchingArticles()` function finds article titles that match the search query
- Grouping cards now display a "Matching articles:" section when articles (not just tags) match
- Shows up to 3 matching article titles with highlighted search terms
- Displays "+N more" indicator for additional matches

**Files Modified**:
- `src/data/searchFilter.js`: Added `getMatchingArticles()` function
- `src/components/App.js`: Updated `renderGroupingCard()` to show matching articles
- `src/styles/app.css`: Added styles for `.matching-articles` section
- `tests/unit/searchFilter.test.js`: Added 6 new tests

**Impact**: Clear visibility into why a grouping appears in search results, eliminating user confusion

### Animations & Transitions

#### View Transitions
- Fade-in animations for content area transitions
- Staggered slide-in animations for grouping cards (50ms delay between each)
- Smooth hover effects with shadow lift and 2px translateY
- Tag bubbles scale to 105% on hover

**CSS Variables** (src/styles/design-system.css):
```css
--transition-fast: 150ms ease;
--transition-base: 200ms ease;
--transition-slow: 300ms ease;
```

#### Search Filter Animations
- Cards smoothly fade out and scale down when filtered (`.filtering-out` class)
- Search text highlighting with yellow background (`.highlight` class)
- Live search stats update with ARIA live region

### Keyboard Navigation & Accessibility

#### Full Keyboard Support
**Arrow Key Navigation**:
- ↑↓←→ keys navigate through grouping/sub-grouping cards
- Home/End keys jump to first/last card
- Enter/Space activate focused cards
- Visual feedback with `.keyboard-selected` class (3px accent outline)

**Tab Navigation**:
- All interactive elements are keyboard accessible
- Proper tab order through search → cards → breadcrumb → links
- Focus indicators visible on all elements (3px outline with 2px offset)

**Implementation** (src/components/App.js:450-505):
- `handleKeyboardNavigation()` function manages arrow key state
- `selectedCardIndex` tracks current keyboard selection
- Event listeners on cards for Enter/Space activation

#### Semantic HTML & ARIA
**Semantic Elements**:
- `<header role="banner">` for masthead
- `<main role="main">` for content area
- `<nav aria-label="Breadcrumb">` for navigation
- `<footer role="contentinfo">` for footer
- `<article>`, `<section>`, `<time>` for content structure

**ARIA Labels**:
- Search input: `aria-label="Search news groupings"`, `aria-describedby="search-stats"`
- Search stats: `role="status"`, `aria-live="polite"` for screen reader updates
- Grouping cards: `role="button"`, descriptive `aria-label` with tag and article count
- Breadcrumb: `aria-current="page"` for current location
- Article links: Context-aware labels like "Article title from publisher"
- Time elements: Proper `<time datetime="ISO-8601">` for machine-readable dates

### Loading States

#### Skeleton Loading
**Implementation** (src/components/App.js + src/styles/app.css):
- `renderSkeletonCards()` function creates animated skeleton placeholders
- Shimmer animation with gradient background
- Pulse animation for subtle breathing effect
- Displays while fetching news data from API

**Animations**:
```css
@keyframes skeleton-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

#### Empty & Error States
- Empty state: "No groupings found" with `role="status"`
- Error state: "Failed to load news" with `role="alert"`
- Clear user guidance in all states

## Testing Coverage

### Current Test Stats
- **Total: 106 tests** ✓
  - 71 unit tests
  - 8 integration tests
  - 27 E2E tests

### New E2E Test Suite
**File**: `tests/e2e/accessibility.spec.js` (13 tests)

Tests cover:
- Semantic HTML structure validation
- ARIA labels and roles verification
- Keyboard navigation (Tab, Enter, Space, Arrow keys)
- Search text highlighting
- Focus visibility on interactive elements
- Skeleton loading state
- Time element datetime attributes
- Breadcrumb navigation accessibility

## Key Design Decisions

### Why Preserve Focus During Re-render?
- Modern SPA pattern: Full DOM replacement on state changes
- Without focus preservation: Cursor jumps to start of input or loses focus entirely
- Solution: Capture and restore focus state ensures uninterrupted typing
- Better UX: Users expect search to work like Google/Amazon (type continuously, see results update)

### Why Show Matching Articles in Cards?
- Transparency: Users need to understand why a grouping appears in results
- Context: Article title matches are less obvious than tag matches
- Discovery: Shows relevant content preview without requiring drill-down
- Limit to 3: Prevents cards from becoming too tall, maintains scannable grid

### Why Newspaper Aesthetic?
- Professional, trustworthy appearance for news content
- High contrast serif typography improves readability
- Warm off-white background (#FAF8F5) reduces eye strain
- Tag bubbles provide visual hierarchy and scannability

## Files Modified in Phase 3

### Core Application
- `src/components/App.js`: View rendering, keyboard navigation, focus management, matching articles display
- `src/main.js`: Skeleton loading state integration
- `src/state.js`: No changes (state management remained stable)

### Data Layer
- `src/data/searchFilter.js`: Added `getMatchingArticles()` function

### Styles
- `src/styles/app.css`: Animations, transitions, matching articles styles, keyboard navigation styles, skeleton loading
- `src/styles/design-system.css`: No changes (design tokens already established)

### Tests
- `tests/unit/searchFilter.test.js`: +6 tests for `getMatchingArticles()`
- `tests/e2e/accessibility.spec.js`: NEW FILE - 13 comprehensive accessibility tests
- `tests/e2e/smoke.spec.js`: All 14 existing tests continue to pass

## Next Steps (Phase 4)

According to REDESIGN_PLAN.md, Phase 4 focuses on:
- Backend integration updates (Flask routes, build pipeline)
- Vite production build configuration
- Docker deployment updates
- Performance optimization (lazy rendering, minification)
- Lighthouse performance audit

## Performance Considerations

### Current Optimizations
- Debounced search at 150ms prevents excessive re-renders
- Staggered animations limited to first 6 cards to reduce CSS overhead
- Skeleton loading only renders 6 cards to minimize initial paint
- Focus preservation uses direct DOM APIs (faster than React-style reconciliation)

### Future Optimizations (Phase 4)
- Lazy render article lists (only when sub-grouping opened)
- Virtual scrolling for large article counts (if needed)
- Vite code splitting and minification
- Google Fonts preload to avoid FOUT (Flash of Unstyled Text)

## Lessons Learned

1. **Focus Management is Critical**: Any component that re-renders while user is typing needs explicit focus preservation
2. **Search Transparency**: Users need to see *why* results appear, not just *what* appears
3. **Accessibility First**: ARIA labels and semantic HTML should be built in from the start, not retrofitted
4. **Test as You Build**: Writing accessibility tests alongside features caught several keyboard navigation edge cases
5. **Animation Restraint**: Subtle animations (150-300ms) feel professional; longer animations feel sluggish
6. **Progressive Disclosure**: Show 3 matching articles as preview, hide the rest behind "+N more" to maintain clean layout

## Browser Compatibility

All features tested and working in:
- Chrome/Chromium (latest)
- Playwright automated testing browser

Expected compatibility:
- Modern browsers with ES6 module support
- CSS Grid and Flexbox support required
- CSS custom properties (variables) required

## Accessibility Compliance

### WCAG AA Compliance
- ✓ Color contrast meets WCAG AA standards
- ✓ All interactive elements keyboard accessible
- ✓ Focus indicators visible (3px outline)
- ✓ Semantic HTML structure
- ✓ ARIA labels on all interactive elements
- ✓ Live regions for dynamic content updates
- ✓ Time elements with machine-readable datetime

### Screen Reader Support
- Tested with Playwright accessibility tools
- ARIA live regions announce search results updates
- Breadcrumb navigation properly labeled
- Article context provided in link labels

---

## Phase 4 - Deployment & Production Readiness (Completed)

### Issues Fixed & Deployment Restored

After 3 years since the last deployment (April 2023), several issues were discovered and resolved to restore the AWS Lightsail deployment pipeline.

#### 1. Port Configuration Mismatch

**Problem**: Flask app was running on port 5001, but all deployment infrastructure expected port 5000, causing deployment failures and health check errors.

**Files Affected**:
- `newvelles_web/app.py:118` - Running on wrong port
- `Dockerfile:28` - Exposing port 5000
- `Dockerfile:49` - Health check expecting port 5000
- `public-endpoint.json:3` - Configured for port 5000

**Solution** (newvelles_web/app.py:118):
```python
def main():
    app.run(host='0.0.0.0', port=5000, debug=True)  # Changed from 5001 to 5000
```

**Impact**: Container now starts correctly and responds to health checks.

#### 2. Missing lightsailctl Plugin

**Problem**: The AWS Lightsail Control plugin (lightsailctl) was not installed, causing image push operations to fail with error: "The Lightsail Control (lightsailctl) plugin was not found"

**Solution**:
- Installed lightsailctl v1.0.7 to `~/.local/bin/`
- Updated `bin/deploy.sh` to ensure `~/.local/bin` is in PATH
- Created `bin/check-deployment-setup.sh` to verify prerequisites

**Installation**:
```bash
mkdir -p ~/.local/bin
curl -s "https://s3.us-west-2.amazonaws.com/lightsailctl/latest/darwin-amd64/lightsailctl" -o ~/.local/bin/lightsailctl
chmod +x ~/.local/bin/lightsailctl
export PATH="$HOME/.local/bin:$PATH"  # Add to ~/.zshrc for persistence
```

**Impact**: Docker images can now be pushed to Lightsail successfully.

#### 3. Stale Service Role Credentials

**Problem**: After 3 years without deployment, the Lightsail service role credentials were stale, causing 403 Forbidden errors when attempting to push images to ECR (backend storage for Lightsail):
```
unexpected status from HEAD request to ECR: 403 Forbidden
```

**Root Cause**: The service principal ARN pointed to AWS's internal ECR account (035162096330) but lacked valid credentials to push new images after years of inactivity.

**Solution**: Refreshed the Lightsail service configuration:
```bash
aws lightsail update-container-service \
  --service-name newvelles-web-service \
  --region us-west-2 \
  --power micro \
  --scale 1
```

**Impact**: Service role credentials refreshed, image push operations now succeed.

### Deployment Pipeline Enhancements

#### New Documentation

**docs/DEPLOYMENT_SETUP.md** - Comprehensive deployment guide covering:
- Complete prerequisites checklist
- Tool installation instructions (AWS CLI, Docker, lightsailctl)
- AWS credentials and IAM permissions setup
- Common issues and solutions (with exact commands)
- Manual step-by-step deployment workflow
- Troubleshooting guide with container logs
- Health check verification steps

**bin/check-deployment-setup.sh** - Automated prerequisites verification:
- Checks all required tools (AWS CLI, Docker, Node.js, Python)
- Verifies AWS credentials and account
- Tests Docker daemon status
- Confirms lightsailctl installation and PATH
- Validates Lightsail service accessibility
- Reports service state (RUNNING/DEPLOYING)
- Checks project structure completeness

Usage:
```bash
./bin/check-deployment-setup.sh
# ✅ All checks passed!
# You're ready to deploy:
#   ./bin/deploy.sh              # Full deployment with tests
#   ./bin/deploy.sh --skip-tests # Skip tests (faster)
```

#### Updated Deployment Script

**bin/deploy.sh** - PATH fix for lightsailctl:
```bash
# Ensure lightsailctl is in PATH (required for image push)
export PATH="$HOME/.local/bin:$PATH"
```

This ensures the deployment script can find lightsailctl even if it's not in the system PATH.

### Successful Deployment - Version 15

**Deployment Details** (2026-04-20):
- **Status**: ✅ ACTIVE
- **Version**: 15 (first deployment since v14 in April 2023)
- **Image Tag**: `2656b83-20260420-040345`
- **Health Status**: Healthy
- **News Groupings**: 187 articles
- **Deployment Time**: ~3 minutes

**Live URLs**:
- Custom Domain: https://newvelles.com/
- Lightsail URL: https://newvelles-web-service.nbof67v3f3gck.us-west-2.cs.amazonlightsail.com/

**Service Configuration**:
- Region: us-west-2
- Power: micro (512 MB RAM, 0.25 vCPUs)
- Scale: 1 container
- Container Name: flask
- Port: 5000 (HTTP)

### Docker Build Optimization

**Multi-Stage Build** (Dockerfile):
- Stage 1: Node.js Alpine - Builds Vite frontend (dist/)
- Stage 2: Python 3.11 Alpine - Runs Flask backend + serves static frontend
- Build time: ~45 seconds (most layers cached)
- Final image size: 24 MB
- Platform: linux/amd64 (required for AWS Lightsail)

**Build Output**:
```
dist/index.html                  1.23 kB │ gzip: 0.64 kB
dist/assets/index-hxUjw8yn.css  14.51 kB │ gzip: 3.05 kB
dist/assets/index-UqLGzrUQ.js   18.86 kB │ gzip: 5.88 kB
```

### Key Learnings

1. **Long-Term Service Maintenance**: Services inactive for years may require credential refresh via `aws lightsail update-container-service` before new deployments work.

2. **lightsailctl is Critical**: Unlike standard ECR operations, Lightsail requires the lightsailctl plugin for image push. This should be verified during setup.

3. **Port Consistency**: All deployment configs must use the same port:
   - Application runtime port
   - Dockerfile EXPOSE directive
   - Dockerfile HEALTHCHECK endpoint
   - public-endpoint.json configuration

4. **Prerequisites Verification**: Automated checks (like `check-deployment-setup.sh`) prevent deployment failures by catching missing tools/configs early.

5. **Documentation is Essential**: After years between deployments, comprehensive documentation (DEPLOYMENT_SETUP.md) is critical for reproducibility.

### Files Modified in Phase 4

**Core Application**:
- `newvelles_web/app.py:118` - Port fix (5001 → 5000)

**Deployment Infrastructure**:
- `bin/deploy.sh:70` - Added PATH export for lightsailctl
- `bin/check-deployment-setup.sh` - NEW FILE (executable verification script)
- `docs/DEPLOYMENT_SETUP.md` - NEW FILE (comprehensive deployment guide)

**No Frontend/Backend Logic Changes**: All changes were infrastructure and configuration only.

### Test Results

All 106 tests passing:
- ✓ 71 unit tests (Vitest)
- ✓ 8 integration tests (Vitest)
- ✓ 27 E2E tests (Playwright)

Test execution time: ~7 seconds total

### Production Verification

**Health Endpoint** (`/health`):
```json
{
  "status": "healthy",
  "timestamp": "2026-04-20T11:16:43.325178Z",
  "news_groupings": 187,
  "metadata_version": "0.2.1",
  "metadata_datetime": "2026-04-20T00:00:45-07:00"
}
```

**Frontend Verification**:
- ✓ Main page loads (`/`)
- ✓ Vite assets served correctly (CSS + JS)
- ✓ Google Analytics tracking active
- ✓ News API returns 187 groupings (`/news`)
- ✓ Metadata API functional (`/metadata`)

**Browser Testing**:
- All Phase 3 features verified working in production
- Search, filtering, keyboard navigation functional
- Skeleton loading, animations, accessibility features intact

### Deployment Workflow (Updated)

**Standard Workflow**:
```bash
# 1. Verify prerequisites
./bin/check-deployment-setup.sh

# 2. Run tests (optional but recommended)
npm test

# 3. Deploy (automatic build + push + health checks)
./bin/deploy.sh

# Or skip tests for faster deployment
./bin/deploy.sh --skip-tests
```

**Troubleshooting Workflow**:
```bash
# If push fails with 403 Forbidden
aws lightsail update-container-service \
  --service-name newvelles-web-service \
  --region us-west-2 \
  --power micro \
  --scale 1

# Wait 2-3 minutes for service to stabilize
# Then retry deployment
```

### Future Deployment Considerations

1. **PATH Configuration**: Ensure `~/.local/bin` is in PATH permanently:
   ```bash
   echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
   source ~/.zshrc
   ```

2. **lightsailctl Updates**: Periodically check for updates:
   ```bash
   curl -s "https://s3.us-west-2.amazonaws.com/lightsailctl/latest/darwin-amd64/lightsailctl" -o ~/.local/bin/lightsailctl
   chmod +x ~/.local/bin/lightsailctl
   ```

3. **Service Health**: If service hasn't been deployed in months, consider running `update-container-service` first to refresh credentials.

4. **Deployment Metadata**: All deployments are tracked in `.deployments/` directory with git SHA, timestamp, and deployment status.

---

*Last Updated: 2026-04-20*
*Phase 4 Status: Complete ✓*
*Current Deployment: Version 15 (ACTIVE)*
*Total Test Coverage: 106 tests passing*
