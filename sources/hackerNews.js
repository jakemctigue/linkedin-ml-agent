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
