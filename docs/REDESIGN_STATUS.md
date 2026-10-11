# Redesign Status — newvelles_web

_Last updated: 2026-08-17, at the completion of the M5 cutover swap._

## Current architecture (live in production)

- **`/` serves the redesigned board+wire** (`redesign.html` + `src/redesign/`),
  live at newvelles.com since 2026-08-17.
- **`/classic` serves the previous three-level UI** (`index.html` + `src/`)
  during the transition; `/redesign.html` also still serves for old links.
- Flask (`newvelles_web/app.py`) serves the Vite `dist/` and proxies data:
  `/news` + `/metadata` (legacy, from `latest_news.json`) and
  `/stories.json` + `/momentum.json` (redesign, schema 0.3.0, proxied from
  the public bucket; `newvelles_web/stories.py`).
- Deployed as a Docker container on **Lightsail**
  (`newvelles-web-service`, us-west-2); the Dockerfile bakes
  `VITE_NV_DATA_SOURCE=live` into the production redesign bundle.

## The redesign code (`src/redesign/`)

- `data.js` — pure selectors (join stories+momentum by id, search over
  headlines/article titles/outlets/keywords, section+keyword filters,
  rank/newest/most-covered sorts, board model, sparkline math). Fully
  unit-tested; **filter counts always reflect the current result set** (the
  bug called out in the design review is a regression test).
- `state.js` — the six state vars from the handoff
  (view/query/cat/keyword/sort/open) + the specified transitions.
- `render.js` + `styles.css` — Nocturne tokens verbatim; all dynamic text
  escaped; search keeps focus/caret across re-renders; mobile per spec.
- Board shows `kind=="story"` only (top-N by rank); deals & roundups live
  behind the wire's "Roundups & deals" pill. Credit footer links to
  glhuilli.github.io.
- Contract fixtures live in `data/fixtures/` (force-added past the `data/`
  gitignore — they are the cross-repo contract with the backend).

## Data source modes (`src/redesign/main.js`)

| Mode | Flag | Reads |
|---|---|---|
| fixture (default in dev) | — | `data/fixtures/*_v0.3.0.json` (12-feed QA sample) |
| local preview | `VITE_NV_DATA_SOURCE=local` | `data/local/*.json` — your own pipeline output |
| live (production) | `VITE_NV_DATA_SOURCE=live` | `/stories.json` + `/momentum.json` |

Production-fidelity local preview: in the backend repo run
`NEWVELLES_NAMING_PROVIDER=bedrock newvelles --rss_file data/rss_source.txt`
(~2 min, ~5¢), copy `stories.json momentum.json` into `data/local/`, then
`VITE_NV_DATA_SOURCE=local npm run dev` → http://localhost:5173/redesign.html.

## Deploying (`bin/deploy.sh`) — two required environment quirks

1. The Playwright e2e gate needs the Flask backend on **:5001** (the vite
   proxy target; note `run.py` listens on 5000):
   `python -c "from newvelles_web.app import app; app.run(port=5001)"`
2. aws CLI **v2** must win over any venv's v1 on PATH (v1 lacks
   `lightsail push-container-image`; `lightsailctl` lives in `~/.local/bin`):
   `PATH="/opt/homebrew/bin:$PATH" ./bin/deploy.sh`

Rollback: `bin/rollback.sh`.

## Remaining (deliberate, weeks out)

Once `/classic` has no audience: remove it and its `/news`/`/metadata`
dependencies here, which unblocks the backend retiring `latest_news.json` —
but only after the historical backfill exists (see the backend repo's
`docs/NEXT_STEPS.md`, which also carries the full next-steps roadmap:
RSS feed-health skill, research-papers vertical, 2021-present analysis).

## Analysis tab (2026-09-20, not deployed)

Header tab strip: Today / Wire / Analysis. The Analysis view lists entries from
`/analysis/index.json` and loads one payload per entry on demand
(`/analysis/entries/<id>/payload.json`), both proxied from the public bucket by
`newvelles_web/analysis.py`. Panels are the archive dashboard ported from
`newvelles/analysis/site/template.html` onto Nocturne (`src/redesign/analysis/`).
Design: `newvelles/docs/superpowers/specs/2026-09-19-analysis-tab-design.md`.

Local review with real data:

```
mkdir -p data/local/analysis/entries/five-years
cp ../newvelles/analysis/entries/index.json data/local/analysis/
cp ../newvelles/analysis/entries/five-years/payload.json data/local/analysis/entries/five-years/
VITE_NV_DATA_SOURCE=local npm run dev   # http://localhost:5173 → Analysis
```

Panels reviewed 2026-09-20: Timeline, Top stories, Archetypes, Categories.
Ledger, Lifetimes and Stats were retired; Top stories carries the coverage
curve. Publish the payload (`make publish-analysis ENTRY=five-years` in the
backend repo) before deploying this, or the tab 404s.

### Deep links (2026-09-20)

`src/redesign/hash.js` maps the hash to the view so other pages can link in:
`#wire`, `#analysis`, `#analysis/<panel>`, `#analysis/<entry>/<panel>`; the
board is the bare URL. Switching view pushes a history entry (Back works),
changing entry or panel replaces. An unrecognised hash is ignored, so an
ordinary anchor cannot change the view. Nothing links in from outside yet:
the entry's `links.post` stays empty until the methods post is published, and
the header renders no link (and no placeholder) while it is empty.

### Fixed header (2026-10-11)

The top bar (`renderHeader`) is title + tab strip + search, byte-identical in
all three views, `flex-wrap: nowrap`, with the search at a fixed 260px. Nothing
in it is sized by view-dependent text, so switching tabs moves it 0px — it used
to drag the tab strip 629px sideways and grow 53px taller on the wire.

Everything that varies lives in the context line below it
(`renderContextLine`): the dateline on the board, stories/articles/feeds plus
the sort controls on the wire, the archive span and counts on the analysis.
That line is where a richer run-metadata block should go.

One search box (`[data-search]`) serves every view. Typing from the board or
the analysis switches to the wire with the query applied; from the wire it
narrows in place. The placeholder names the behaviour per view.

### Publishing and proxy gotchas (2026-10-11, found pre-deploy)

Two failures that both looked like a clean success upstream:

1. **The public bucket has no bucket policy.** Objects are readable only via a
   per-object `public-read` ACL. The first `make publish-analysis` omitted it:
   upload fine, `s3 ls` and `head-object` fine, every public GET 403. Fixed in
   the backend's `scripts/publish_analysis.py` (#42).
2. **Those objects are stored gzipped** with `Content-Encoding: gzip`, and
   `urllib` does not decompress transparently the way a browser does, so the
   proxy read gzip bytes and 500'd. `newvelles_web/analysis.py` now
   decompresses on that header (or on the gzip magic number).
   `stories.json` never hit this because it is stored uncompressed.

A missing entry now returns 404 rather than 500: a key that is not in the
bucket raises `HTTPError`, which the route catches alongside
`FileNotFoundError` (the local-mode equivalent).

Rule both of these imply: after publishing, fetch the **public URL** and the
**proxy route**. A successful upload proves nothing.
