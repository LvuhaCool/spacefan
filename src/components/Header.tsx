import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function DotsIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
      <circle cx="3.5" cy="8" r="1.3" />
      <circle cx="8"   cy="8" r="1.3" />
      <circle cx="12.5" cy="8" r="1.3" />
    </svg>
  );
}

function NotesIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-4 h-4">
      <rect x="2.5" y="1.5" width="11" height="13" rx="1.5" />
      <path d="M5 5.5h6M5 8h6M5 10.5h3.5" />
    </svg>
  );
}

function StarbaseIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-4 h-4">
      <path d="M8 2v8" />
      <path d="M5 7l3 3 3-3" />
      <path d="M4 10c-.8 1-1.2 2-.5 2.5C4.5 13 6 12 8 12s3.5 1 4.5.5c.7-.5.3-1.5-.5-2.5" />
    </svg>
  );
}

const extraNav = [
  { path: '/notes',    label: 'Заметки',  Icon: NotesIcon },
  { path: '/starbase', label: 'Starbase', Icon: StarbaseIcon },
];

export default function Header() {
  const location = useLocation();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  const primaryNav = [
    { path: '/',      label: 'Новости' },
    { path: '/write', label: 'Написать статью' },
  ];

  const extraActive = extraNav.some(n => location.pathname === n.path);

  return (
    <header className="sticky top-0 z-50 bg-[#f8f7f5]/90 backdrop-blur-sm border-b border-stone-200">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <span className="text-sm font-semibold text-stone-400 tracking-widest uppercase select-none">
          Spacefan
        </span>

        <div className="flex items-center gap-1 min-w-0">
          <nav className="flex items-center gap-1 shrink-0">
            {primaryNav.map(({ path, label }) => {
              const active = location.pathname === path;
              return (
                <Link
                  key={path}
                  to={path}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-stone-900 text-white'
                      : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Extra pages dropdown */}
          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={() => setOpen(v => !v)}
              title="Ещё"
              className={`p-1.5 rounded-lg transition-colors ${
                open || extraActive
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'
              }`}
            >
              <DotsIcon />
            </button>

            {open && (
              <div className="absolute right-0 top-full mt-2 w-44 bg-white rounded-xl border border-stone-100 shadow-xl overflow-hidden z-50">
                {extraNav.map(({ path, label, Icon }) => {
                  const active = location.pathname === path;
                  return (
                    <Link
                      key={path}
                      to={path}
                      className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                        active
                          ? 'bg-stone-50 text-stone-900'
                          : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                      }`}
                    >
                      <span className="text-stone-400">
                        <Icon />
                      </span>
                      {label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="w-px h-4 bg-stone-200 mx-1 shrink-0" />

          <button
            onClick={logout}
            title="Выйти"
            className="shrink-0 p-1.5 rounded-lg text-sm font-medium text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
