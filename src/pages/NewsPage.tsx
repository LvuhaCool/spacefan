import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ArticleCard from '../components/ArticleCard';
import ArticleModal from '../components/ArticleModal';
import LaunchStrip from '../components/LaunchStrip';
import LaunchModal, { type Launch } from '../components/LaunchModal';
import EventStrip from '../components/EventStrip';
import EventModal, { type SpaceEvent } from '../components/EventModal';
import type { Article } from '../data/articles';

const DISMISSED_KEY = 'spacefan_dismissed_news';

function loadDismissed(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]')); }
  catch { return new Set(); }
}

function saveDismissed(set: Set<string>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
}

export default function NewsPage() {
  const [articles, setArticles]             = useState<Article[]>([]);
  const [launches, setLaunches]             = useState<Launch[]>([]);
  const [events, setEvents]                 = useState<SpaceEvent[]>([]);
  const [selected, setSelected]             = useState<Article | null>(null);
  const [selectedLaunch, setSelectedLaunch] = useState<Launch | null>(null);
  const [selectedEvent, setSelectedEvent]   = useState<SpaceEvent | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [refreshing, setRefreshing]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Article | null>(null);
  const navigate = useNavigate();

  const fetchNews = useCallback(async () => {
    try {
      const [newsRes, launchRes, eventRes] = await Promise.all([
        fetch('/api/news'),
        fetch('/api/launches'),
        fetch('/api/events'),
      ]);
      if (!newsRes.ok) throw new Error('Ошибка сервера');
      const [newsData, launchData, eventData] = await Promise.all([
        newsRes.json() as Promise<Article[]>,
        launchRes.ok ? (launchRes.json() as Promise<Launch[]>) : Promise.resolve([]),
        eventRes.ok  ? (eventRes.json()  as Promise<SpaceEvent[]>) : Promise.resolve([]),
      ]);
      const dismissed = loadDismissed();
      setArticles(newsData.filter(a => !dismissed.has(a.sourceUrl ?? String(a.id))));
      setLaunches(launchData);
      setEvents(eventData);
      setError('');
    } catch {
      setError('Не удалось загрузить новости.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNews(); }, [fetchNews]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch('/api/news/refresh', { method: 'POST' });
      await new Promise(r => setTimeout(r, 10000));
      await fetchNews();
    } finally {
      setRefreshing(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const { id, sourceUrl } = deleteTarget;
    const key = sourceUrl ?? String(id);
    const dismissed = loadDismissed();
    dismissed.add(key);
    saveDismissed(dismissed);
    setDeleteTarget(null);
    setArticles(prev => prev.filter(a => a.id !== id));
    fetch(`/api/news/${id}`, { method: 'DELETE' }).catch(() => {});
  };

  const handleWriteAbout = (title: string) => {
    setSelected(null);
    navigate('/write', { state: { fromTitle: title } });
  };

  return (
    <>
      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-stone-900 mb-1">Новости</h1>
            <p className="text-sm text-stone-400">Свежие новости о космосе</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            title="Обновить ленту"
            className="p-2 rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors disabled:opacity-30"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
        </div>

        <LaunchStrip launches={launches} onSelect={setSelectedLaunch} />
        <EventStrip events={events} onSelect={setSelectedEvent} />

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-stone-100 animate-pulse h-64" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-16">
            <p className="text-stone-400 text-sm mb-4">{error}</p>
            <button onClick={fetchNews} className="text-sm text-stone-600 underline underline-offset-2">
              Попробовать снова
            </button>
          </div>
        )}

        {!loading && !error && articles.length === 0 && (
          <p className="text-stone-400 text-sm text-center py-16">
            Лента обновляется, подождите немного…
          </p>
        )}

        {!loading && articles.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {articles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                onClick={(id) => setSelected(articles.find((a) => a.id === id) ?? null)}
                onDelete={(id) => setDeleteTarget(articles.find(a => a.id === id) ?? null)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h2 className="text-base font-bold text-stone-900 mb-2">Удалить статью?</h2>
            <p className="text-sm text-stone-500 mb-1 line-clamp-2">{deleteTarget.title}</p>
            <p className="text-xs text-stone-400 mb-6">Статья исчезнет навсегда и не вернётся при обновлении.</p>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Да, удалить
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
              >
                Нет, оставить
              </button>
            </div>
          </div>
        </div>
      )}

      <ArticleModal
        article={selected}
        onClose={() => setSelected(null)}
        onWriteAbout={handleWriteAbout}
      />

      <LaunchModal
        launch={selectedLaunch}
        onClose={() => setSelectedLaunch(null)}
      />

      <EventModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </>
  );
}
