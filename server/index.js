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

app.use(express.json());
app.use(cookieParser());

// ── API ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);

app.get('/api/news', (_req, res) => {
  const rows = db.prepare('SELECT * FROM news_feed ORDER BY id ASC').all();
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
  const rows = db.prepare('SELECT * FROM launches ORDER BY net ASC').all();
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
    statusAbbrev: r.status_abbrev,
  })));
});

app.post('/api/news/refresh', (_req, res) => {
  refreshFeed();
  res.json({ ok: true });
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
