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
