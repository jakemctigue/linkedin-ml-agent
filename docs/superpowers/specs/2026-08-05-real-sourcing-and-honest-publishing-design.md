# Real Sourcing & Honest Publishing — Design Spec

## Problem

The existing app (`linkedin-ml-agent`) has real, working infrastructure — a hand-rolled TF-IDF/PCA/k-means ML pipeline, a SQLite-backed post/source database, a dashboard UI, static infographic assets, and a multi-platform post composer — but two parts of it are fabricated:

1. **`scraper.js` invents content.** Every "scraped" post is a hardcoded template string, some attributed to real, named public figures (Craig Federighi, Pat Gelsinger, Ben Thompson, etc.) as if they actually said it, complete with fabricated engagement numbers. No HTTP request is ever made.
2. **The publish pipeline fakes success.** `/api/publish` and the 24h auto-poster build platform-specific payloads (LinkedIn `ugcPosts`, Twitter, Facebook, etc.) but never call any external API — `apiStatus` is hardcoded to `'API_SUCCESS'` / `'AUTO_DISPATCH_SUCCESS'` regardless. The daily dispatch history is entirely fictional.

Goal: make this a genuinely working cross-domain analysis engine over **real** data, producing **real, ready-to-post drafts** — without claiming actions that never happened.

## Non-goals

- No LinkedIn Developer App, OAuth flow, or company page (owner does not have a LinkedIn Page and has chosen not to create one) — so no platform in this system auto-publishes via a real API call in this iteration.
- No dynamic per-post image generation — the existing 6-image static infographic pool stays as-is; real image generation is an explicit future iteration, not part of this spec.
- No new engagement-metric fabrication — where a source has no real engagement number, none is shown, rather than inventing one.
- No decomposition into a separate sub-project — this is one cohesive change to one existing app.

## Architecture

```
scraper.js (rewritten)
  ├─ sources/hackerNews.js   → Hacker News Firebase API (Tech; real score/comment count)
  ├─ sources/arxiv.js        → arXiv Atom API (Tech/Science)
  └─ sources/rss.js          → rss-parser over real outlet feeds (Finance/Politics/Geopolitics)
        ↓ writes real items (title, summary, real source, real url, real byline-if-present)
database.js (source/post tables — "influencer" concept repointed at real sources)
        ↓
ml_pipeline.py (UNCHANGED algorithm) → data/analysis_results.json
        ↓
server.js
  ├─ /api/scrape-and-analyze  → runs real scrape + re-clusters
  ├─ /api/publish             → builds real per-platform share-intent deep links + clipboard text
  │                              (LinkedIn, Bluesky, Threads, Medium, Substack, Tumblr, X,
  │                               Facebook, YouTube, mctigue.co) — status: DRAFT_READY, never "published"
  └─ 24h setInterval           → triggerDailyAutoPost(): re-scrape, re-cluster, stage "Today's
                                  Draft" (top cross-domain insight + infographic + all 10 deep
                                  links) — generates and stores a draft, does not publish anything
        ↓
public/ dashboard — shows Today's Draft, lets the user click through to each platform's
real prefilled composer and post it themselves
```

## Components

### A. Real data ingestion (`scraper.js` + `sources/*.js`)

- **`sources/hackerNews.js`**: `GET https://hacker-news.firebaseio.com/v0/topstories.json`, then `GET /v0/item/{id}.json` for the top N. Domain: `Tech`. Attribution: `"Hacker News"` as source, real `title`/`url`/`score`/`descendants` (comment count) as genuine engagement data.
- **`sources/arxiv.js`**: `GET http://export.arxiv.org/api/query?search_query=...` (Atom XML, parsed with a small hand-rolled tag extractor — no new dependency needed for Atom's simple structure). Domain: `Tech`. Attribution: real paper title + real author list from the feed, no engagement numbers (arXiv doesn't have any).
- **`sources/rss.js`**: generic fetch-and-parse using the `rss-parser` npm package (new dependency) over a small config list of real outlet feeds — e.g. Reuters Business (Finance), Reuters World News / BBC World (Geopolitics), NPR Politics (Politics). Attribution: the publication name always; the feed's own `<author>`/`<dc:creator>` only when present, never invented. No fabricated engagement numbers.
- **Domain assignment** is a static property of which source config entry produced the item — no classifier, no ambiguity.
- **`scraper.js`** becomes an orchestrator: call each source module, normalize results to the existing post shape (`insertInfluencerRecord`/`insertPostRecord` in `database.js`), skip any source that errors (log and continue — a dead feed shouldn't break the whole scrape).
- **`data/influencer_database.json`** semantics shift from "fabricated individual people" to "real sources" (Hacker News, arXiv cs.AI, Reuters, NPR, BBC) — same schema, real content.

### B. ML pipeline (`ml_pipeline.py`)

No algorithm changes. It already reads post text and clusters it; it will simply be fed real titles/summaries instead of fabricated ones. Verify at implementation time that no field it depends on (e.g. `likes`/`reposts` used for surprise-score weighting) breaks when those fields are absent for RSS/arXiv items — default to 0 for scoring purposes rather than fabricating a number, and prefer HN's real score/comment count where available.

### C. Honest publishing (`/api/publish`, `triggerDailyAutoPost`)

- Every platform branch in `/api/publish` keeps building its real share-intent URL (LinkedIn `feed/?shareActive=true&text=...`, Bluesky compose intent, X intent, etc. — these already exist and are real, working deep links) and the clipboard-copy text, but the response status becomes `DRAFT_READY` for all platforms, uniformly. Remove the fabricated `api_endpoint_used`/`api_payload` REST-call framing entirely — it implied a server-to-server API call was made, and none is.
- `triggerDailyAutoPost()` still fires every 24h from the existing `setInterval`, and still runs automatically without user action — but its job is now: re-scrape (A) → re-analyze (B) → pick the top-scoring cross-domain insight → build "Today's Draft" (infographic + per-platform text + deep links) → store it. `daily_dispatch_history.json` records now say `status: "DRAFT_GENERATED"`, never `"SUCCESS"`/`"published"`.
- Dashboard surfaces "Today's Draft" prominently; clicking a platform button opens that platform's real composer prefilled, same UX as the existing single-platform publish flow, just honestly labeled.

### D. Data cleanup

- `data/analysis_results.json`, `data/influencer_database.json`, `data/agent_database.db`, `data/daily_dispatch_history.json` currently hold fully fabricated content and fake dispatch history. Once A–C are implemented and verified working, regenerate all four from a real scrape+analyze run; do not carry forward old fabricated records into the "real" system.

## Error handling

- Any individual source fetch failure (HN down, an RSS feed 404s, arXiv rate-limits) is caught and logged per-source; the scrape continues with whatever sources succeeded. A scrape where every source fails returns a clear error to the caller rather than silently reporting "0 new signals" as success.
- `/api/publish` no longer has a failure mode to hide — it only builds local strings/URLs, so it either succeeds or hits a real bug (unhandled exception → existing 500 handler).

## Testing

- Manual verification per source module (call each fetcher directly, confirm real titles/URLs come back) since there's no existing test harness in this repo (plain Node/Python scripts, no test framework configured).
- End-to-end manual check: trigger `/api/scrape-and-analyze`, confirm `data/analysis_results.json` contains real, attributable content with working source URLs; trigger `/api/publish` for LinkedIn and confirm the returned deep link opens LinkedIn's real compose UI with the expected prefilled text.
