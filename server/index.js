import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import authRouter from './auth.js';
import db from './db.js';
import { startNewsJob, refreshFeed } from './newsJob.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app  = express();
const PORT = process.env.PORT ?? 3001;

// Trust Railway's proxy so req.ip is the real client IP
app.set('trust proxy', 1);

app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

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
    // 1. Send text
    const msgRes = await fetch(`${api}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    if (!msgRes.ok) {
      const err = await msgRes.json();
      throw new Error(err.description ?? 'sendMessage failed');
    }

    // 2. Send images in chunks of 10 (Telegram limit per sendMediaGroup)
    const imgs = Array.isArray(images) ? images : [];
    for (let i = 0; i < imgs.length; i += 10) {
      const chunk = imgs.slice(i, i + 10);
      const form  = new FormData();
      form.append('chat_id', chatId);

      if (chunk.length === 1) {
        const buf = Buffer.from(chunk[0].src.split(',')[1], 'base64');
        form.append('photo', new Blob([buf]), 'photo.jpg');
        if (chunk[0].caption) form.append('caption', chunk[0].caption);
        const r = await fetch(`${api}/sendPhoto`, { method: 'POST', body: form });
        if (!r.ok) { const e = await r.json(); throw new Error(e.description ?? 'sendPhoto failed'); }
      } else {
        const media = chunk.map((img, j) => ({
          type: 'photo', media: `attach://photo${j}`,
          ...(img.caption ? { caption: img.caption } : {}),
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

    res.json({ ok: true });
  } catch (err) {
    console.error('[telegram] publish error:', err.message);
    res.status(500).json({ error: err.message });
  }
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
