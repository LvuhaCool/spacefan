import { useState, useRef, useEffect } from 'react';

interface Note {
  id: string;
  text: string;
  createdAt: number;
}

const STORAGE_KEY = 'spacefan_notes';

function loadNotes(): Note[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveNotes(notes: Note[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>(loadNotes);
  const [draft, setDraft] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    const next: Note[] = [{ id: crypto.randomUUID(), text, createdAt: Date.now() }, ...notes];
    setNotes(next);
    saveNotes(next);
    setDraft('');
    textareaRef.current?.focus();
  };

  const remove = (id: string) => {
    const next = notes.filter(n => n.id !== id);
    setNotes(next);
    saveNotes(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      add();
    }
  };

  const fmt = (ts: number) =>
    new Date(ts).toLocaleDateString('ru-RU', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-stone-900 mb-6">Заметки</h1>

      <div className="bg-white rounded-2xl border border-stone-200 p-4 mb-6 shadow-sm">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Новая заметка…"
          rows={3}
          className="w-full resize-none text-sm text-stone-800 placeholder-stone-400 outline-none bg-transparent"
        />
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-stone-100">
          <span className="text-xs text-stone-400">Ctrl+Enter чтобы сохранить</span>
          <button
            onClick={add}
            disabled={!draft.trim()}
            className="px-4 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-medium hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Сохранить
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="text-sm text-stone-400 text-center py-16">Нет заметок</p>
      ) : (
        <div className="space-y-3">
          {notes.map(note => (
            <div key={note.id} className="group bg-white rounded-xl border border-stone-200 p-4 shadow-sm flex gap-3">
              <p className="flex-1 text-sm text-stone-800 whitespace-pre-wrap leading-relaxed">{note.text}</p>
              <div className="flex flex-col items-end justify-between gap-2 shrink-0">
                <button
                  onClick={() => remove(note.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-stone-300 hover:text-red-500 hover:bg-red-50 transition-all"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="w-3.5 h-3.5">
                    <path d="M2.5 4h11M6 4V2.5h4V4M5.5 4v8a1 1 0 001 1h3a1 1 0 001-1V4" />
                  </svg>
                </button>
                <span className="text-xs text-stone-400">{fmt(note.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
