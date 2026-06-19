import type { Draft } from '../lib/storage';

interface Props {
  drafts: Draft[];
  currentId: string;
  onLoad: (draft: Draft) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DraftPanel({ drafts, currentId, onLoad, onDelete, onNew, onClose }: Props) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-80 bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <h2 className="text-base font-semibold text-stone-900">Мои статьи</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-4 pt-4">
          <button
            onClick={onNew}
            className="w-full py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition-colors"
          >
            + Новая статья
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 mt-3">
          {drafts.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-10">
              Нет сохранённых статей
            </p>
          ) : (
            drafts.map((draft) => (
              <div
                key={draft.id}
                onClick={() => onLoad(draft)}
                className={`p-3 rounded-xl border cursor-pointer transition-colors group relative ${
                  draft.id === currentId
                    ? 'border-stone-800 bg-stone-50'
                    : 'border-stone-100 hover:border-stone-200 hover:bg-stone-50'
                }`}
              >
                <p className="text-sm font-medium text-stone-900 truncate pr-6">
                  {draft.title || 'Без названия'}
                </p>
                <p className="text-xs text-stone-400 mt-0.5">{formatDate(draft.updatedAt)}</p>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(draft.id);
                  }}
                  className="absolute top-3 right-3 w-5 h-5 flex items-center justify-center text-stone-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-sm leading-none"
                  title="Удалить"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
