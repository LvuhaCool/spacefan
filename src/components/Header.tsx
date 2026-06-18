import { Link, useLocation } from 'react-router-dom';

export default function Header() {
  const location = useLocation();

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
        <nav className="flex items-center gap-1">
          {navItems.map(({ path, label }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
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
      </div>
    </header>
  );
}
