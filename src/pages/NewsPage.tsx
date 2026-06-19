import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ArticleCard from '../components/ArticleCard';
import ArticleModal from '../components/ArticleModal';
import type { Article } from '../data/articles';
import { articles } from '../data/articles';

export default function NewsPage() {
  const [selected, setSelected] = useState<Article | null>(null);
  const navigate = useNavigate();

  const handleWriteAbout = (title: string) => {
    setSelected(null);
    navigate('/write', { state: { fromTitle: title } });
  };

  return (
    <>
      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-stone-900 mb-1">Новости</h1>
          <p className="text-sm text-stone-400">AI-дайджест о космосе</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {articles.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              onClick={(id) => setSelected(articles.find((a) => a.id === id) ?? null)}
            />
          ))}
        </div>
      </main>

      <ArticleModal
        article={selected}
        onClose={() => setSelected(null)}
        onWriteAbout={handleWriteAbout}
      />
    </>
  );
}
