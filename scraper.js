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
