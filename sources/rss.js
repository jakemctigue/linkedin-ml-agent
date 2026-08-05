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
