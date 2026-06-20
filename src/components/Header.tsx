import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Header() {
  const location = useLocation();
  const { logout } = useAuth();

  const navItems = [
    { path: '/', label: 'Новости' },
    { path: '/write', label: 'Написать статью' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#f8f7f5]/90 backdrop-blur-sm border-b border-stone-200">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <span className="text-sm font-semibold text-stone-400 tracking-widest uppercase select-none">
          Spacefan
        </span>

        <div className="flex items-center gap-1 min-w-0">
          <nav className="flex items-center gap-1 shrink-0">
            {navItems.map(({ path, label }) => {
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
