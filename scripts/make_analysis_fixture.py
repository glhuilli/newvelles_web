"""Trim a real analysis payload into the test fixture.

Usage: python3 scripts/make_analysis_fixture.py data/local/analysis/entries/five-years/payload.json
Writes data/fixtures/analysis/index.json and .../entries/five-years/payload.json (< 150 KB).
"""
import json
import sys
from pathlib import Path

src = Path(sys.argv[1])
d = json.loads(src.read_text(encoding="utf-8"))

daily = d["daily"][:120]
weekly = d["weekly"][:20]
events = d["events"][:3]
ledger = d["ledger"][:5]
first_major = next(iter(d["drill"]))
dv = d["drill"][first_major]
drill = {first_major: {**dv, "weekly": dv["weekly"][:20], "top": dv["top"][:5], "top_yearly": dv["top_yearly"][:5]}}
uids = {e["uid"] for e in events} | {t["uid"] for t in drill[first_major]["top"] + drill[first_major]["top_yearly"] if "uid" in t}
clusters = {u: d["clusters"][u] for u in uids if u in d["clusters"]}
for c in clusters.values():
    c["members"] = c["members"][:5]
lifetimes = {**d["lifetimes"], "base": d["lifetimes"]["base"][:200], "named": d["lifetimes"]["named"][:10]}
archetypes = {**d["archetypes"], "clusters": [{**c, "members": c["members"][:5]} for c in d["archetypes"]["clusters"]]}
categories = {**d["categories"], "subs": d["categories"]["subs"][:8]}

fixture = {
    "version": d["version"], "entry": d["entry"],
    "meta": {**d["meta"], "first_day": daily[0]["d"], "last_day": daily[-1]["d"]},
    "daily": daily, "weekly": weekly, "sections": d["sections"], "ledger": ledger,
    "annotations": d["annotations"][:2], "events": events, "drill": drill, "clusters": clusters,
    "lifetimes": lifetimes, "archetypes": archetypes, "discords": d["discords"][:1],
    "stats": d["stats"], "categories": categories,
}
out = Path("data/fixtures/analysis/entries") / d["entry"] / "payload.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(fixture, separators=(",", ":")), encoding="utf-8")

index = {
    "version": "0.1.0", "generated": "2026-09-19T00:00:00Z",
    "entries": [{
        "id": d["entry"], "number": 1, "title": "Five years of news cycles",
        "summary": "Fixture entry: a trimmed slice of the real payload.",
        "definitions": "A run is one pipeline execution. An observation is a story seen in one run.",
        "first_day": daily[0]["d"], "last_day": daily[-1]["d"], "published": "2026-09-19",
        "links": {"post": "", "code": "https://github.com/glhuilli/newvelles/tree/main/analysis"},
        "panels": ["timeline", "topstories", "archetypes", "categories"],
        "payload": f"/analysis/entries/{d['entry']}/payload.json",
        "stats": {"runs": d["meta"]["runs"], "stories": d["meta"]["stories"], "days": len(daily), "majors": len(d["categories"]["majors_order"])},
    }],
}
Path("data/fixtures/analysis/index.json").write_text(json.dumps(index, indent=2) + "\n", encoding="utf-8")
print(f"fixture payload: {out.stat().st_size / 1024:.0f} KB")
