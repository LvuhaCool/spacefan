import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import authRouter from './auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app  = express();
const PORT = process.env.PORT ?? 3001;

// Trust Railway's proxy so req.ip is the real client IP
app.set('trust proxy', 1);

app.use(express.json());
app.use(cookieParser());

// ── API ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);

// ── Serve built frontend in production ────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const dist = join(__dirname, '../dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(join(dist, 'index.html')));
}

app.listen(PORT, () => console.log(`Spacefan server on :${PORT}`));
