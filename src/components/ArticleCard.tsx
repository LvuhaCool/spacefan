import type { Article } from '../data/articles';

interface Props {
  article: Article;
  onClick: (id: number) => void;
}

export default function ArticleCard({ article, onClick }: Props) {
  return (
    <article
      onClick={() => onClick(article.id)}
      className="bg-white rounded-2xl overflow-hidden border border-stone-100 shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]"
    >
      <div className="aspect-[16/9] overflow-hidden bg-stone-100">
        <img
          src={article.imageUrl}
          alt={article.title}
          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
          loading="lazy"
        />
      </div>

      <div className="p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-stone-400 uppercase tracking-wide">
            {article.category}
          </span>
          <span className="text-stone-200">·</span>
          <span className="text-xs text-stone-400">{article.date}</span>
          <span className="text-stone-200">·</span>
          <span className="text-xs text-stone-400">{article.readTime} мин</span>
        </div>

        <h2 className="text-base font-semibold text-stone-900 leading-snug line-clamp-2">
          {article.title}
        </h2>

        <p className="text-sm text-stone-500 leading-relaxed line-clamp-2">
          {article.excerpt}
        </p>
      </div>
    </article>
  );
}
