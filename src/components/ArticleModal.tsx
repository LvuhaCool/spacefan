import { useEffect } from 'react';
import type { Article } from '../data/articles';

interface Props {
  article: Article | null;
  onClose: () => void;
  onWriteAbout: (title: string) => void;
}

export default function ArticleModal({ article, onClose, onWriteAbout }: Props) {
  useEffect(() => {
    if (!article) return;
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [article, onClose]);

  if (!article) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="relative bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl max-h-[92svh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="aspect-[16/7] overflow-hidden flex-shrink-0 bg-stone-100">
          <img
            src={article.imageUrl}
            alt={article.title}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-medium text-stone-400 uppercase tracking-wide">
              {article.category}
            </span>
            <span className="text-stone-200">·</span>
            <span className="text-xs text-stone-400">{article.date}</span>
            <span className="text-stone-200">·</span>
            <span className="text-xs text-stone-400">{article.readTime} мин</span>
          </div>

          <h1 className="text-xl font-bold text-stone-900 leading-snug mb-4">
            {article.title}
          </h1>

          <p className="text-sm text-stone-500 leading-relaxed mb-6 italic border-l-2 border-stone-200 pl-3">
            {article.excerpt}
          </p>

          <div className="text-[15px] text-stone-700 leading-relaxed space-y-4">
            {article.content.split('\n\n').map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </div>

        <div className="flex-shrink-0 p-4 border-t border-stone-100 flex flex-col gap-2">
          <button
            onClick={() => onWriteAbout(article.title)}
            className="w-full py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition-colors text-center"
          >
            Написать статью на эту тему
          </button>
          <div className="flex gap-2">
            {article.sourceUrl && (
              <a
                href={article.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors text-center"
              >
                Источник ↗
              </a>
            )}
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
