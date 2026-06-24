import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import authRouter from './auth.js';
import db from './db.js';
import { startNewsJob, refreshFeed } from './newsJob.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app  = express();
const PORT = process.env.PORT ?? 3001;

// Persistent uploads dir — same volume as the SQLite DB
const uploadsDir = process.env.DATA_DIR
  ? join(process.env.DATA_DIR, 'uploads')
  : join(__dirname, 'uploads');
mkdirSync(uploadsDir, { recursive: true });

// Trust Railway's proxy so req.ip is the real client IP
app.set('trust proxy', 1);

app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// ── Uploaded images (served from persistent volume) ───────────────────
app.use('/uploads', express.static(uploadsDir));

// ── API ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);

// Checks for a valid session cookie — used to protect personal routes
function getSession(req) {
  const sid = req.cookies?.session; // cookie is named 'session', set by auth.js
  if (!sid) return null;
  return db.prepare('SELECT id FROM sessions WHERE id = ? AND expires_at > ?').get(sid, Date.now()) ?? null;
}

app.get('/api/news', (_req, res) => {
  const rows = db.prepare('SELECT * FROM news_feed ORDER BY sfn_id DESC').all();
  res.json(rows.map(r => ({
    id:        r.id,
    title:     r.title,
    excerpt:   r.excerpt,
    content:   r.content,
    imageUrl:  r.image_url,
    category:  r.category,
    date:      r.event_date,
    readTime:  r.read_time,
    sourceUrl: r.source_url,
  })));
});

app.get('/api/launches', (_req, res) => {
  const rows = db.prepare(
    "SELECT * FROM launches WHERE status_abbrev NOT IN ('Success','Failure','Partial Failure') ORDER BY net ASC"
  ).all();
  res.json(rows.map(r => ({
    id:           r.id,
    name:         r.name,
    rocket:       r.rocket,
    provider:     r.provider,
    pad:          r.pad,
    location:     r.location,
    net:          r.net,
    netFormatted: r.net_formatted,
    statusName:   r.status_name,
    statusAbbrev:       r.status_abbrev,
    landingInfo:        JSON.parse(r.landing_info ?? '[]'),
    missionDescription: r.mission_description ?? '',
  })));
});

app.get('/api/events', (_req, res) => {
  const rows = db.prepare('SELECT * FROM space_events ORDER BY date ASC').all();
  res.json(rows.map(r => ({
    id:            r.id,
    name:          r.name,
    typeName:      r.type_name,
    description:   r.description,
    date:          r.date,
    dateFormatted: r.date_formatted,
    location:      r.location,
    imageUrl:      r.image_url,
  })));
});

app.delete('/api/news/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  db.prepare('DELETE FROM news_feed WHERE id = ?').run(id);
  return res.json({ ok: true });
});

app.post('/api/news/refresh', (_req, res) => {
  refreshFeed();
  res.json({ ok: true });
});

// ── Drafts (session-protected) ────────────────────────────────────────

app.get('/api/drafts', (req, res) => {
  if (!getSession(req)) return res.status(401).json({ error: 'Unauthorized' });
  const rows = db.prepare('SELECT * FROM drafts ORDER BY updated_at DESC').all();
  return res.json(rows.map(r => ({
    id:        r.id,
    title:     r.title,
    content:   r.content,
    updatedAt: r.updated_at,
    createdAt: r.created_at,
  })));
});

app.post('/api/drafts', (req, res) => {
  if (!getSession(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { id, title, content, updatedAt, createdAt } = req.body ?? {};
  if (!id) return res.status(400).json({ error: 'Missing id' });
  db.prepare(`
    INSERT INTO drafts (id, title, content, updated_at, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title      = excluded.title,
      content    = excluded.content,
      updated_at = excluded.updated_at
  `).run(id, title ?? '', content ?? '', updatedAt ?? Date.now(), createdAt ?? Date.now());
  return res.json({ ok: true });
});

app.delete('/api/drafts/:id', (req, res) => {
  if (!getSession(req)) return res.status(401).json({ error: 'Unauthorized' });
  db.prepare('DELETE FROM drafts WHERE id = ?').run(req.params.id);
  return res.json({ ok: true });
});

// ── Telegram publishing ───────────────────────────────────────────────

app.post('/api/publish/telegram', async (req, res) => {
  if (!getSession(req)) return res.status(401).json({ error: 'Unauthorized' });

  const { text, images } = req.body ?? {};
  if (!text) return res.status(400).json({ error: 'Missing text' });

  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHANNEL_ID;
  if (!token || !chatId) return res.status(500).json({ error: 'Telegram not configured' });

  const api = `https://api.telegram.org/bot${token}`;

  try {
    const imgs = Array.isArray(images) ? images : [];

    if (imgs.length === 0) {
      // Text only → sendMessage
      const r = await fetch(`${api}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.description ?? 'sendMessage failed'); }
    } else {
      // Text + images → caption on first photo, rest of chunks text-free
      for (let i = 0; i < imgs.length; i += 10) {
        const chunk     = imgs.slice(i, i + 10);
        const isFirst   = i === 0;
        const form      = new FormData();
        form.append('chat_id', chatId);

        if (chunk.length === 1) {
          const buf = Buffer.from(chunk[0].src.split(',')[1], 'base64');
          form.append('photo', new Blob([buf]), 'photo.jpg');
          if (isFirst) { form.append('caption', text); form.append('parse_mode', 'HTML'); }
          const r = await fetch(`${api}/sendPhoto`, { method: 'POST', body: form });
          if (!r.ok) { const e = await r.json(); throw new Error(e.description ?? 'sendPhoto failed'); }
        } else {
          const media = chunk.map((img, j) => ({
            type: 'photo',
            media: `attach://photo${j}`,
            ...(isFirst && j === 0 ? { caption: text, parse_mode: 'HTML' } : {}),
          }));
          form.append('media', JSON.stringify(media));
          chunk.forEach((img, j) => {
            const buf = Buffer.from(img.src.split(',')[1], 'base64');
            form.append(`photo${j}`, new Blob([buf]), `photo${j}.jpg`);
          });
          const r = await fetch(`${api}/sendMediaGroup`, { method: 'POST', body: form });
          if (!r.ok) { const e = await r.json(); throw new Error(e.description ?? 'sendMediaGroup failed'); }
        }
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[telegram] publish error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Dzen publishing ───────────────────────────────────────────────────

app.post('/api/publish/dzen', (req, res) => {
  if (!getSession(req)) return res.status(401).json({ error: 'Unauthorized' });

  const { draftId, title, bodyHtml } = req.body ?? {};
  if (!draftId) return res.status(400).json({ error: 'Missing draftId' });

  const siteUrl = `${req.protocol}://${req.get('host')}`;

  // Extract base64 images, save to disk, replace with hosted URLs
  const imgRe = /src="data:image\/(jpeg|png|gif|webp|jpg);base64,([A-Za-z0-9+/=]+)"/g;
  const replacements = [];
  let m;
  while ((m = imgRe.exec(bodyHtml ?? '')) !== null) {
    const [matched, ext, b64] = m;
    const filename = `${randomUUID()}.${ext === 'jpeg' ? 'jpg' : ext}`;
    try {
      writeFileSync(join(uploadsDir, filename), Buffer.from(b64, 'base64'));
      replacements.push([matched, `src="${siteUrl}/uploads/${filename}"`]);
    } catch (e) {
      console.error('[dzen] image upload error:', e.message);
    }
  }

  // Also strip drag-handle divs left over from the editor
  let cleanHtml = (bodyHtml ?? '').replace(/<div[^>]+class="drag-handle"[^>]*>[\s\S]*?<\/div>/g, '');
  for (const [from, to] of replacements) cleanHtml = cleanHtml.replace(from, to);

  db.prepare(`
    INSERT INTO dzen_published (id, title, body_html, published_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title        = excluded.title,
      body_html    = excluded.body_html,
      published_at = excluded.published_at
  `).run(draftId, title ?? '', cleanHtml, Date.now());

  return res.json({ ok: true });
});

// ── RSS feed for Yandex Dzen ──────────────────────────────────────────

app.get('/rss.xml', (req, res) => {
  const siteUrl = `${req.protocol}://${req.get('host')}`;
  const channelTitle = process.env.CHANNEL_TITLE ?? 'Космоголик';
  const channelDesc  = process.env.CHANNEL_DESC  ?? 'Статьи о космосе';

  const rows = db.prepare(
    'SELECT id, title, body_html, published_at FROM dzen_published ORDER BY published_at DESC LIMIT 100'
  ).all();

  const esc = (s) => s.replace(/]]>/g, ']]]]><![CDATA[>');

  const items = rows.map(r => `
    <item>
      <title><![CDATA[${esc(r.title)}]]></title>
      <link>${siteUrl}/articles/${r.id}</link>
      <guid isPermaLink="false">${siteUrl}/articles/${r.id}</guid>
      <pubDate>${new Date(r.published_at).toUTCString()}</pubDate>
      <content:encoded><![CDATA[${esc(r.body_html)}]]></content:encoded>
    </item>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${channelTitle}</title>
    <link>${siteUrl}</link>
    <description>${channelDesc}</description>
    <language>ru</language>${items}
  </channel>
</rss>`;

  res.set('Content-Type', 'application/rss+xml; charset=utf-8');
  res.send(xml);
});

// ── Serve built frontend in production ────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const dist = join(__dirname, '../dist');
  app.use(express.static(dist));
  app.get(/(.*)/, (_req, res) => res.sendFile(join(dist, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`Spacefan server on :${PORT}`);
  startNewsJob();
});
