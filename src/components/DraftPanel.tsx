import { useState } from 'react';
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

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="w-4 h-4">
      <path d="M2.5 4h11" />
      <path d="M6 4V2.5h4V4" />
      <path d="M5.5 4v8a1 1 0 001 1h3a1 1 0 001-1V4" />
      <path d="M7 7v3.5M9 7v3.5" />
    </svg>
  );
}

export default function DraftPanel({ drafts, currentId, onLoad, onDelete, onNew, onClose }: Props) {
  const [confirmDraft, setConfirmDraft] = useState<Draft | null>(null);

  const handleConfirm = () => {
    if (!confirmDraft) return;
    onDelete(confirmDraft.id);
    setConfirmDraft(null);
  };

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
                className={`p-3 rounded-xl border cursor-pointer transition-colors relative ${
                  draft.id === currentId
                    ? 'border-stone-800 bg-stone-50'
                    : 'border-stone-100 hover:border-stone-200 hover:bg-stone-50'
                }`}
              >
                <p className="text-sm font-medium text-stone-900 truncate pr-9">
                  {draft.title || 'Без названия'}
                </p>
                <p className="text-xs text-stone-400 mt-0.5">{formatDate(draft.updatedAt)}</p>

                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDraft(draft); }}
                  title="Удалить черновик"
                  className="absolute top-1/2 -translate-y-1/2 right-2.5 w-7 h-7 flex items-center justify-center rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <TrashIcon />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Delete confirmation — sits above the panel */}
      {confirmDraft && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDraft(null)} />
          <div className="relative bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h2 className="text-base font-bold text-stone-900 mb-2">Удалить черновик?</h2>
            <p className="text-sm text-stone-500 mb-6 line-clamp-2">
              {confirmDraft.title || 'Без названия'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleConfirm}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Да, удалить
              </button>
              <button
                onClick={() => setConfirmDraft(null)}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
              >
                Нет, оставить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
