import { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

type Step = 'password' | 'otp';

export default function LoginPage() {
  const { onLogin } = useAuth();
  const [step, setStep]       = useState<Step>('password');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const passwordRef = useRef<HTMLInputElement>(null);
  const otpRef      = useRef<HTMLInputElement>(null);

  // ── Step 1: submit password ───────────────────────────────────────
  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const password = passwordRef.current?.value ?? '';
    setError('');
    setLoading(true);

    try {
      const res  = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Ошибка.');
      } else {
        setStep('otp');
      }
    } catch {
      setError('Нет соединения с сервером.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: submit OTP ────────────────────────────────────────────
  const handleOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpRef.current?.value ?? '';
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
        setError(data.error ?? 'Ошибка.');
      } else {
        onLogin();
      }
    } catch {
      setError('Нет соединения с сервером.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-svh bg-[#f8f7f5] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <p className="text-xs font-semibold text-stone-400 tracking-widest uppercase mb-10 text-center">
          Spacefan
        </p>

        {step === 'password' ? (
          <form onSubmit={handlePassword} className="flex flex-col gap-4">
            <div>
              <h1 className="text-2xl font-bold text-stone-900 mb-1">Вход</h1>
              <p className="text-sm text-stone-400">Только для вас.</p>
            </div>

            <input
              ref={passwordRef}
              type="password"
              placeholder="Пароль"
              autoFocus
              required
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder:text-stone-300 outline-none focus:border-stone-400 transition-colors text-[15px]"
            />

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
          <form onSubmit={handleOtp} className="flex flex-col gap-4">
            <div>
              <h1 className="text-2xl font-bold text-stone-900 mb-1">Код из письма</h1>
              <p className="text-sm text-stone-400">
                Отправили 6-значный код на вашу почту. Действует 10 минут.
              </p>
            </div>

            <input
              ref={otpRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="000000"
              autoFocus
              required
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder:text-stone-300 outline-none focus:border-stone-400 transition-colors text-[15px] tracking-widest text-center font-mono"
            />

            {error && (
              <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-2.5">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition-colors disabled:opacity-50"
            >
              {loading ? 'Проверяем...' : 'Войти'}
            </button>

            <button
              type="button"
              onClick={() => { setStep('password'); setError(''); }}
              className="text-sm text-stone-400 hover:text-stone-600 transition-colors text-center"
            >
              ← Ввести пароль заново
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
