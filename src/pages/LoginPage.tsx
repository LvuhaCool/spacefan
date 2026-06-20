import { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

type Step = 'password' | 'otp';

// ── 6-box OTP component ───────────────────────────────────────────────
function OtpBoxes({
  onComplete,
  disabled,
}: {
  onComplete: (code: string) => void;
  disabled: boolean;
}) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const trySubmit = (d: string[]) => {
    if (d.every((v) => v !== '')) onComplete(d.join(''));
  };

  const handleChange = (i: number, val: string) => {
    const clean = val.replace(/\D/g, '');
    if (clean.length > 1) {
      // paste via onChange (common on mobile)
      const next = ['', '', '', '', '', ''];
      clean.slice(0, 6).split('').forEach((d, idx) => { next[idx] = d; });
      setDigits(next);
      refs.current[Math.min(clean.length, 5)]?.focus();
      trySubmit(next);
      return;
    }
    const digit = clean;
    const next = [...digits];
    next[i] = digit;
    setDigits(next);
    if (digit && i < 5) refs.current[i + 1]?.focus();
    trySubmit(next);
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      if (digits[i]) {
        const next = [...digits];
        next[i] = '';
        setDigits(next);
      } else if (i > 0) {
        refs.current[i - 1]?.focus();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = ['', '', '', '', '', ''];
    pasted.split('').forEach((d, idx) => { next[idx] = d; });
    setDigits(next);
    refs.current[Math.min(pasted.length, 5)]?.focus();
    trySubmit(next);
  };

  return (
    <div className="flex gap-2 sm:gap-3 justify-center">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          value={digit}
          autoFocus={i === 0}
          disabled={disabled}
          autoComplete="off"
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          onPaste={handlePaste}
          className={`
            w-11 h-14 sm:w-12 sm:h-[60px]
            text-center text-2xl font-bold font-mono
            border-2 rounded-xl bg-white text-stone-900
            outline-none transition-all duration-150
            disabled:opacity-40 cursor-text
            ${digit ? 'border-stone-800 shadow-sm' : 'border-stone-200'}
            focus:border-stone-900 focus:shadow-sm
          `}
        />
      ))}
    </div>
  );
}

// ── Eye icon ──────────────────────────────────────────────────────────
function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
      <path strokeLinecap="round" d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" />
      <circle cx="10" cy="10" r="2.5" />
    </svg>
  ) : (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l14 14M8.5 8.6a2.5 2.5 0 003.9 3.8M6.3 6.4C4.4 7.6 3 10 3 10s3 6 7 6a7 7 0 003.7-1.1M10 4c4 0 7 6 7 6a13 13 0 01-1.7 2.4" />
    </svg>
  );
}

// ── Main ──────────────────────────────────────────────────────────────
export default function LoginPage() {
  const { onLogin } = useAuth();
  const [step, setStepState] = useState<Step>(
    () => (sessionStorage.getItem('spacefan_login_step') as Step) ?? 'password'
  );

  const setStep = (s: Step) => {
    setStepState(s);
    if (s === 'otp') sessionStorage.setItem('spacefan_login_step', 'otp');
    else sessionStorage.removeItem('spacefan_login_step');
  };
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [otpKey, setOtpKey]   = useState(0); // bump to reset boxes
  const passwordRef           = useRef<HTMLInputElement>(null);

  // ── password step ─────────────────────────────────────────────────
  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password: passwordRef.current?.value ?? '' }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? 'Ошибка.');
      else setStep('otp');
    } catch {
      setError('Нет соединения с сервером.');
    } finally {
      setLoading(false);
    }
  };

  // ── otp step: auto-fires when all 6 boxes are filled ─────────────
  const handleOtpComplete = async (code: string) => {
    setError('');
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/verify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Неверный код.');
        setOtpKey((k) => k + 1); // clears and refocuses boxes
      } else {
        sessionStorage.removeItem('spacefan_login_step');
        onLogin();
      }
    } catch {
      setError('Нет соединения с сервером.');
      setOtpKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  };

  const backToPassword = () => { setStep('password'); setError(''); setShowPwd(false); };

  return (
    <div className="min-h-svh bg-[#f8f7f5] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <p className="text-xs font-semibold text-stone-400 tracking-widest uppercase mb-10 text-center">
          Spacefan
        </p>

        {step === 'password' ? (
          <form onSubmit={handlePassword} className="flex flex-col gap-4">
            <div>
              <h1 className="text-2xl font-bold text-stone-900 mb-1">Вход</h1>
              <p className="text-sm text-stone-400">Только для вас.</p>
            </div>

            <div className="relative">
              <input
                ref={passwordRef}
                type={showPwd ? 'text' : 'password'}
                placeholder="Пароль"
                autoFocus
                autoComplete="current-password"
                required
                className="w-full px-4 py-3 pr-11 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder:text-stone-300 outline-none focus:border-stone-400 transition-colors text-[15px]"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 transition-colors p-0.5"
              >
                <EyeIcon open={showPwd} />
              </button>
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-2.5">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition-colors disabled:opacity-50"
            >
              {loading ? 'Проверяем...' : 'Продолжить →'}
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-2xl font-bold text-stone-900 mb-1">Код из письма</h1>
              <p className="text-sm text-stone-400">
                Отправили 6-значный код на почту. Действует 10 минут.
              </p>
            </div>

            <OtpBoxes
              key={otpKey}
              onComplete={handleOtpComplete}
              disabled={loading}
            />

            {loading && (
              <p className="text-sm text-stone-400 text-center animate-pulse">Проверяем...</p>
            )}

            {error && (
              <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-2.5 text-center">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={backToPassword}
              className="text-sm text-stone-400 hover:text-stone-600 transition-colors text-center"
            >
              ← Ввести пароль заново
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
