import db from './db.js';

const SPACEFLIGHT_URL  = 'https://api.spaceflightnewsapi.net/v4/articles/?limit=20&ordering=-published_at';
const LL2_URL          = 'https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=5&ordering=net&mode=detailed';
const LL2_EVENTS_URL   = 'https://ll.thespacedevs.com/2.3.0/events/upcoming/?limit=10&ordering=date';
const REFRESH_INTERVAL = 30 * 60 * 1000;

const MONTHS_RU = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getUTCDate()} ${MONTHS_RU[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function formatNet(iso) {
  if (!iso) return 'Дата уточняется';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Дата уточняется';
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${d.getUTCDate()} ${MONTHS_RU[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${h}:${m} UTC`;
}

// ── News (Spaceflight News API, raw English) ──────────────────────────

async function refreshNews() {
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

  const insert = db.prepare(`
    INSERT OR IGNORE INTO news_feed (sfn_id, title, excerpt, content, image_url, category, event_date, read_time, source_url, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = Date.now();
  let added = 0;
  db.transaction(() => {
    for (const a of raw.results ?? []) {
      const result = insert.run(
        a.id,
        a.title        ?? '',
        a.summary      ?? '',
        a.summary      ?? '',
        a.image_url    ?? '',
        a.news_site    ?? 'Космос',
        formatDate(a.published_at),
        2,
        a.url          ?? '',
        now,
      );
      if (result.changes) added++;
    }
  })();

  console.log(`[news] +${added} new articles`);
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
      (id, name, rocket, provider, pad, location, net, net_formatted, status_name, status_abbrev, landing_info, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = Date.now();
  db.transaction(() => {
    db.prepare('DELETE FROM launches').run();
    for (const l of list) {
      const stages = l.rocket?.launcher_stage ?? [];
      const landings = stages
        .filter(s => s.landing)
        .map(s => ({
          name:   s.landing?.location?.name ?? '',
          type:   s.landing?.type?.abbrev   ?? '',
          reused: s.reused ?? false,
        }));

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
        JSON.stringify(landings),
        now,
      );
    }
  })();

  console.log(`[launches] Updated — ${list.length} launches`);
}

// ── Events (EVA, Docking, Undocking — Launch Library 2) ──────────────

async function refreshEvents() {
  console.log('[events] Fetching upcoming events from LL2...');
  let raw;
  try {
    const res = await fetch(LL2_EVENTS_URL, { headers: { 'User-Agent': 'Spacefan/1.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    raw = await res.json();
  } catch (err) {
    console.error('[events] LL2 error:', err.message);
    return;
  }

  const list = raw.results ?? [];
  if (list.length === 0) return;

  const insert = db.prepare(`
    INSERT OR REPLACE INTO space_events
      (id, name, type_name, description, date, date_formatted, location, image_url, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const now = Date.now();
  db.transaction(() => {
    db.prepare('DELETE FROM space_events').run();
    for (const e of list) {
      insert.run(
        e.id,
        e.name              ?? '',
        e.type?.name        ?? '',
        e.description       ?? '',
        e.date              ?? '',
        formatNet(e.date),
        e.location          ?? '',
        e.feature_image     ?? '',
        now,
      );
    }
  })();
  console.log(`[events] Updated — ${list.length} events`);
}

// ── Public ────────────────────────────────────────────────────────────

export async function refreshFeed() {
  await Promise.allSettled([refreshNews(), refreshLaunches(), refreshEvents()]);
}

export function startNewsJob() {
  refreshFeed();
  setInterval(refreshFeed, REFRESH_INTERVAL);
}
