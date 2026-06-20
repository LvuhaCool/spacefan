import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ArticleCard from '../components/ArticleCard';
import ArticleModal from '../components/ArticleModal';
import type { Article } from '../data/articles';

export default function NewsPage() {
  const [articles, setArticles]   = useState<Article[]>([]);
  const [selected, setSelected]   = useState<Article | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch('/api/news');
      if (!res.ok) throw new Error('Ошибка сервера');
      const data: Article[] = await res.json();
      setArticles(data);
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
      // The job runs async on the server; wait a moment then re-fetch
      await new Promise(r => setTimeout(r, 8000));
      await fetchNews();
    } finally {
      setRefreshing(false);
    }
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
            <p className="text-sm text-stone-400">AI-дайджест о космосе</p>
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
            <button
              onClick={fetchNews}
              className="text-sm text-stone-600 underline underline-offset-2"
            >
              Попробовать снова
            </button>
          </div>
        )}

        {!loading && !error && articles.length === 0 && (
          <div className="text-center py-16">
            <p className="text-stone-400 text-sm">
              Лента обновляется, подождите немного…
            </p>
          </div>
        )}

        {!loading && articles.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {articles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                onClick={(id) => setSelected(articles.find((a) => a.id === id) ?? null)}
              />
            ))}
          </div>
        )}
      </main>

      <ArticleModal
        article={selected}
        onClose={() => setSelected(null)}
        onWriteAbout={handleWriteAbout}
      />
    </>
  );
}
