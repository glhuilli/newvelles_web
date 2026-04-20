# Newvelles — Project Context

This file is the permanent reference document for the Newvelles project. Keep it up to date as the project evolves. It is intended to be read by both humans and AI coding assistants before making any changes.

---

## What Is Newvelles?

Newvelles is a personal news digest tool. It fetches articles from RSS feeds, groups them thematically using an NLP/clustering pipeline (separate project), and presents the grouped results as a browsable web page at **newvelles.com**.

The core idea: instead of reading individual articles, you see clusters of related stories organized by keyword "tags" — giving a quick mental map of what's happening across many sources at once.

---

## Repository Overview

This repository (`newvelles_web`) is the **frontend + web server** only. It does not generate the news data — it consumes it.

```
newvelles_web/
├── index.html                        # HTML entry point (currently a template)
├── run.py                            # Dev server launcher: python run.py → localhost:5001
├── setup.py                          # Python package config
├── requirements.txt                  # Production Python deps
├── requirements_dev.txt              # Dev Python deps
├── Dockerfile                        # Container: Python 3.8-Alpine, exposes :5000
├── PROJECT_CONTEXT.md                # ← You are here
│
└── newvelles_web/                    # Main Python package
    ├── app.py                        # Flask app — routes, data injection
    ├── latest_news.py                # Fetches + sanitizes news JSON from S3 or local
    ├── metadata.py                   # Fetches timestamp/version metadata
    ├── config/
    │   └── newvelles-web.ini         # Runtime config (local: True/False)
    └── static/
        ├── index.js                  # Vanilla JS renderer (recursive JSON → HTML)
        └── style.css                 # Dark theme stylesheet
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Web server | Flask 2.0.1 (Python 3.8) |
| Frontend | Vanilla JavaScript (ES5), plain CSS |
| Data storage | AWS S3 (public bucket) |
| Deployment | Docker container |
| Analytics | Google Analytics (`G-GVR5XY6198`) |

There is currently **no build system, no package manager, and no test framework** on the frontend. This is intentional for the original version but is being addressed in the redesign (see `REDESIGN_PLAN.md`).

---

## How It Works — Data Flow

```
[Separate pipeline project]
        ↓
  latest_news.json  ──────────────────────────────────────────────────────────┐
  latest_news_metadata.json                                                   │
        ↓ uploaded to                                                         │
  AWS S3 (public-newvelles-data-bucket, us-west-2)                           │
        ↓ fetched by                                                          │
  newvelles_web/latest_news.py  ←── config: local=False (default)            │
  newvelles_web/metadata.py                                                   │
        ↓ sanitized by _escape_news() [strips all " and ' from keys]         │
        ↓ injected into HTML via string replacement (current approach)        │
  index.html → browser → index.js renders recursive <ul>/<li> tree           │
                                                                              │
  Local dev alternative: set local=True in config/newvelles-web.ini          │
  and place files in ./data/latest_news.json + ./data/latest_news_metadata.json
```

---

## Data Format

The data is a **three-level nested JSON object**. The format is fixed — do not change it.

```json
{
  "[Tag A] [Tag B] [Tag C]": {
    "[Sub-tag X] [Sub-tag Y]": {
      "Article Headline Here": {
        "title": "Article Headline Here",
        "link": "https://publisher.com/article-path",
        "timestamp": "Wed, 11 Mar 2026 09:44:07 +0000",
        "source": "https://rss.publisher.com/feed.xml"
      }
    }
  }
}
```

### Level 1 — Groupings
Top-level keys. Each is a space-separated sequence of `[bracket phrases]`, representing a cluster of related stories. Example: `"[Trump Iran war] [Oil Prices Surge] [Pentagon]"`.

### Level 2 — Sub-groupings
Second-level keys. Same bracket-phrase format, representing a more specific angle within the parent grouping.

### Level 3 — Articles
Third-level keys are the article headline (string). The value is an object with:
- `title` — identical to the key; **redundant, should be ignored by UI code**
- `link` — URL to the full article (use this to extract publisher domain)
- `timestamp` — publication time in RFC 2822 format with timezone offset
- `source` — the RSS feed URL the article came from (**not** the publisher's website)

### Important Edge Cases
- An **empty string `""`** can appear as a Level 1 key. Handle gracefully (skip or label "Uncategorized").
- Keys have already had `"` and `'` characters **stripped** by `_escape_news()` before reaching the frontend.
- There is no guaranteed sort order for keys at any level.

### Typical Scale (as of early 2026)
~180 groupings, ~240 sub-groupings, ~670 articles per daily fetch.

---

## Running Locally

### Prerequisites
- Python 3.8+
- pip

### Steps
```bash
# Clone and install
cd newvelles_web
pip install -r requirements.txt

# Option A: use live S3 data (default)
python run.py
# → http://localhost:5001

# Option B: use local data (no S3 needed)
# 1. Edit newvelles_web/config/newvelles-web.ini → set local: True
# 2. Place data files:
#    ./data/latest_news.json
#    ./data/latest_news_metadata.json
python run.py
```

### Ports
- **Flask dev server: `localhost:5001`** (defined in `app.py main()`)
- Note: the README incorrectly states port 5000; the actual code uses 5001.

---

## Flask Routes

| Route | Method | Description |
|---|---|---|
| `/` | GET | Serves `index.html` with data injected via string replacement |
| `/news` | GET | Returns the raw news JSON (same data, no HTML) |

The `/metadata` endpoint does not currently exist as a standalone route — metadata is only injected into the HTML. Adding it as a proper JSON route is on the roadmap (Phase 4 of the redesign).

---

## Frontend — Current Implementation

`newvelles_web/static/index.js` contains a single curried recursive function `jsonToHTML(input)(show)(htmlToString)` that walks the JSON tree and builds nested `<ul>/<li>` HTML strings. Key behaviors:

- Level 1 and Level 2 nodes get alternating CSS classes (`news1` / `news2`) for background color striping.
- Each node has a `+` span that toggles its child `<ul>` between `display:none` and `display:block`.
- At Level 3, the `link` value is rendered as an `<a>` tag. The `title` key is **explicitly skipped** (`continue`). Other fields (`timestamp`, `source`) are shown as labeled spans.
- The function is called with `show=true` for the top level (visible by default) and `show=false` for all nested levels (collapsed by default).

`newvelles_web/static/style.css` uses a dark gray theme (`#404040` / `#616161` alternating rows, `#757575` body background, `Gainsboro` text) with the 'Play' sans-serif font. A fixed black header and footer display metadata and attribution.

---

## Deployment

The app runs as a Docker container. The `Dockerfile` uses `python:3.8-alpine`, exposes port 5000, and starts Flask via `python ./run.py`.

Live site: **https://newvelles.com**

---

## Analytics

Google Analytics 4 is embedded in `index.html`:
- **Measurement ID: `G-GVR5XY6198`**
- Must be preserved in any redesign of `index.html`.

---

## Footer Attribution

The current footer links must be preserved (content, not necessarily exact styling):
- Author link: `https://glhuilli.github.io/` — displayed as `@glhuilli`
- Project writeup: `https://glhuilli.github.io/newvelles.html`
- Copyright line (update year as appropriate)

---

## What Is NOT in This Repo

- The **RSS feed fetching and NLP clustering pipeline** that generates `latest_news.json` — that lives in a separate project.
- The **S3 upload logic** for the data files.
- Any **DNS / hosting configuration** for newvelles.com.

---

## Planned Changes

See `REDESIGN_PLAN.md` (in the `newvelles` data folder, one level up) for the full phased UI/UX redesign plan. High-level summary:

- Introduce Vite build system + Vitest + Playwright testing
- Decouple frontend from Flask string injection (fetch JSON via API)
- Redesign UI: tag/bubble groupings, newspaper color palette, drill-down navigation, live search/filter bar
- Add `/metadata` Flask route
- Add CORS headers for dev environment

The JSON data format remains unchanged throughout.
