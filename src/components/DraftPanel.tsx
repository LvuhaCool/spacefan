import { useState } from 'react';
import type { Draft } from '../lib/storage';
import { loadAllStatuses, saveAllStatuses, type DraftStatus } from '../lib/draftStatus';

interface Props {
  drafts: Omit<Draft, 'content'>[];
  currentId: string;
  onLoad: (draft: Omit<Draft, 'content'>) => void;
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

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  );
}

function DzenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3.5 h-3.5">
      <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" />
      <path d="M5 12.5a7 7 0 0 1 14 0" />
      <path d="M8 15.5a4 4 0 0 1 8 0" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="w-3.5 h-3.5">
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.5V3M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" />
    </svg>
  );
}

export default function DraftPanel({ drafts, currentId, onLoad, onDelete, onNew, onClose }: Props) {
  const [confirmDraft, setConfirmDraft] = useState<Omit<Draft, 'content'> | null>(null);
  const [statuses, setStatuses] = useState<Record<string, DraftStatus>>(() => loadAllStatuses());

  const toggleStatus = (draftId: string, field: 'telegram' | 'dzen' | 'test') => {
    setStatuses(prev => {
      const current = prev[draftId] ?? { telegram: false, dzen: false, test: false };
      let next: DraftStatus;
      if (field === 'test') {
        next = { telegram: false, dzen: false, test: !current.test };
      } else {
        const newVal = !current[field];
        next = { ...current, [field]: newVal, test: newVal ? false : current.test };
      }
      const updated = { ...prev, [draftId]: next };
      saveAllStatuses(updated);
      return updated;
    });
  };

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
            drafts.map((draft) => {
              const st = statuses[draft.id] ?? { telegram: false, dzen: false, test: false };
              return (
                <div
                  key={draft.id}
                  className={`p-3 rounded-xl border transition-colors flex items-center gap-2 ${
                    draft.id === currentId
                      ? 'border-stone-800 bg-stone-50'
                      : 'border-stone-100 hover:border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  {/* Clickable title + date area */}
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => onLoad(draft)}
                  >
                    <p className="text-sm font-medium text-stone-900 truncate">
                      {draft.title || 'Без названия'}
                    </p>
                    <p className="text-xs text-stone-400 mt-0.5">{formatDate(draft.updatedAt)}</p>
                  </div>

                  {/* Status icons + delete */}
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleStatus(draft.id, 'telegram'); }}
                      title="Опубликовано в Telegram"
                      className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors ${
                        st.telegram ? 'text-[#2CA5E0]' : 'text-stone-300 hover:text-stone-500'
                      }`}
                    >
                      <TelegramIcon />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleStatus(draft.id, 'dzen'); }}
                      title="Опубликовано в Дзен"
                      className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors ${
                        st.dzen ? 'text-orange-500' : 'text-stone-300 hover:text-stone-500'
                      }`}
                    >
                      <DzenIcon />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleStatus(draft.id, 'test'); }}
                      title="Тестовая статья"
                      className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors ${
                        st.test ? 'text-amber-500' : 'text-stone-300 hover:text-stone-500'
                      }`}
                    >
                      <GearIcon />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDraft(draft); }}
                      title="Удалить черновик"
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-stone-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              );
            })
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
