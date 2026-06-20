import Groq from 'groq-sdk';
import db from './db.js';

const SPACEFLIGHT_URL = 'https://api.spaceflightnewsapi.net/v4/articles/?limit=20&ordering=-published_at';
const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes

function getGroq() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

export async function refreshNews() {
  console.log('[news] Fetching articles from Spaceflight News API...');

  let raw;
  try {
    const res = await fetch(SPACEFLIGHT_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    raw = await res.json();
  } catch (err) {
    console.error('[news] Spaceflight API error:', err.message);
    return;
  }

  const sources = raw.results.map((a, i) => ({
    n: i + 1,
    title: a.title,
    summary: a.summary?.slice(0, 300) ?? '',
    image_url: a.image_url ?? '',
    url: a.url ?? '',
    site: a.news_site ?? '',
    published_at: a.published_at ?? '',
  }));

  const prompt = `You are a space news curator for a Russian-language platform. Given these ${sources.length} recent English-language space news articles, pick the 8 most important and interesting events.

For each chosen article write a JSON object:
- "title": concise Russian title
- "excerpt": 2-sentence Russian summary (what happened + why it matters)
- "content": Russian body, 3 paragraphs separated by \\n\\n. Include event date/time, location (launch/landing site or mission location), organizations, and key technical details
- "category": main org or type — use one of: SpaceX, NASA, Роскосмос, Blue Origin, ESA, Rocket Lab, Запуск, Открытие, or another short label
- "image_url": copy image_url from the source article exactly
- "source_url": copy url from the source article exactly
- "event_date": date in Russian, e.g. "18 июня 2026"
- "read_time": integer 2–4

Articles:
${JSON.stringify(sources, null, 2)}

Return a JSON object with one key "articles" containing an array of exactly 8 objects. No markdown, no explanation — only the JSON.`;

  let picked;
  try {
    const completion = await getGroq().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });
    const parsed = JSON.parse(completion.choices[0].message.content ?? '{}');
    picked = Array.isArray(parsed) ? parsed
           : Array.isArray(parsed.articles) ? parsed.articles
           : Object.values(parsed).find(Array.isArray);
  } catch (err) {
    console.error('[news] Groq error:', err.message);
    return;
  }

  if (!Array.isArray(picked) || picked.length === 0) {
    console.error('[news] Unexpected Groq response shape');
    return;
  }

  // Only replace DB contents once we have good data
  const insert = db.prepare(`
    INSERT INTO news_feed (title, excerpt, content, image_url, category, event_date, read_time, source_url, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = Date.now();
  db.transaction(() => {
    db.prepare('DELETE FROM news_feed').run();
    for (const a of picked.slice(0, 8)) {
      insert.run(
        a.title       ?? '',
        a.excerpt     ?? '',
        a.content     ?? '',
        a.image_url   ?? '',
        a.category    ?? 'Космос',
        a.event_date  ?? '',
        a.read_time   ?? 3,
        a.source_url  ?? '',
        now,
      );
    }
  })();

  console.log(`[news] Feed updated — ${Math.min(picked.length, 8)} articles`);
}

export function startNewsJob() {
  // Run immediately on start, then every 30 minutes
  refreshNews();
  setInterval(refreshNews, REFRESH_INTERVAL);
}
