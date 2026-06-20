import Groq from 'groq-sdk';
import db from './db.js';

const SPACEFLIGHT_URL   = 'https://api.spaceflightnewsapi.net/v4/articles/?limit=20&ordering=-published_at';
const LL2_URL           = 'https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=5&ordering=net';
const REFRESH_INTERVAL  = 30 * 60 * 1000;

const MONTHS_RU = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

function formatNet(iso) {
  if (!iso) return 'Дата уточняется';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Дата уточняется';
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${d.getUTCDate()} ${MONTHS_RU[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${h}:${m} UTC`;
}

function getGroq() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

// ── News ──────────────────────────────────────────────────────────────

async function refreshNews() {
  console.log('[news] Fetching articles...');

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
    n:            i + 1,
    title:        a.title,
    summary:      a.summary ?? '',
    image_url:    a.image_url ?? '',
    url:          a.url ?? '',
    news_site:    a.news_site ?? '',
    published_at: a.published_at ?? '',
  }));

  const prompt = `You are a translator for a Russian-language space news platform. Given these ${sources.length} recent English space news articles, pick the 8 most important and translate them into Russian.

STRICT RULES — breaking these causes harm:
1. Translate faithfully. Do NOT invent facts, dates, locations, or technical specs absent from the source text.
2. If the source says nothing about a rocket stage count, fuel type, or trajectory — leave it out.
3. Use published_at as the event_date — do not guess or fabricate a different date.
4. Keep content proportional to the source: if the summary is 2 sentences, the Russian content should be ~2-3 sentences, not 3 invented paragraphs.

For each chosen article return:
- "title": natural Russian translation of the English title
- "excerpt": Russian translation of the first sentence or two of the summary
- "content": Russian translation of the full summary text — faithful, nothing added
- "category": SpaceX / NASA / Роскосмос / Blue Origin / ESA / Rocket Lab / Запуск / Открытие / or a short fitting label
- "image_url": copy image_url exactly
- "source_url": copy url exactly
- "event_date": date in Russian from published_at only (e.g. "20 июня 2026")
- "read_time": 2

Articles:
${JSON.stringify(sources, null, 2)}

Return {"articles": [...]} with exactly 8 items. JSON only, no markdown.`;

  let picked;
  try {
    const completion = await getGroq().chat.completions.create({
      model:           'llama-3.3-70b-versatile',
      messages:        [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature:     0.1,
    });
    const parsed = JSON.parse(completion.choices[0].message.content ?? '{}');
    picked = Array.isArray(parsed)          ? parsed
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

  const insert = db.prepare(`
    INSERT INTO news_feed (title, excerpt, content, image_url, category, event_date, read_time, source_url, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const now = Date.now();
  db.transaction(() => {
    db.prepare('DELETE FROM news_feed').run();
    for (const a of picked.slice(0, 8)) {
      insert.run(
        a.title      ?? '',
        a.excerpt    ?? '',
        a.content    ?? '',
        a.image_url  ?? '',
        a.category   ?? 'Космос',
        a.event_date ?? '',
        a.read_time  ?? 2,
        a.source_url ?? '',
        now,
      );
    }
  })();
  console.log(`[news] Updated — ${Math.min(picked.length, 8)} articles`);
}

// ── Launches (Launch Library 2) ───────────────────────────────────────

async function refreshLaunches() {
  console.log('[launches] Fetching upcoming launches from LL2...');

  let raw;
  try {
    const res = await fetch(LL2_URL, { headers: { 'User-Agent': 'Spacefan/1.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    raw = await res.json();
  } catch (err) {
    console.error('[launches] LL2 error:', err.message);
    return;
  }

  const list = raw.results ?? [];
  if (list.length === 0) return;

  const insert = db.prepare(`
    INSERT OR REPLACE INTO launches
      (id, name, rocket, provider, pad, location, net, net_formatted, status_name, status_abbrev, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const now = Date.now();
  db.transaction(() => {
    db.prepare('DELETE FROM launches').run();
    for (const l of list) {
      insert.run(
        l.id,
        l.mission?.name ?? l.name ?? '',
        l.rocket?.configuration?.full_name ?? l.rocket?.configuration?.name ?? '',
        l.launch_service_provider?.name ?? '',
        l.pad?.name ?? '',
        l.pad?.location?.name ?? '',
        l.net ?? '',
        formatNet(l.net),
        l.status?.name ?? '',
        l.status?.abbrev ?? 'TBD',
        now,
      );
    }
  })();
  console.log(`[launches] Updated — ${list.length} launches`);
}

// ── Public ────────────────────────────────────────────────────────────

export async function refreshFeed() {
  await Promise.allSettled([refreshNews(), refreshLaunches()]);
}

export function startNewsJob() {
  refreshFeed();
  setInterval(refreshFeed, REFRESH_INTERVAL);
}
