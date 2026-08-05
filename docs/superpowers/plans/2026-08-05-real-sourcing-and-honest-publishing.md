# Real Sourcing & Honest Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fabricated scraper (invented posts attributed to real named people, including Nobel laureates) and the fake "auto-published" pipeline with real Hacker News/arXiv/RSS ingestion and an honest draft-and-copy publishing flow across all 10 platforms — nothing claims to have been posted anywhere unless a human actually clicked to post it.

**Architecture:** `scraper.js` becomes a thin orchestrator over three new real fetcher modules (`sources/hackerNews.js`, `sources/arxiv.js`, `sources/rss.js`), writing real posts into the existing SQLite-backed `database.js`. `ml_pipeline.py`'s clustering algorithm is unchanged, but its output-narrative templates (currently hardcoded "micro-VM" boilerplate unrelated to input) are rewritten to reflect the real shared keywords of whatever pair of real posts they're describing. `server.js`'s `/api/publish` and `triggerDailyAutoPost()` stop claiming fake API success; the daily scheduler stages a draft (re-scrape + re-analyze) rather than "publishing" to 10 platforms nothing was ever sent to.

**Tech Stack:** Node.js (`node:sqlite` built-in, global `fetch`, new dependency `rss-parser` for RSS/Atom parsing), Python 3 (stdlib only, no new dependencies).

## Global Constraints

- No fabricated content, ever — every post's text and attribution must come from a real, verifiable source (verbatim title/summary + real link back), per `docs/superpowers/specs/2026-08-05-real-sourcing-and-honest-publishing-design.md`.
- No fabricated engagement numbers — `likes`/`reposts` default to `0` unless a source genuinely provides an engagement metric (Hacker News `score`/`descendants` are the one real case).
- No platform in this system auto-publishes via a real third-party API call — no LinkedIn Developer App, no OAuth, no credentials of any kind (owner decision: no LinkedIn Page).
- No status field anywhere may claim `SUCCESS`/`PUBLISHED` for an action that didn't actually happen; use `DRAFT_READY`/`DRAFT_GENERATED` instead.
- Follow existing repo conventions: plain Node scripts (no test framework is configured in this repo), `node:sqlite` for persistence, `data/*.json` files kept in sync with SQLite via the existing `syncToJSON`/`syncFromJSON` pattern in `database.js`.
- Verified live source URLs to use (checked via `curl` on 2026-08-05 — do not substitute Reuters, whose public RSS feeds are discontinued and return an HTML page, not XML):
  - Hacker News: `https://hacker-news.firebaseio.com/v0/topstories.json` + `https://hacker-news.firebaseio.com/v0/item/{id}.json`
  - arXiv: `http://export.arxiv.org/api/query?search_query=cat:cs.AI&sortBy=submittedDate&sortOrder=descending&max_results=8`
  - BBC Business (Finance): `http://feeds.bbci.co.uk/news/business/rss.xml`
  - NPR Politics (Politics): `https://feeds.npr.org/1014/rss.xml`
  - BBC World (Geopolitics): `http://feeds.bbci.co.uk/news/world/rss.xml`

---

### Task 1: Add a `url` column to the `posts` table

**Files:**
- Modify: `database.js:9-88` (`initDatabase`), `database.js:90-148` (`syncFromJSON`'s `insertPost` statement), `database.js:270-286` (`insertPostRecord`)

**Interfaces:**
- Produces: `insertPostRecord(influencerId, postObj)` now persists `postObj.url` (string, defaults to `''`); every post object returned by `getAllInfluencers()` includes a `url` field (no code change needed there — it already does `SELECT *`).

- [ ] **Step 1: Add the migration**

In `database.js`, immediately after the existing migration block (the one that adds `realizations.keywords_json`, ending around line 78), add:

```javascript
  try {
    db.exec(`ALTER TABLE posts ADD COLUMN url TEXT;`);
  } catch (e) {
    // Column already exists
  }
```

- [ ] **Step 2: Carry `url` through `syncFromJSON`'s insert statement**

In `syncFromJSON()` (database.js), change:

```javascript
      const insertPost = db.prepare(`
        INSERT OR REPLACE INTO posts (id, influencer_id, text, likes, reposts, date, keywords_json, platform_source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
```
to:
```javascript
      const insertPost = db.prepare(`
        INSERT OR REPLACE INTO posts (id, influencer_id, text, likes, reposts, date, keywords_json, platform_source, url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
```
and its `.run(...)` call from:
```javascript
          insertPost.run(
            post.id,
            inf.id,
            post.text,
            post.likes || 0,
            post.reposts || 0,
            post.date || new Date().toISOString().split('T')[0],
            JSON.stringify(post.keywords || []),
            inf.platform_source || 'Multi-Platform'
          );
```
to:
```javascript
          insertPost.run(
            post.id,
            inf.id,
            post.text,
            post.likes || 0,
            post.reposts || 0,
            post.date || new Date().toISOString().split('T')[0],
            JSON.stringify(post.keywords || []),
            inf.platform_source || 'Multi-Platform',
            post.url || ''
          );
```

- [ ] **Step 3: Carry `url` through `insertPostRecord`**

Change:
```javascript
function insertPostRecord(influencerId, postObj) {
  const insertPost = db.prepare(`
    INSERT OR REPLACE INTO posts (id, influencer_id, text, likes, reposts, date, keywords_json, platform_source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertPost.run(
    postObj.id,
    influencerId,
    postObj.text,
    postObj.likes || 0,
    postObj.reposts || 0,
    postObj.date || new Date().toISOString().split('T')[0],
    JSON.stringify(postObj.keywords || []),
    postObj.platform_source || 'Multi-Platform'
  );
  syncToJSON();
}
```
to:
```javascript
function insertPostRecord(influencerId, postObj) {
  const insertPost = db.prepare(`
    INSERT OR REPLACE INTO posts (id, influencer_id, text, likes, reposts, date, keywords_json, platform_source, url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertPost.run(
    postObj.id,
    influencerId,
    postObj.text,
    postObj.likes || 0,
    postObj.reposts || 0,
    postObj.date || new Date().toISOString().split('T')[0],
    JSON.stringify(postObj.keywords || []),
    postObj.platform_source || 'Multi-Platform',
    postObj.url || ''
  );
  syncToJSON();
}
```

- [ ] **Step 4: Verify manually**

Run (from the repo root):
```bash
rm -f data/agent_database.db
node -e "const {initDatabase, insertInfluencerRecord, insertPostRecord, getAllInfluencers} = require('./database'); initDatabase(); insertInfluencerRecord({id:'test_src', name:'Test Source', domain:'Tech'}); insertPostRecord('test_src', {id:'test_post_1', text:'hello world', url:'https://example.com/a'}); console.log(JSON.stringify(getAllInfluencers().find(i=>i.id==='test_src'), null, 2));"
```
Expected: the printed post object includes `"url": "https://example.com/a"`.

- [ ] **Step 5: Restore the real database file**

```bash
git checkout -- data/agent_database.db
```
(Task 11 will regenerate all data files for real at the end — this step just undoes the throwaway test DB from Step 4 so it doesn't get committed prematurely.)

- [ ] **Step 6: Commit**

```bash
git add database.js
git commit -m "feat: add url column to posts table for real source links"
```

---

### Task 2: Add `rss-parser` dependency

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `require('rss-parser')` available to `sources/arxiv.js` and `sources/rss.js` (Tasks 4 and 5).

- [ ] **Step 1: Add the dependency**

In `package.json`, change:
```json
  "dependencies": {
    "express": "^4.19.2",
    "cors": "^2.8.5"
  }
```
to:
```json
  "dependencies": {
    "express": "^4.19.2",
    "cors": "^2.8.5",
    "rss-parser": "^3.13.0"
  }
```

- [ ] **Step 2: Install and verify**

```bash
npm install
node -e "const Parser = require('rss-parser'); console.log(typeof Parser)"
```
Expected: prints `function`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add rss-parser dependency for real RSS/Atom ingestion"
```

---

### Task 3: Real Hacker News source

**Files:**
- Create: `sources/hackerNews.js`

**Interfaces:**
- Produces: `fetchTopHackerNewsPosts(limit = 8)` → `Promise<Array<{sourceId, sourceName, domain, title, text, url, likes, reposts, date}>>`. Consumed by Task 6 (`scraper.js`).

- [ ] **Step 1: Write the fetcher**

```javascript
// Real Hacker News fetcher — public Firebase API, no key required.
const HN_BASE = 'https://hacker-news.firebaseio.com/v0';

async function fetchTopHackerNewsPosts(limit = 8) {
  const idsRes = await fetch(`${HN_BASE}/topstories.json`);
  if (!idsRes.ok) throw new Error(`Hacker News topstories fetch failed: ${idsRes.status}`);
  const ids = await idsRes.json();
  const topIds = ids.slice(0, limit);

  const items = await Promise.all(topIds.map(async (id) => {
    const itemRes = await fetch(`${HN_BASE}/item/${id}.json`);
    if (!itemRes.ok) return null;
    return itemRes.json();
  }));

  return items
    .filter(item => item && item.title && item.type === 'story')
    .map(item => ({
      sourceId: 'hacker_news',
      sourceName: 'Hacker News',
      domain: 'Tech',
      title: item.title,
      text: item.title + (item.text ? `: ${item.text.replace(/<[^>]+>/g, '')}` : ''),
      url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
      likes: item.score || 0,
      reposts: item.descendants || 0,
      date: item.time ? new Date(item.time * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    }));
}

module.exports = { fetchTopHackerNewsPosts };
```

- [ ] **Step 2: Verify manually**

```bash
node -e "require('./sources/hackerNews').fetchTopHackerNewsPosts(3).then(r => console.log(JSON.stringify(r, null, 2))).catch(e => { console.error(e); process.exit(1); })"
```
Expected: 3 objects with real, current Hacker News titles and `url` fields pointing to real articles or `news.ycombinator.com` discussion threads.

- [ ] **Step 3: Commit**

```bash
git add sources/hackerNews.js
git commit -m "feat: add real Hacker News source fetcher"
```

---

### Task 4: Real arXiv source

**Files:**
- Create: `sources/arxiv.js`

**Interfaces:**
- Consumes: `rss-parser` (Task 2).
- Produces: `fetchRecentArxivPapers(limit = 8)` → `Promise<Array<{sourceId, sourceName, domain, title, text, url, author, likes, reposts, date}>>`. Consumed by Task 6.

- [ ] **Step 1: Write the fetcher**

```javascript
// Real arXiv fetcher via arXiv's public Atom API — no key required.
const Parser = require('rss-parser');
const parser = new Parser();

const ARXIV_QUERY_URL = 'http://export.arxiv.org/api/query?search_query=cat:cs.AI&sortBy=submittedDate&sortOrder=descending&max_results=8';

async function fetchRecentArxivPapers(limit = 8) {
  const feed = await parser.parseURL(ARXIV_QUERY_URL);
  return (feed.items || []).slice(0, limit).map(item => {
    const cleanTitle = (item.title || 'Untitled paper').replace(/\s+/g, ' ').trim();
    const summary = (item.contentSnippet || item.content || '').replace(/\s+/g, ' ').trim().substring(0, 400);
    return {
      sourceId: 'arxiv_cs_ai',
      sourceName: 'arXiv (cs.AI)',
      domain: 'Tech',
      title: cleanTitle,
      text: `${cleanTitle}: ${summary}`,
      url: item.link || item.id || '',
      author: item.creator || item.author || '',
      likes: 0,
      reposts: 0,
      date: item.isoDate ? item.isoDate.split('T')[0] : new Date().toISOString().split('T')[0]
    };
  });
}

module.exports = { fetchRecentArxivPapers };
```

- [ ] **Step 2: Verify manually**

```bash
node -e "require('./sources/arxiv').fetchRecentArxivPapers(3).then(r => console.log(JSON.stringify(r, null, 2))).catch(e => { console.error(e); process.exit(1); })"
```
Expected: 3 objects with real, current arXiv cs.AI paper titles and `url` fields pointing to real `arxiv.org` abstract pages.

- [ ] **Step 3: Commit**

```bash
git add sources/arxiv.js
git commit -m "feat: add real arXiv source fetcher"
```

---

### Task 5: Real RSS sources (Finance, Politics, Geopolitics)

**Files:**
- Create: `sources/rss.js`

**Interfaces:**
- Consumes: `rss-parser` (Task 2).
- Produces: `fetchRssPosts(perFeedLimit = 4)` → `Promise<Array<{sourceId, sourceName, domain, title, text, url, author, likes, reposts, date}>>`. Consumed by Task 6.

- [ ] **Step 1: Write the fetcher**

```javascript
// Real RSS ingestion from named outlets — real published articles, real bylines only
// when the feed itself provides one, never invented. URLs verified live 2026-08-05.
const Parser = require('rss-parser');
const parser = new Parser();

const RSS_SOURCES = [
  { name: 'BBC Business', domain: 'Finance', url: 'http://feeds.bbci.co.uk/news/business/rss.xml' },
  { name: 'NPR Politics', domain: 'Politics', url: 'https://feeds.npr.org/1014/rss.xml' },
  { name: 'BBC World', domain: 'Geopolitics', url: 'http://feeds.bbci.co.uk/news/world/rss.xml' }
];

async function fetchRssPosts(perFeedLimit = 4) {
  const results = [];
  for (const source of RSS_SOURCES) {
    try {
      const feed = await parser.parseURL(source.url);
      (feed.items || []).slice(0, perFeedLimit).forEach(item => {
        const title = item.title || 'Untitled';
        const summary = (item.contentSnippet || item.content || '').replace(/\s+/g, ' ').trim().substring(0, 400);
        results.push({
          sourceId: source.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
          sourceName: source.name,
          domain: source.domain,
          title,
          text: `${title}: ${summary}`,
          url: item.link || '',
          author: item.creator || item.author || '',
          likes: 0,
          reposts: 0,
          date: item.isoDate ? item.isoDate.split('T')[0] : new Date().toISOString().split('T')[0]
        });
      });
    } catch (err) {
      console.error(`[RSS Source] Failed to fetch ${source.name} (${source.url}):`, err.message);
    }
  }
  return results;
}

module.exports = { fetchRssPosts, RSS_SOURCES };
```

- [ ] **Step 2: Verify manually**

```bash
node -e "require('./sources/rss').fetchRssPosts(2).then(r => console.log(JSON.stringify(r, null, 2))).catch(e => { console.error(e); process.exit(1); })"
```
Expected: up to 6 objects (2 per feed × 3 feeds) with real, current headlines from BBC Business, NPR Politics, and BBC World, each with a real `url`.

- [ ] **Step 3: Commit**

```bash
git add sources/rss.js
git commit -m "feat: add real RSS source fetcher for Finance/Politics/Geopolitics"
```

---

### Task 6: Rewrite `scraper.js` to orchestrate real sources

**Files:**
- Modify: `scraper.js` (full rewrite of its body; keep the same module export shape)

**Interfaces:**
- Consumes: `fetchTopHackerNewsPosts` (Task 3), `fetchRecentArxivPapers` (Task 4), `fetchRssPosts` (Task 5), `insertInfluencerRecord`/`insertPostRecord` (existing `database.js`, now accepting `url` per Task 1).
- Produces: `runComprehensiveScrape()` → `Promise<number>` (count of new posts added) — same signature `server.js` already calls at `server.js:685` and `server.js:609+` (Task 9), so no caller changes needed.

- [ ] **Step 1: Replace the entire file**

```javascript
const fs = require('fs');
const path = require('path');
const { insertInfluencerRecord, insertPostRecord } = require('./database');
const { fetchTopHackerNewsPosts } = require('./sources/hackerNews');
const { fetchRecentArxivPapers } = require('./sources/arxiv');
const { fetchRssPosts } = require('./sources/rss');

// Real Multi-Source Scraper — every post here is real, attributable content
// pulled from a live public feed. No text is invented; attribution is always
// the real publication name, plus a real byline only when the feed provides one.
async function runComprehensiveScrape() {
  console.log('[Scraper] Fetching real content from Hacker News, arXiv, and RSS sources...');

  const [hnPosts, arxivPosts, rssPosts] = await Promise.all([
    fetchTopHackerNewsPosts(8).catch(err => { console.error('[Scraper] Hacker News fetch failed:', err.message); return []; }),
    fetchRecentArxivPapers(8).catch(err => { console.error('[Scraper] arXiv fetch failed:', err.message); return []; }),
    fetchRssPosts(4).catch(err => { console.error('[Scraper] RSS fetch failed:', err.message); return []; })
  ]);

  const allItems = [...hnPosts, ...arxivPosts, ...rssPosts];

  if (allItems.length === 0) {
    throw new Error('All sources failed — no real content was fetched.');
  }

  let totalScraped = 0;

  allItems.forEach(item => {
    // One "source" per feed (Hacker News, arXiv (cs.AI), BBC Business, NPR Politics, BBC World)
    // acts as the influencer/source record; individual real articles are its posts.
    const sourceInfluencer = {
      id: item.sourceId,
      name: item.author ? `${item.sourceName} (${item.author})` : item.sourceName,
      title: item.author ? 'Byline' : 'Publication',
      domain: item.domain,
      platform_source: item.sourceName,
      avatar: '',
      followers: ''
    };
    insertInfluencerRecord(sourceInfluencer);

    const uniquePostId = `p_${item.sourceId}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    insertPostRecord(item.sourceId, {
      id: uniquePostId,
      text: item.text,
      url: item.url,
      likes: item.likes || 0,
      reposts: item.reposts || 0,
      date: item.date,
      keywords: [item.domain],
      platform_source: item.sourceName
    });

    totalScraped++;
  });

  console.log(`[Scraper] Added ${totalScraped} real posts from ${allItems.length ? new Set(allItems.map(i => i.sourceName)).size : 0} sources.`);
  return totalScraped;
}

module.exports = {
  runComprehensiveScrape
};
```

- [ ] **Step 2: Verify manually**

```bash
node -e "require('./scraper').runComprehensiveScrape().then(n => console.log('Added', n, 'posts')).catch(e => { console.error(e); process.exit(1); })"
```
Expected: prints `Added N posts` with `N` roughly 14-20 (8 HN + up to 8 arXiv + up to 12 RSS, minus any single-source failures), and no errors. Then inspect `data/influencer_database.json` and confirm every post's `text` is real (a real headline/summary, not a "Fresh Scrape:" template) and every post has a real `url`.

- [ ] **Step 3: Commit**

```bash
git add scraper.js
git commit -m "feat: replace fabricated scraper with real Hacker News/arXiv/RSS ingestion"
```

---

### Task 7: Fix `ml_pipeline.py`'s narrative generation to reflect real content

**Context for the implementer:** the clustering algorithm (TF-IDF, PCA, k-means) is correct and needs no changes. The bug is downstream: the `realization`/`summary`/`strategic_goals` text synthesized for each cross-domain pair is currently hardcoded boilerplate about "micro-VM hypervisors" and "open-weights licensing" — text that has nothing to do with the actual two real posts being paired, aside from interpolating their author names, domains, and raw snippets. Once real posts flow in (a BBC Business article paired with a Hacker News story, say), that canned boilerplate will read as nonsensical filler bolted onto unrelated real content. This task makes the narrative text actually derive from the real shared keywords already computed for the pair.

**Files:**
- Modify: `ml_pipeline.py:324-378` (the per-pair synthesis loop inside `run_pipeline()`)

**Interfaces:**
- Consumes: `pair["shared_topics"]` (already computed at `ml_pipeline.py:276`, real TF-IDF token intersection of the two real posts — no change needed there).
- Produces: same output shape as before (`title`, `domains`, `infographic_url`, `keywords_banner`, `surprise_index`, `summary`, `realization`, `strategic_goals`, `evidence_posts` — unchanged keys, so `server.js` and `public/app.js` need no changes for this task), but with content actually derived from the real pair instead of fixed boilerplate.

- [ ] **Step 1: Replace the synthesis block**

In `ml_pipeline.py`, replace this block (currently lines 331-360):

```python
        shared_kw = pair.get("shared_topics", ["OpenSource", "MicroVM", "Inference", "Strategy"])
        if not shared_kw:
            shared_kw = ["MicroVM", "Inference", "MIT-License", "Hyperscaler"]

        keywords_banner = [k.capitalize() for k in shared_kw[:4]]
        if len(keywords_banner) < 4:
            keywords_banner.extend(["Open-Weights", "Sub-Millisecond", "Sovereign-Mesh"])

        img_asset = INFOGRAPHIC_ASSETS[idx % len(INFOGRAPHIC_ASSETS)]
        surprise_val = min(0.99, max(0.85, float(pair.get("surprise_score", 0.90)) * 1.5))

        title = f"{p1['author_name']} & {p2['author_name']}: {p1['domain']} ⚡ {p2['domain']} Convergence"
        
        realization = (
            f"Fusing signals from {p1['author_name']} ({p1['domain']}) and {p2['author_name']} ({p2['domain']}) "
            f"reveals a fresh daily realization: '{p1_clean[:140]}...' intersects with '{p2_clean[:140]}...'. "
            f"Self-hosted micro-VM hypervisors and open-weights licensing are disintermediating traditional proprietary cloud APIs."
        )

        summary = (
            f"Fresh Daily ML Synthesis across {p1['domain']} and {p2['domain']}. "
            f"Cross-landscape analysis of 105+ influencers, Medium publications, and X community streams shows rapid adoption "
            f"of MIT/Apache 2.0 open-weights inference nodes operating at sub-millisecond execution speeds."
        )

        strategic_goals = [
            f"Deploy self-hosted Firecracker micro-VM containers leveraging MIT/Apache 2.0 open-weights models.",
            f"Optimize real-time inference FLOP efficiency and token throughput across localized GPU microgrids.",
            f"Integrate zero-knowledge proof verification attestations to guarantee decentralized AI agent execution safety."
        ]
```

with:

```python
        shared_kw = pair.get("shared_topics", [])

        if shared_kw:
            keywords_banner = [k.capitalize() for k in shared_kw[:4]]
        else:
            # No shared vocabulary at all — fall back to the two real domain names
            # themselves rather than inventing unrelated keywords.
            keywords_banner = [p1['domain'], p2['domain']]

        img_asset = INFOGRAPHIC_ASSETS[idx % len(INFOGRAPHIC_ASSETS)]
        surprise_val = min(0.99, max(0.85, float(pair.get("surprise_score", 0.90)) * 1.5))

        title = f"{p1['author_name']} & {p2['author_name']}: {p1['domain']} ⚡ {p2['domain']} Convergence"

        if shared_kw:
            topic_phrase = ", ".join(shared_kw[:3])
            connector = f"both independently touch on {topic_phrase}"
        else:
            connector = f"surfaced together despite no shared vocabulary — a genuinely cross-domain juxtaposition"

        realization = (
            f"{p1['author_name']} ({p1['domain']}) and {p2['author_name']} ({p2['domain']}) {connector}. "
            f"\"{p1_clean[:140]}...\" (via {p1['author_name']}) sits alongside "
            f"\"{p2_clean[:140]}...\" (via {p2['author_name']})."
        )

        summary = (
            f"Cross-domain ML synthesis across {p1['domain']} and {p2['domain']}, drawn from real signals scraped "
            f"across {len(posts_flat)} posts today. This pairing scored {round(pair.get('surprise_score', 0.0), 3)} "
            f"on cosine-similarity-weighted cross-domain surprise."
        )

        strategic_goals = [
            f"Track further {p1['domain'].lower()} developments from {p1['author_name']}.",
            f"Track further {p2['domain'].lower()} developments from {p2['author_name']}.",
        ] + ([f"Watch for follow-on coverage of: {', '.join(shared_kw[:3])}."] if shared_kw else [])
```

- [ ] **Step 2: Verify manually**

Run the pipeline against whatever real data Task 6 already produced:
```bash
python ml_pipeline.py
```
Expected: no errors, `Successfully generated DYNAMIC analysis output at .../data/analysis_results.json` printed. Then inspect `data/analysis_results.json`'s `synthesized_realizations[0].realization` and confirm it quotes the two real paired posts and references their real shared keywords (or explicitly says there were none) — not "micro-VM hypervisors."

- [ ] **Step 3: Commit**

```bash
git add ml_pipeline.py
git commit -m "fix: derive realization/summary/strategic_goals from real shared keywords instead of hardcoded boilerplate"
```

---

### Task 8: Make `/api/publish` honest (no fake API calls)

**Files:**
- Modify: `server.js:413-606` (`/api/publish` route)

**Interfaces:**
- Consumes: nothing new.
- Produces: same response shape consumed by `public/app.js:917-935` (`data.dispatches[].share_url` is the only field the frontend reads — confirmed by inspection, so this can be simplified safely without a frontend change in this task).

- [ ] **Step 1: Strip the fabricated API-call framing, keep the real share URLs**

Replace the whole `for (const platform of platforms) { ... }` loop body in `/api/publish` (`server.js:428-592`) — every `endpointUsed`/`payloadSent`/`apiStatus = 'API_SUCCESS'` line goes; the `targetShareUrl` construction per platform (which is real and already works) stays exactly as-is. Replace:

```javascript
    for (const platform of platforms) {
      const pName = platform.toLowerCase();
      let apiStatus = 'API_SUCCESS';
      let endpointUsed = '';
      let payloadSent = {};
      let targetShareUrl = '';

      if (pName.includes('linkedin')) {
        // LinkedIn ugcPosts / V2 API Payload
        endpointUsed = 'https://api.linkedin.com/v2/ugcPosts';
        payloadSent = { /* ... */ };
        const linkedInText = (content.linkedIn || content.default || '') + `\n\n🖼️ Visual Infographic Asset:\n${fullImageUrl}`;
        targetShareUrl = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(linkedInText)}`;
      
      } else if ( /* ...other platform branches building payloadSent/endpointUsed... */ ) {
        /* ... */
      }

      dispatchLog.push({
        platform: platform,
        api_status: apiStatus,
        api_endpoint_used: endpointUsed,
        headline_text: goalTitle,
        full_text_carried: content[platform.toLowerCase()] || content.default || '',
        image_asset_carried: fullImageUrl,
        api_payload: payloadSent,
        share_url: targetShareUrl,
        published_at: timestamp,
        post_id: `api_${platform.toLowerCase().replace(/[^a-z]/g, '')}_${Date.now()}`
      });
    }
```

with (keep every `targetShareUrl`-building `if`/`else if` branch's URL-construction line verbatim, delete only the `endpointUsed`/`payloadSent` assignments inside each):

```javascript
    for (const platform of platforms) {
      const pName = platform.toLowerCase();
      let targetShareUrl = '';

      if (pName.includes('linkedin')) {
        const linkedInText = (content.linkedIn || content.default || '') + `\n\n🖼️ Visual Infographic Asset:\n${fullImageUrl}`;
        targetShareUrl = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(linkedInText)}`;

      } else if (pName.includes('bluesky') || pName.includes('bsky')) {
        targetShareUrl = `https://bsky.app/intent/compose?text=${encodeURIComponent((content.bluesky || content.default || '').substring(0, 275))}`;

      } else if (pName.includes('threads')) {
        targetShareUrl = `https://www.threads.net/intent/post?text=${encodeURIComponent((content.threads || content.default || '').substring(0, 275))}`;

      } else if (pName.includes('medium')) {
        targetShareUrl = `https://medium.com/new-story`;

      } else if (pName.includes('substack')) {
        targetShareUrl = `https://substack.com/publish`;

      } else if (pName.includes('tumblr')) {
        targetShareUrl = `https://www.tumblr.com/widgets/share/tool?canonicalUrl=${encodeURIComponent(hostBase)}&title=${encodeURIComponent(goalTitle)}&caption=${encodeURIComponent(content.tumblr || '')}`;

      } else if (pName === 'x' || pName.includes('twitter')) {
        targetShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent((content.x || content.twitter || '').substring(0, 275))}`;

      } else if (pName.includes('facebook')) {
        targetShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(hostBase)}`;

      } else if (pName.includes('youtube')) {
        targetShareUrl = `https://studio.youtube.com/`;

      } else if (pName.includes('mctigue')) {
        targetShareUrl = `http://localhost:3000/`;
      } else {
        targetShareUrl = `http://localhost:3000/`;
      }

      dispatchLog.push({
        platform: platform,
        status: 'DRAFT_READY',
        headline_text: goalTitle,
        full_text_carried: content[platform.toLowerCase()] || content.default || '',
        image_asset_carried: fullImageUrl,
        share_url: targetShareUrl,
        generated_at: timestamp,
        post_id: `draft_${platform.toLowerCase().replace(/[^a-z]/g, '')}_${Date.now()}`
      });
    }
```

Also update the response message just below it, from:
```javascript
    res.json({
      message: `REST API Payloads Successfully Carried Across All Selected Platforms!`,
```
to:
```javascript
    res.json({
      message: `Drafts ready — click through each opened tab to actually post.`,
```

- [ ] **Step 2: Verify manually**

Start the server (`npm start` in one terminal), then in another:
```bash
curl -s -X POST http://localhost:3000/api/publish \
  -H "Content-Type: application/json" \
  -d '{"goalId":"g1","goalTitle":"Test Goal","platforms":["LinkedIn","X"],"content":{"linkedIn":"Test LinkedIn text","x":"Test X text","default":"Test"},"infographicUrl":"/assets/infographic_sovereign_ai.jpg"}' | node -e "process.stdin.on('data', d => console.log(JSON.stringify(JSON.parse(d), null, 2)))"
```
Expected: `dispatches` array with `status: "DRAFT_READY"` for each platform (no `api_status`/`api_payload`/`api_endpoint_used` fields), and real `share_url` values (`linkedin.com/feed/?shareActive=true&text=...`, `twitter.com/intent/tweet?text=...`).

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "fix: stop fabricating API-call success in /api/publish, keep real share-intent links"
```

---

### Task 9: Make the daily scheduler stage a draft instead of faking publication

**Files:**
- Modify: `server.js:608-670` (`triggerDailyAutoPost`), `server.js:730-738` (`/api/scheduler/trigger-daily-post` route)

**Interfaces:**
- Consumes: `runComprehensiveScrape()` (Task 6), Python `ml_pipeline.py` (Task 7) via the same `exec('python ml_pipeline.py', ...)` pattern already used at `server.js:688`.
- Produces: `triggerDailyAutoPost()` → `Promise<runRecord>` where `runRecord.status === 'DRAFT_GENERATED'` (was `'SUCCESS'`); `data/daily_dispatch_history.json` records reflect real draft generation, never fake publication.

- [ ] **Step 1: Rewrite `triggerDailyAutoPost`**

Replace the full function body (`server.js:609-670`, from `async function triggerDailyAutoPost() {` through its closing `}`) with:

```javascript
async function triggerDailyAutoPost() {
  const timestamp = new Date().toISOString();
  console.log(`[Daily Draft Generator] Starting daily real scrape + re-analysis at ${timestamp}...`);

  const newPostsCount = await runComprehensiveScrape();

  await new Promise((resolve, reject) => {
    exec('python ml_pipeline.py', (execErr, stdout, stderr) => {
      if (execErr) {
        console.error('[Daily Draft Generator] Python ML execution error:', stderr);
        reject(execErr);
        return;
      }
      resolve();
    });
  });

  const analysisPath = path.join(__dirname, 'data', 'analysis_results.json');
  const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));
  const topGoal = (analysis.synthesized_realizations && analysis.synthesized_realizations[0]) || null;

  if (!topGoal) {
    throw new Error('Daily draft generation ran but produced no realizations to draft.');
  }

  let historyDb = { history: [] };
  const historyPath = path.join(__dirname, 'data', 'daily_dispatch_history.json');
  if (fs.existsSync(historyPath)) {
    historyDb = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
  }

  const runRecord = {
    dispatch_id: `daily_draft_${Date.now()}`,
    timestamp: timestamp,
    goal_id: topGoal.id,
    goal_title: topGoal.title,
    surprise_score: topGoal.surprise_index || 0,
    new_posts_scraped: newPostsCount,
    infographic_url: topGoal.infographic_url,
    status: 'DRAFT_GENERATED'
  };

  historyDb.last_run = timestamp;
  historyDb.total_dispatches = (historyDb.total_dispatches || 0) + 1;
  historyDb.history.unshift(runRecord);

  fs.writeFileSync(historyPath, JSON.stringify(historyDb, null, 2));
  console.log(`[Daily Draft Generator] ✅ Today's draft ready: "${topGoal.title}" (${newPostsCount} new real posts scraped).`);
  return runRecord;
}
```

- [ ] **Step 2: Update the manual-trigger endpoint's response message**

Change (`server.js`, the `/api/scheduler/trigger-daily-post` route):
```javascript
    res.json({
      message: '🚀 Autonomous Daily Post Dispatch Successfully Executed across all 10 Platforms!',
      runRecord: runRecord
    });
```
to:
```javascript
    res.json({
      message: `Today's draft is ready: "${runRecord.goal_title}". Open the dashboard to review and post it yourself.`,
      runRecord: runRecord
    });
```

- [ ] **Step 3: Verify manually**

```bash
curl -s -X POST http://localhost:3000/api/scheduler/trigger-daily-post | node -e "process.stdin.on('data', d => console.log(JSON.stringify(JSON.parse(d), null, 2)))"
```
Expected: `runRecord.status === "DRAFT_GENERATED"`, `runRecord.goal_title` is a real title referencing real scraped content, no `platforms_published` array, no per-platform `dispatches` claiming success. Then check `data/daily_dispatch_history.json` — its newest entry matches.

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "fix: daily scheduler stages a real draft instead of fabricating 10-platform publish success"
```

---

### Task 10: Surface "Today's Draft" in the dashboard

**Context for the implementer:** `synthesized_realizations` is already sorted by surprise score descending (`ml_pipeline.py`'s `filtered_pairs`/`surprise_pairs.sort(...)`), so `synthesized_realizations[0]` — the first goal `renderGoals` renders when unfiltered — is already "today's top pick." This task only needs to visually badge it; no new endpoint or data file is needed.

**Files:**
- Modify: `public/app.js:204-230` (inside `renderGoals`, the `filtered.forEach((goal, idx) => { ... })` card-building loop)

**Interfaces:**
- Consumes: existing `appState.analysisData.synthesized_realizations` (unchanged shape).
- Produces: no new exports; purely a rendering change.

- [ ] **Step 1: Add the badge**

In `renderGoals` (`public/app.js`), find:
```javascript
    goalsContainer.innerHTML = '';
    filtered.forEach((goal, idx) => {
      const card = document.createElement('div');
      card.className = 'goal-card';
```
and change to:
```javascript
    goalsContainer.innerHTML = '';
    const isUnfiltered = (activeFilter === 'all') && !query;
    filtered.forEach((goal, idx) => {
      const card = document.createElement('div');
      card.className = 'goal-card';
      const isTodaysDraft = isUnfiltered && idx === 0;
      if (isTodaysDraft) card.classList.add('goal-card-todays-draft');
```

Then find the `card.innerHTML = \`` template a few lines below (starts with `${goal.infographic_url ? ...}`) and add a badge line right after the opening backtick:
```javascript
      card.innerHTML = `
        ${isTodaysDraft ? `<div class="todays-draft-badge">📅 Today's Draft — ready to post</div>` : ''}
        ${goal.infographic_url ? `
```

- [ ] **Step 2: Add minimal styling**

In `public/styles.css`, append:
```css
.todays-draft-badge {
  background: #0a66c2;
  color: #fff;
  font-weight: 600;
  font-size: 0.8rem;
  padding: 0.4rem 0.75rem;
  border-radius: 4px 4px 0 0;
  display: inline-block;
}
.goal-card-todays-draft {
  border: 2px solid #0a66c2;
}
```

- [ ] **Step 3: Verify manually**

Start the server (`npm start`), open `http://localhost:3000` in a browser, confirm the first (unfiltered, no search) goal card shows the blue "📅 Today's Draft — ready to post" badge and a blue border, and that clicking its existing publish button still opens the publish modal correctly (no regression — this task only added a conditional badge div, didn't touch the publish button wiring).

- [ ] **Step 4: Commit**

```bash
git add public/app.js public/styles.css
git commit -m "feat: badge today's top realization as Today's Draft in the dashboard"
```

---

### Task 11: Reset data files and run the full real pipeline end-to-end

**Files:**
- Modify (regenerate, not hand-edit): `data/influencer_database.json`, `data/analysis_results.json`, `data/agent_database.db`, `data/daily_dispatch_history.json`

**Interfaces:**
- Consumes: everything from Tasks 1-9.
- Produces: none — this is the final integration/verification task, confirming the whole real pipeline works end-to-end with no fabricated data left over from before this plan.

- [ ] **Step 1: Clear out the old fabricated data**

```bash
rm -f data/agent_database.db data/influencer_database.json data/analysis_results.json data/daily_dispatch_history.json
```

- [ ] **Step 2: Run a real scrape + analysis from a clean slate**

```bash
node -e "const {initDatabase} = require('./database'); initDatabase();"
node -e "require('./scraper').runComprehensiveScrape().then(n => console.log('Scraped', n, 'real posts')).catch(e => { console.error(e); process.exit(1); })"
python ml_pipeline.py
```
Expected: no errors at any step.

- [ ] **Step 3: Verify no fabricated content survived**

```bash
grep -c "Fresh Scrape" data/influencer_database.json data/analysis_results.json
```
Expected: `0` in both files (that string only ever appeared in the old fabricated templates, now deleted from the codebase).

```bash
grep -c "Nobel Laureate" data/influencer_database.json data/analysis_results.json
```
Expected: `0` in both files.

- [ ] **Step 4: Start the server and confirm the dashboard loads real data**

```bash
npm start
```
In a browser, open `http://localhost:3000`, confirm: the influencer/source feed shows real names ("Hacker News", "arXiv (cs.AI)", "BBC Business", "NPR Politics", "BBC World"); the top goal card is badged "Today's Draft" and its evidence snippets are real, current headlines; clicking "Publish" on it opens the modal with real content and, on submit, opens real platform compose tabs.

- [ ] **Step 5: Commit the regenerated data files**

```bash
git add data/
git commit -m "chore: regenerate data files from real sources, remove all fabricated content"
```

---

## Self-Review

**Spec coverage:**
- Section A (real ingestion, real attribution, no fabricated engagement) → Tasks 3, 4, 5, 6.
- Section B (ML pipeline unchanged algorithm, but must not break/must not read as nonsensical with real data) → Task 7.
- Section C+D (honest publishing, no fake API success, LinkedIn on the same draft footing as the other 9) → Tasks 8, 9, 10.
- Section E (data cleanup, no carried-forward fabrication) → Task 11.
- Nobel-laureate-scraping concern raised by the user → explicitly not built (confirmed blocked by LinkedIn's ToS and lack of any third-party-post API), and Task 11 Step 3 verifies no trace of the old fabricated laureate content survives.

**Placeholder scan:** no TBD/TODO markers; every step has concrete, runnable code or commands.

**Type consistency:** `insertPostRecord(influencerId, postObj)` signature (Task 1) matches its Task 6 call site exactly (`id`, `text`, `url`, `likes`, `reposts`, `date`, `keywords`, `platform_source`). `fetchTopHackerNewsPosts`/`fetchRecentArxivPapers`/`fetchRssPosts` all return the same item shape (`sourceId`, `sourceName`, `domain`, `title`, `text`, `url`, `likes`, `reposts`, `date`, optional `author`), consumed uniformly by Task 6's `scraper.js`. `synthesized_realizations[idx]` shape is unchanged across Task 7 (Python) and Task 10 (JS reads `.id`, `.title`, `.infographic_url`, `.domains`, `.surprise_index` — all still produced).
