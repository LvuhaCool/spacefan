import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { Resend } from 'resend';
import db from './db.js';

const router = Router();

// Lazy so the module loads even without the env var set (e.g. during tests)
function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const MAX_ATTEMPTS   = 5;
const LOCKOUT_MS     = 45 * 60 * 1000;  // 45 minutes
const OTP_EXPIRY_MS  = 10 * 60 * 1000;  // 10 minutes
const SESSION_MS     = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── helpers ──────────────────────────────────────────────────────────

function getLockout(ip) {
  const cutoff = Date.now() - LOCKOUT_MS;
  const { count } = db
    .prepare('SELECT COUNT(*) as count FROM login_attempts WHERE ip = ? AND attempted_at > ?')
    .get(ip, cutoff);

  if (count >= MAX_ATTEMPTS) {
    const { last } = db
      .prepare('SELECT MAX(attempted_at) as last FROM login_attempts WHERE ip = ?')
      .get(ip);
    return { locked: true, unlockAt: last + LOCKOUT_MS };
  }
  return { locked: false, attemptsUsed: count };
}

function recordFailedAttempt(ip) {
  db.prepare('INSERT INTO login_attempts (ip, attempted_at) VALUES (?, ?)').run(ip, Date.now());
}

function clearAttempts(ip) {
  db.prepare('DELETE FROM login_attempts WHERE ip = ?').run(ip);
}

// ── POST /api/auth/login ──────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { password } = req.body ?? {};
  if (!password) return res.status(400).json({ error: 'Введите пароль.' });

  const ip = req.ip;
  const lockout = getLockout(ip);

  if (lockout.locked) {
    const mins = Math.ceil((lockout.unlockAt - Date.now()) / 60_000);
    return res.status(429).json({
      error: `Слишком много попыток. Попробуйте через ${mins} мин.`,
    });
  }

  const valid = bcrypt.compareSync(password, process.env.PASSWORD_HASH ?? '');
  if (!valid) {
    recordFailedAttempt(ip);
    const used = (lockout.attemptsUsed ?? 0) + 1;
    const left = MAX_ATTEMPTS - used;
    if (left <= 0) {
      return res.status(429).json({ error: 'Слишком много попыток. Заблокировано на 45 минут.' });
    }
    return res.status(401).json({ error: `Неверный пароль. Осталось попыток: ${left}` });
  }

  // Password OK — generate OTP
  db.prepare('DELETE FROM otp_codes').run();
  const code = String(Math.floor(100_000 + Math.random() * 900_000));
  const hashed = bcrypt.hashSync(code, 8);
  db.prepare('INSERT INTO otp_codes (code, expires_at) VALUES (?, ?)').run(hashed, Date.now() + OTP_EXPIRY_MS);

  try {
    await getResend().emails.send({
      from: process.env.RESEND_FROM ?? 'Spacefan <onboarding@resend.dev>',
      to: process.env.YOUR_EMAIL,
      subject: 'Код входа в Spacefan',
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:400px;margin:0 auto;padding:32px">
          <p style="font-size:13px;color:#78716c;margin:0 0 8px">Spacefan</p>
          <h1 style="font-size:32px;font-weight:700;letter-spacing:-1px;margin:0 0 24px;color:#1c1917">${code}</h1>
          <p style="font-size:14px;color:#57534e;margin:0">Код действителен 10 минут. Если это были не вы — проигнорируйте письмо.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('Email send failed:', err);
    return res.status(500).json({ error: 'Не удалось отправить код на почту. Проверьте RESEND_API_KEY.' });
  }

  return res.json({ ok: true });
});

// ── POST /api/auth/verify ─────────────────────────────────────────────
router.post('/verify', (req, res) => {
  const { code } = req.body ?? {};
  if (!code) return res.status(400).json({ error: 'Введите код.' });

  const row = db.prepare('SELECT * FROM otp_codes WHERE expires_at > ?').get(Date.now());
  if (!row) {
    return res.status(401).json({ error: 'Код истёк. Войдите снова.' });
  }

  if (!bcrypt.compareSync(String(code), row.code)) {
    return res.status(401).json({ error: 'Неверный код.' });
  }

  // Success — clear OTP and lockout, create session
  db.prepare('DELETE FROM otp_codes').run();
  clearAttempts(req.ip);

  const sessionId  = randomBytes(32).toString('hex');
  const expiresAt  = Date.now() + SESSION_MS;
  db.prepare('INSERT INTO sessions (id, created_at, expires_at) VALUES (?, ?, ?)').run(sessionId, Date.now(), expiresAt);

  res.cookie('session', sessionId, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   SESSION_MS,
  });

  return res.json({ ok: true });
});

// ── POST /api/auth/logout ─────────────────────────────────────────────
router.post('/logout', (req, res) => {
  const sid = req.cookies?.session;
  if (sid) db.prepare('DELETE FROM sessions WHERE id = ?').run(sid);
  res.clearCookie('session');
  return res.json({ ok: true });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────
router.get('/me', (req, res) => {
  const sid = req.cookies?.session;
  if (!sid) return res.status(401).json({ error: 'Not authenticated' });

  const session = db
    .prepare('SELECT id FROM sessions WHERE id = ? AND expires_at > ?')
    .get(sid, Date.now());

  if (!session) {
    res.clearCookie('session');
    return res.status(401).json({ error: 'Session expired' });
  }

  return res.json({ ok: true });
});

export default router;
