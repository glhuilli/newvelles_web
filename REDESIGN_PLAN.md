# Newvelles UI/UX Redesign Plan

## Project Context

Newvelles is a personal project that displays summarized news from RSS feeds. The data is a three-level JSON hierarchy: **Groupings → Sub-groupings → Articles**. Grouping names are bracket-delimited keyword tags (e.g. `[Trump Iran war] [Oil Prices Surge]`).

### Current Architecture
- **Backend:** Flask (Python) — serves `index.html` with JSON injected via string replacement. Two routes: `/` (HTML) and `/news` (raw JSON).
- **Frontend:** Vanilla JavaScript + CSS. Recursive `jsonToHTML()` builds nested `<ul>/<li>` with `+`/`-` expand/collapse toggles. Alternating dark gray rows (`news1`/`news2`).
- **Data source:** `latest_news.json` fetched from S3 (or local file). Metadata from `latest_news_metadata.json`.
- **No build tools, no framework, no tests.**

### Key Files
```
newvelles_web/
├── index.html                       # Entry point (template with placeholders)
├── newvelles_web/
│   ├── app.py                       # Flask app, routes, JSON injection
│   ├── latest_news.py               # Fetches & escapes news JSON
│   ├── metadata.py                  # Fetches timestamp/version metadata
│   └── static/
│       ├── index.js                 # Recursive JSON→HTML renderer
│       └── style.css                # Dark theme, alternating rows
├── run.py                           # Dev server launcher
└── requirements.txt                 # Flask dependencies
```

### JSON Data Format (unchanged)
```json
{
  "[Tag A] [Tag B] [Tag C]": {
    "[Sub-tag X] [Sub-tag Y]": {
      "Article Headline": {
        "title": "Article Headline",
        "link": "https://...",
        "timestamp": "Wed, 11 Mar 2026 09:44:07 +0000",
        "source": "https://rss.feed.url"
      }
    }
  }
}
```
- **Level 1 keys** — grouping labels (bracket-delimited keyword phrases)
- **Level 2 keys** — sub-grouping labels (same bracket format)
- **Level 3 keys** — article titles, with `{title, link, timestamp, source}` objects

**Scale:** ~179 groupings, ~241 sub-groupings, ~672 articles in a typical fetch.

### Critical Data Quirks Claude Code Must Know

**The `title` key is intentionally skipped by the renderer.** At Level 3, the article's title is used as the JSON key itself. The object under it repeats the title as `"title": "..."` — this is redundant and the current `index.js` explicitly `continue`s past it. The new data model should treat Level 3 keys as the article title and ignore the `title` field inside the object.

**`source` is an RSS feed URL, not a publisher domain.** Example: `"source": "https://rss.nytimes.com/services/xml/rss/nyt/World.xml"`. To display a human-readable publisher name in the article list, parse the domain from the `link` URL (e.g. `"link": "https://www.nytimes.com/..."` → `"nytimes.com"`), not from `source`.

**Empty string `""` is a valid Level 1 key.** Some articles are grouped under an empty string key. The UI must skip or gracefully handle this (e.g. render as "Uncategorized" or omit entirely).

**Keys have already had quotes stripped.** The backend `_escape_news()` function removes all `"` and `'` characters from keys before the frontend sees the data. Tag parsing should not need to handle quoted strings, but should be resilient to missing or malformed brackets.

---

## Design Requirements

1. **Hierarchical drill-down:** Top groupings → sub-groupings → articles. Each level is a distinct view/state, not just a nested list.
2. **Tag/bubble presentation:** Each bracket-delimited phrase within a grouping name is rendered as an individual tag/pill/bubble (e.g. `[Trump Iran war]` becomes a styled pill).
3. **Newspaper-inspired color palette:** Sober, professional. Think warm off-white backgrounds, dark serif headings, muted accent colors. No dark theme.
4. **Live search/filter bar:** A top search bar that filters groupings in real time (typeahead) — hides groupings whose tags don't match the typed query.
5. **Testing framework:** Set up automated tests (unit + integration + visual) so changes can be validated iteratively.

---

## Phase 0 — Project Scaffolding & Testing Foundation

**Goal:** Modernize the frontend toolchain and establish a testing framework before changing any UI.

### 0.1 — Initialize a Modern Frontend Build
- Add a `package.json` at the project root.
- Install a lightweight bundler. **Recommendation: Vite** — fast, zero-config for vanilla JS, easy to add frameworks later.
- Configure Vite to serve the frontend with hot-reload during development. **Vite default port is 5173.**
- The Flask backend continues to serve `/news` as a JSON API endpoint. **Flask runs on port 5001** (see `app.py` `main()` — despite the README saying 5000, the actual code uses 5001).
- Configure Vite proxy in `vite.config.js` to forward `/news` and `/metadata` requests to `http://localhost:5001` during development — this avoids CORS issues.
- Add Flask-CORS (`pip install flask-cors`) and enable it on the `/news` and `/metadata` routes as a fallback for environments where the proxy isn't used.
- Refactor `index.html` to load a module entry point (`src/main.js`) instead of inline scripts.
- **Preserve the Google Analytics tag** (`G-GVR5XY6198`) in the new `index.html`.

### 0.2 — Decouple Data Fetching
- Create `src/api.js` — a module that fetches `/news` and `/metadata` via `fetch()`.
- Remove the server-side `news_json` / `news_metadata` string replacement pattern from `app.py`. Instead, the Flask `/` route serves the static HTML shell, and JavaScript fetches data on load.
- Add a `/metadata` route to `app.py` that returns the metadata JSON directly (currently the metadata is only injected into the HTML string — it needs its own endpoint).
- This decoupling makes the frontend testable independently of Flask.
- **For local dev without S3:** The backend supports a `local: True` flag in `newvelles_web/config/newvelles-web.ini`. When set, it reads from `./data/latest_news.json` and `./data/latest_news_metadata.json`. Ensure this local data directory exists for offline development and testing.

### 0.3 — Set Up Testing Framework
- **Unit tests:** Install **Vitest** (Vite-native, Jest-compatible API). Create `tests/unit/` directory.
- **DOM/integration tests:** Install **@testing-library/dom** and **jsdom** (Vitest environment). Create `tests/integration/` directory.
- **End-to-end tests:** Install **Playwright**. Create `tests/e2e/` directory.
- Add npm scripts: `test`, `test:unit`, `test:integration`, `test:e2e`.
- Write initial smoke tests:
  - Unit: `parseGroupingTags("[Tag A] [Tag B]")` returns `["Tag A", "Tag B"]`.
  - Integration: Given sample JSON, the renderer produces the correct DOM structure.
  - E2E: Page loads, groupings are visible, clicking a grouping navigates to sub-groupings.

### 0.4 — Sample Data Fixture
- Create `tests/fixtures/sample_news.json` — a small representative subset (~5 groupings, ~10 sub-groupings, ~20 articles) extracted from a real `latest_news.json`.
- The fixture **must include an empty string `""` grouping key** to test edge case handling.
- The fixture **must include a grouping with a single-tag label** (e.g. `"[Single Topic]"`) and one with multiple tags.
- All tests use this fixture for deterministic results.

### Deliverables
- `package.json` with Vite, Vitest, Playwright, testing-library
- `vite.config.js`
- `src/main.js`, `src/api.js`
- `tests/` directory with initial smoke tests passing
- Updated `index.html` (module-based, no inline scripts)
- Flask `/` route simplified to serve static HTML

---

## Phase 1 — Data Layer & Tag Parsing

**Goal:** Build a clean data abstraction layer that parses the JSON into structured objects, and extract individual tags from bracket-delimited strings.

### 1.1 — Tag Parser Utility
- Create `src/utils/tagParser.js`.
- Function `parseTags(bracketString)` → extracts individual phrases from bracket-delimited keys.
  - Input: `"[Trump Iran war] [Oil Prices Surge]"`
  - Output: `["Trump Iran war", "Oil Prices Surge"]`
- Handle edge cases: empty strings, missing brackets, extra whitespace.
- Write thorough unit tests for this module.

### 1.2 — Data Model
- Create `src/data/newsStore.js`.
- Parse raw JSON into a structured array:
  ```js
  [
    {
      id: "grouping-0",
      rawLabel: "[Tag A] [Tag B]",
      tags: ["Tag A", "Tag B"],
      subGroupings: [
        {
          id: "sub-0-0",
          rawLabel: "[Sub X] [Sub Y]",
          tags: ["Sub X", "Sub Y"],
          articles: [
            { title: "...", link: "...", timestamp: Date, source: "..." }
          ]
        }
      ]
    }
  ]
  ```
- Provide accessor functions: `getAllGroupings()`, `getSubGroupings(groupingId)`, `getArticles(subGroupingId)`.
- Write unit tests for data parsing and accessors.

### 1.3 — Search/Filter Logic
- Create `src/data/searchFilter.js`.
- Function `filterGroupings(groupings, query)` — returns groupings where any tag (or sub-grouping tag, or article title) contains the query string (case-insensitive).
- The filter is progressive: as more characters are typed, fewer groupings match.
- Write unit tests with various query strings, including partial matches, multi-word queries, and empty queries.

### Deliverables
- `src/utils/tagParser.js` + tests
- `src/data/newsStore.js` + tests
- `src/data/searchFilter.js` + tests

---

## Phase 2 — UI Component Architecture

**Goal:** Build the new component-based UI with drill-down navigation, tag bubbles, and the newspaper aesthetic.

### 2.1 — Design System & Stylesheet

Create `src/styles/` with the newspaper-inspired design system:

**Color Palette:**
```
--bg-primary:       #FAF8F5    (warm off-white, like aged paper)
--bg-secondary:     #F0EDE8    (slightly darker for cards/sections)
--bg-accent:        #E8E4DD    (hover states, subtle emphasis)
--text-primary:     #1A1A1A    (near-black for headlines)
--text-secondary:   #4A4A4A    (body text, secondary info)
--text-tertiary:    #8A8A8A    (timestamps, metadata)
--accent-primary:   #8B0000    (dark red — newspaper masthead accent)
--accent-secondary: #2F4F4F    (dark slate — links, interactive elements)
--border:           #D5D0C8    (subtle warm gray borders)
--tag-bg:           #EDEBE7    (tag bubble background)
--tag-border:       #C8C3BA    (tag bubble border)
--tag-text:         #3A3A3A    (tag bubble text)
```

**Typography:**
```
--font-headline:    "Playfair Display", "Georgia", serif
--font-body:        "Source Serif Pro", "Georgia", serif
--font-ui:          "Inter", "Helvetica Neue", sans-serif
--font-mono:        "JetBrains Mono", monospace
```

- Load Google Fonts: Playfair Display (700), Source Serif Pro (400, 600), Inter (400, 500).
- Define CSS custom properties for the palette and typography.
- Style foundations: reset, base typography, spacing scale.

### 2.2 — Layout Shell
- Create `src/components/App.js` — top-level layout.
- Structure:
  ```
  ┌──────────────────────────────────────────┐
  │  MASTHEAD: "newvelles" + metadata date   │
  ├──────────────────────────────────────────┤
  │  SEARCH BAR                              │
  ├──────────────────────────────────────────┤
  │  BREADCRUMB: Home > [Grouping] > [Sub]   │
  ├──────────────────────────────────────────┤
  │                                          │
  │  CONTENT AREA (swaps by navigation)      │
  │                                          │
  └──────────────────────────────────────────┘
  │  FOOTER: metadata, source info           │
  └──────────────────────────────────────────┘
  ```
- Implement simple client-side routing (hash-based or state-based, no library needed) to switch between views.

### 2.3 — Grouping Cards View (Level 1 — Home)
- Create `src/components/GroupingCard.js`.
- Each grouping is a card containing its tags as pills/bubbles.
- Tag bubble styling: rounded corners, subtle border, newspaper-muted background, small serif or sans-serif text.
- Cards arranged in a responsive CSS Grid (2–3 columns on desktop, 1 on mobile).
- Each card shows: tag bubbles + article count badge (e.g. "12 articles").
- Clicking a card navigates to the sub-grouping view for that grouping.
- On hover: subtle elevation/shadow change.

### 2.4 — Sub-Grouping View (Level 2)
- Create `src/components/SubGroupingView.js`.
- Shows the parent grouping's tags as large pills at the top (contextual header).
- Below, sub-groupings displayed as smaller cards, each with their own tag bubbles and article count.
- Clicking a sub-grouping card reveals its articles.
- "Back" navigation via breadcrumb or back arrow.

### 2.5 — Article List View (Level 3)
- Create `src/components/ArticleList.js`.
- Shows parent grouping + sub-grouping context at the top.
- Articles displayed as a clean list:
  - Headline (serif font, dark, linked)
  - Publisher domain — **extract from `link` URL** (e.g. `new URL(article.link).hostname.replace('www.', '')` → `"nytimes.com"`), not from the `source` field which is the RSS feed URL
  - Relative timestamp ("2 hours ago") parsed from the `timestamp` RFC-format string
  - Subtle separator between items
- Links open in new tab.
- **Note on the Level 3 key:** The article title is the JSON key at Level 3. The `title` field inside the object is identical and should be ignored — use the key as the display title.

### 2.6 — Search Bar Component
- Create `src/components/SearchBar.js`.
- Sticky at top, below masthead.
- Input with typeahead filtering — on each keystroke, calls `filterGroupings()` and re-renders the grouping cards view.
- Shows match count: "Showing 23 of 179 groupings".
- Clear button (×) to reset filter.
- Debounce input at ~150ms for performance.
- When search is active and user is in a sub-view, navigating back to home preserves the search query.

### 2.7 — Breadcrumb Navigation
- Create `src/components/Breadcrumb.js`.
- Shows navigation path: `Home > [Grouping tags] > [Sub-grouping tags]`.
- Each segment is clickable to navigate back to that level.
- Tags within breadcrumb rendered as mini-pills for consistency.

### Deliverables
- Complete component set in `src/components/`
- `src/styles/` with design system CSS
- Responsive layout working across desktop/tablet/mobile
- Integration tests for each component (given data, produces correct DOM)
- E2E tests: full drill-down flow, search filtering, breadcrumb navigation

---

## Phase 3 — Interaction Polish & Animations

**Goal:** Add micro-interactions and transitions for a refined experience.

### 3.1 — View Transitions
- Smooth fade or slide transitions when navigating between grouping levels.
- CSS transitions on card hover (subtle shadow lift).
- Tag bubbles: slight scale on hover.

### 3.2 — Search UX Enhancements
- Highlight matching text within tag bubbles when search is active.
- Animate cards appearing/disappearing as filter changes (CSS transitions on opacity/transform).
- Keyboard navigation: arrow keys to move between grouping cards, Enter to drill in.

### 3.3 — Loading & Empty States
- Skeleton loading cards while JSON is fetched.
- Empty state when search yields no results ("No groupings match your search").
- Error state if data fetch fails.

### 3.4 — Accessibility
- Semantic HTML: `<nav>`, `<main>`, `<article>`, `<header>`, `<footer>`.
- ARIA labels on interactive elements (tag bubbles, search, navigation).
- Focus management when navigating between views.
- Keyboard-navigable throughout.
- Color contrast meets WCAG AA.

### Deliverables
- CSS transition/animation styles
- Loading skeleton component
- Empty/error state components
- Accessibility audit passing (axe-core via Playwright)
- Updated E2E tests covering transitions and edge cases

---

## Phase 4 — Backend Integration & Deployment ✅ COMPLETE

**Goal:** Ensure the new frontend works seamlessly with the existing Flask backend and deployment pipeline.

**Status:** Completed 2026-04-19

### 4.1 — Flask Route Updates ✅
- ✅ Updated `app.py`:
  - `/` serves the Vite-built `index.html` from `dist/` (with fallback for development)
  - `/news` returns JSON API (unchanged from original implementation)
  - `/metadata` returns `{"datetime": "...", "version": "..."}` as JSON
  - **NEW:** `/health` endpoint for deployment health checks
    - Validates S3 data access
    - Returns news grouping count, metadata version, timestamp
    - Used by `bin/health-check.sh` for deployment verification
- ✅ Configured Flask to serve Vite build output from `dist/` as static files
  - Static folder configured: `Flask(__name__, static_folder='dist', static_url_path='')`
  - Development mode falls back to root `index.html` if `dist/` not found
- ✅ CORS enabled on `/news`, `/metadata`, and `/health` endpoints

### 4.2 — Build Pipeline ✅
- ✅ Vite build step: `npm run build` → outputs to `dist/`
- ✅ Updated `Dockerfile` with **multi-stage build**:
  - **Stage 1:** Node.js 18 Alpine — builds Vite frontend
  - **Stage 2:** Python 3.11 Alpine — Flask backend + built frontend from Stage 1
  - Includes HEALTHCHECK directive calling `/health` endpoint
  - Production-ready image with optimized layers
- ✅ Created `.dockerignore` to optimize build context (excludes node_modules, tests, git, etc.)
- ✅ S3 fetching continues to work correctly (unchanged)

### 4.3 — Performance ✅
- ✅ Lazy-rendering implemented (sub-groupings expand in-place, articles only render when opened)
- ✅ Minified CSS/JS via Vite production build
- ✅ Google Fonts preloaded in `index.html` to avoid FOUT
- ✅ Debounced search (150ms) prevents excessive re-renders
- ✅ Staggered card animations (50ms delay) limit CSS overhead to first 6 cards

### 4.4 — Production Deployment Strategy ✅ (NEW)

**Manual script-based deployment designed for simplicity, reliability, and zero additional costs.**

#### Deployment Scripts
- ✅ **`bin/deploy.sh`** (~250 lines) — Complete deployment orchestration
  - Runs tests (optional with `--skip-tests`)
  - Builds Vite frontend (`npm run build`)
  - Generates version tag: `{git-sha}-{timestamp}`
  - Builds Docker image with multi-stage Dockerfile
  - Pushes to AWS Lightsail Container Service
  - Deploys to production
  - Waits for deployment completion (30 attempts × 10s polling)
  - Runs comprehensive health checks
  - Saves deployment metadata to `.deployments/`
  - Options: `--skip-tests`, `--tag VERSION`, `--force`
  - **Duration:** 6-8 minutes (4-5 without tests)

- ✅ **`bin/health-check.sh`** (~180 lines) — Triple health verification
  - **Check 1:** AWS Lightsail service status (RUNNING/ACTIVE)
  - **Check 2:** `/health` endpoint (validates S3 data, returns status/version)
  - **Check 3:** `/` homepage (200 OK)
  - **Check 4:** `/news` API (returns data)
  - **Check 5:** `/metadata` API (returns version info)
  - Each check: 10 retry attempts × 10s delay
  - JSON response validation with `jq`
  - Verbose mode with `--verbose` flag
  - **Exit codes:** 0 = success, 1 = failure

- ✅ **`bin/rollback.sh`** (~280 lines) — One-command rollback mechanism
  - Lists available deployments from `.deployments/` directory
  - Interactive menu for version selection
  - Rollback to previous: `--previous` flag
  - Rollback to specific version: `--version VERSION` flag
  - List only: `--list` flag
  - Confirmation prompt (skip with `--force`)
  - Redeploys selected version from Lightsail
  - Runs health checks after rollback
  - Updates `current.json` symlink
  - **Duration:** 2-4 minutes

#### Deployment Metadata Tracking
- ✅ **`.deployments/` directory** (gitignored)
  - Each deployment saves JSON metadata:
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
  - `current.json` symlink points to active deployment
  - Enables rollback to last 10 deployments
  - Audit trail for deployment history

#### Infrastructure Files
- ✅ **`.dockerignore`** — Optimizes Docker build context
  - Excludes: node_modules, tests, .git, deployment artifacts, logs, IDE files
- ✅ **`.gitignore` updates** — Added deployment artifacts
  - `.deployments/`, `containers-*.json`, test results, node_modules, dist/

#### Comprehensive Documentation
- ✅ **`docs/DEPLOYMENT_STRATEGY.md`** (~400 lines)
  - Complete strategy overview and architecture diagrams
  - Technical decisions and trade-offs (manual vs CI/CD, downtime acceptance, etc.)
  - Full deployment flow with timing breakdown
  - Health check strategy (triple verification approach)
  - Rollback strategy and metadata management
  - Security considerations and cost analysis ($7/month total)
  - Future improvements roadmap

- ✅ **`docs/DEPLOYMENT_GUIDE.md`** (~350 lines)
  - Step-by-step deployment procedures
  - Prerequisites and setup instructions
  - Deployment options (skip tests, custom tags, force mode)
  - Detailed phase-by-phase walkthrough with expected output
  - Verification procedures
  - Troubleshooting guide (6 common issues with solutions)
  - Common scenarios (hotfix, new feature, rollback, first-time deployment)
  - Quick reference tables and commands

- ✅ **`docs/ROLLBACK_GUIDE.md`** (~250 lines)
  - When to rollback (immediate vs. forward fix decision matrix)
  - Quick rollback for emergencies (`--previous --force`)
  - Rollback methods (previous, interactive, specific version)
  - Step-by-step rollback walkthrough
  - Verification after rollback
  - Troubleshooting rollback issues (6 common issues)
  - Emergency procedures (site down, multiple failed rollbacks, data corruption)
  - Post-rollback actions and best practices

### Key Technical Decisions

**Manual Deployment vs CI/CD:**
- ✅ **Decision:** Manual script-based deployment
- **Rationale:** Zero additional costs, no CI/CD complexity, low deployment frequency (~1-2/week)
- **Trade-off:** Manual execution required, but full control and transparency

**Downtime Acceptance:**
- ✅ **Decision:** Accept 30-60 seconds downtime during deployment
- **Rationale:** 50% cost savings ($7/month vs $14/month for blue-green), news aggregator use case
- **Trade-off:** Brief downtime acceptable for non-mission-critical application

**Docker Multi-Stage Build:**
- ✅ **Decision:** Separate Node.js (Vite) and Python (Flask) stages
- **Rationale:** Smaller final image, reproducible builds, optimized layers
- **Result:** Final image contains only Python runtime + built frontend (no Node.js)

**Health Check Strategy:**
- ✅ **Decision:** Triple verification (Lightsail + 4 endpoints)
- **Rationale:** High confidence in deployment success, catches both infrastructure and application issues
- **Implementation:** 10 retries × 10s delay per check, handles transient failures

**Rollback Mechanism:**
- ✅ **Decision:** Metadata-based rollback via Lightsail API
- **Rationale:** No extra infrastructure, fast execution (2-4 min), can rollback to last 10 deployments
- **Implementation:** Store metadata in `.deployments/`, query Lightsail for container images

### Deliverables
- ✅ Updated `app.py` with `/health` endpoint and `dist/` serving
- ✅ `vite.config.js` with dev proxy to Flask (port 5001)
- ✅ Multi-stage `Dockerfile` (Node.js + Python)
- ✅ `.dockerignore` and `.gitignore` updates
- ✅ Three deployment scripts (deploy, health-check, rollback)
- ✅ Deployment metadata tracking system
- ✅ Three comprehensive documentation guides (1000+ lines total)
- ✅ Production-ready deployment strategy

### Infrastructure Summary

**AWS Lightsail Container Service:**
- Service: `newvelles-web-service`
- Region: `us-west-2`
- Instance: Micro (512MB RAM, 0.25 vCPU)
- Cost: $7/month
- Public endpoint: `https://newvelles.com`
- Container port: 5000 → HTTP

**Deployment Flow:**
1. Run tests (106 tests: 71 unit + 8 integration + 27 E2E)
2. Build Vite frontend → `dist/`
3. Build Docker image (multi-stage)
4. Push to Lightsail
5. Deploy to production
6. Wait for RUNNING/ACTIVE status
7. Run 5 health checks with retries
8. Save metadata to `.deployments/`

**Rollback Flow:**
1. List available versions from `.deployments/`
2. Select target version (previous or specific)
3. Confirmation prompt
4. Redeploy container image from Lightsail
5. Wait for RUNNING/ACTIVE status
6. Run health checks
7. Update `current.json` symlink

### Performance Benchmarks
- **Deployment time:** 6-8 minutes (full), 4-5 minutes (skip tests)
- **Rollback time:** 2-4 minutes
- **Downtime:** 30-60 seconds during deployment
- **Health check coverage:** 5 checks (1 infrastructure + 4 endpoints)
- **Test coverage:** 106 tests passing

---

## Phase 5 — Comprehensive Testing & QA

**Goal:** Full test coverage and documentation of the testing approach.

### 5.1 — Test Coverage Targets
- **Unit tests (Vitest):** ≥90% coverage on `src/utils/` and `src/data/`.
- **Integration tests (testing-library):** Every component renders correctly given various data shapes (empty, single item, many items, long tag names).
- **E2E tests (Playwright):**
  - Full navigation flow: home → grouping → sub-grouping → article click.
  - Search: type query → verify filtering → clear → verify reset.
  - Breadcrumb navigation at every level.
  - Responsive: run on desktop and mobile viewports.
  - Accessibility: axe-core checks on every view.

### 5.2 — Testing Guide for Claude Code

**Running tests:**
```bash
# All tests
npm test

# Unit tests only (fast, run frequently)
npm run test:unit

# Integration tests (DOM rendering)
npm run test:integration

# E2E tests (full browser, slower)
npm run test:e2e

# Coverage report
npm run test:coverage
```

**Writing new tests:**

*Unit test example (`tests/unit/tagParser.test.js`):*
```js
import { describe, it, expect } from 'vitest';
import { parseTags } from '../../src/utils/tagParser.js';

describe('parseTags', () => {
  it('extracts tags from bracket-delimited string', () => {
    expect(parseTags('[Tag A] [Tag B]')).toEqual(['Tag A', 'Tag B']);
  });

  it('handles single tag', () => {
    expect(parseTags('[Single Tag]')).toEqual(['Single Tag']);
  });

  it('returns empty array for empty string', () => {
    expect(parseTags('')).toEqual([]);
  });

  it('handles extra whitespace', () => {
    expect(parseTags('  [Tag A]   [Tag B]  ')).toEqual(['Tag A', 'Tag B']);
  });
});
```

*Integration test example (`tests/integration/groupingCard.test.js`):*
```js
import { describe, it, expect } from 'vitest';
import { renderGroupingCard } from '../../src/components/GroupingCard.js';

describe('GroupingCard', () => {
  it('renders tag bubbles for each tag', () => {
    const container = document.createElement('div');
    const grouping = {
      id: 'g-0',
      tags: ['Trump Iran war', 'Oil Prices'],
      subGroupings: [{ articles: [{}, {}] }, { articles: [{}] }]
    };

    renderGroupingCard(container, grouping);

    const bubbles = container.querySelectorAll('.tag-bubble');
    expect(bubbles.length).toBe(2);
    expect(bubbles[0].textContent).toBe('Trump Iran war');
    expect(bubbles[1].textContent).toBe('Oil Prices');
  });

  it('shows article count', () => {
    const container = document.createElement('div');
    const grouping = {
      id: 'g-0',
      tags: ['Test'],
      subGroupings: [{ articles: [{}, {}, {}] }]
    };

    renderGroupingCard(container, grouping);

    expect(container.textContent).toContain('3 articles');
  });
});
```

*E2E test example (`tests/e2e/navigation.spec.js`):*
```js
import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
  });

  test('loads and displays grouping cards', async ({ page }) => {
    const cards = page.locator('.grouping-card');
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('clicking a grouping card shows sub-groupings', async ({ page }) => {
    await page.locator('.grouping-card').first().click();
    await expect(page.locator('.sub-grouping-card').first()).toBeVisible();
    await expect(page.locator('.breadcrumb')).toContainText('Home');
  });

  test('search filters groupings in real time', async ({ page }) => {
    const searchInput = page.locator('.search-input');
    const initialCount = await page.locator('.grouping-card').count();

    await searchInput.fill('oil');
    await page.waitForTimeout(200); // debounce

    const filteredCount = await page.locator('.grouping-card').count();
    expect(filteredCount).toBeLessThan(initialCount);
    expect(filteredCount).toBeGreaterThan(0);
  });

  test('breadcrumb navigates back to previous levels', async ({ page }) => {
    // Drill into a grouping
    await page.locator('.grouping-card').first().click();
    await expect(page.locator('.sub-grouping-card').first()).toBeVisible();

    // Click Home in breadcrumb
    await page.locator('.breadcrumb a').filter({ hasText: 'Home' }).click();
    await expect(page.locator('.grouping-card').first()).toBeVisible();
  });
});
```

**Iterative testing workflow for Claude Code:**
1. After making any UI change, run `npm run test:unit` and `npm run test:integration`.
2. After completing a full feature, run `npm run test:e2e`.
3. If a test fails, read the error output, fix the issue, re-run only the failing test file.
4. Before declaring a phase complete, run the full suite: `npm test`.
5. For visual verification, you can use Playwright screenshots:
   ```js
   await page.screenshot({ path: 'screenshots/home.png', fullPage: true });
   ```

### 5.3 — Visual Regression (Optional Enhancement)
- Use Playwright's built-in screenshot comparison for visual regression testing.
- Capture baseline screenshots after Phase 2 is stable.
- Compare against baseline after each subsequent change.

### Deliverables
- Full test suite with ≥90% unit coverage
- E2E tests covering all user flows
- CI-ready test scripts in `package.json`

---

## Implementation Order & Dependencies

```
Phase 0 (Scaffolding)        ← START HERE — no UI changes yet
    ↓
Phase 1 (Data Layer)         ← Pure logic, fully testable
    ↓
Phase 2 (UI Components)      ← The big visual redesign
    ↓
Phase 3 (Polish)             ← Enhancements on top of working UI
    ↓
Phase 4 (Integration)        ← Backend wiring + deployment
    ↓
Phase 5 (QA)                 ← Final validation pass
```

Each phase should be completed and tested before moving to the next. Within each phase, tackle the sub-tasks in the numbered order — they build on each other.

---

## Notes for Claude Code

- **Do not modify the JSON data format.** The backend produces `latest_news.json` in the three-level nested structure described above. The frontend must consume it as-is.
- **Keep the Flask backend minimal.** It serves the built frontend files and provides `/news` and `/metadata` JSON endpoints. No server-side rendering needed.
- **Vanilla JS is fine.** No need to introduce React/Vue/Svelte unless the complexity warrants it. The component architecture can be achieved with ES modules and DOM manipulation.
- **Test iteratively.** After each sub-task, run the relevant tests. Fix failures before moving on.
- **Consult the fixture data** in `tests/fixtures/sample_news.json` when unsure about data shapes.
- **The source repo** is at `/Users/gastonlhuillier/Personal/newvelles_web`. A reference copy of `latest_news.json` is also available one directory up.
- **Flask port is 5001**, Vite dev server is 5173. Never hardcode 5000.
- **Preserve the Google Analytics ID** `G-GVR5XY6198` in the new `index.html`.
- **Preserve the footer attribution** linking to `https://glhuilli.github.io/` and `https://glhuilli.github.io/newvelles.html`. Update the copyright year from 2023 to current.
- **The `title` key inside Level 3 objects is always redundant** — the JSON key and `title` value are identical. Use the key; ignore `title`.
- **`source` = RSS feed URL.** To show publisher name, parse `link` domain instead.
- **Empty string `""` grouping** — skip or label "Uncategorized"; never crash on it.
- **For local dev without S3:** set `local: True` in `newvelles_web/config/newvelles-web.ini` and place data files in `./data/`. Copy `latest_news.json` there as a starting point.
