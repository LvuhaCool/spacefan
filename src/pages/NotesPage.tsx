import { useState, useRef, useEffect } from 'react';

interface Note {
  id: string;
  text: string;
  createdAt: number;
  updatedAt: number;
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="w-3.5 h-3.5">
      <path d="M2.5 4h11M6 4V2.5h4V4M5.5 4v8a1 1 0 001 1h3a1 1 0 001-1V4" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="w-3.5 h-3.5">
      <path d="M11 2.5l2.5 2.5-7.5 7.5H3.5V10L11 2.5z" />
      <path d="M9.5 4l2.5 2.5" />
    </svg>
  );
}

async function apiSave(note: Note) {
  await fetch('/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(note),
  });
}

async function apiDelete(id: string) {
  await fetch(`/api/notes/${id}`, { method: 'DELETE' });
}

function fmt(ts: number) {
  return new Date(ts).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function NotesPage() {
  const [notes,     setNotes]     = useState<Note[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [draft,     setDraft]     = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText,  setEditText]  = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const newRef  = useRef<HTMLTextAreaElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch('/api/notes')
      .then(r => r.json())
      .then(data => { setNotes(data); setLoading(false); })
      .catch(() => setLoading(false));
    newRef.current?.focus();
  }, []);

  // Auto-resize the edit textarea
  useEffect(() => {
    if (editRef.current) {
      editRef.current.style.height = 'auto';
      editRef.current.style.height = editRef.current.scrollHeight + 'px';
    }
  }, [editText]);

  // Focus and move caret to end when entering edit mode
  useEffect(() => {
    if (editingId && editRef.current) {
      editRef.current.focus();
      const len = editRef.current.value.length;
      editRef.current.setSelectionRange(len, len);
    }
  }, [editingId]);

  const add = async () => {
    const text = draft.trim();
    if (!text) return;
    const note: Note = { id: crypto.randomUUID(), text, createdAt: Date.now(), updatedAt: Date.now() };
    setNotes(prev => [note, ...prev]);
    setDraft('');
    newRef.current?.focus();
    await apiSave(note);
  };

  const startEdit = (note: Note) => {
    setEditingId(note.id);
    setEditText(note.text);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const text = editText.trim();
    if (!text) return;
    const updated: Note = {
      ...notes.find(n => n.id === editingId)!,
      text,
      updatedAt: Date.now(),
    };
    setNotes(prev => prev.map(n => n.id === editingId ? updated : n));
    setEditingId(null);
    await apiSave(updated);
  };

  const doDelete = async () => {
    if (!confirmId) return;
    setNotes(prev => prev.filter(n => n.id !== confirmId));
    const id = confirmId;
    setConfirmId(null);
    await apiDelete(id);
  };

  if (loading) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-24 flex justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-stone-300 border-t-stone-600 animate-spin" />
      </main>
    );
  }

  return (
    <>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-xl font-bold text-stone-900 mb-6">Заметки</h1>

        {/* New note input */}
        <div className="bg-white rounded-2xl border border-stone-200 p-4 mb-6 shadow-sm">
          <textarea
            ref={newRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); add(); } }}
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
              <div key={note.id} className="group bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
                {editingId === note.id ? (
                  <div>
                    <textarea
                      ref={editRef}
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveEdit(); }
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="w-full resize-none text-sm text-stone-800 outline-none bg-transparent leading-relaxed mb-3 min-h-[3rem]"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-medium text-stone-500 hover:bg-stone-50 transition-colors"
                      >
                        Отмена
                      </button>
                      <button
                        onClick={saveEdit}
                        disabled={!editText.trim()}
                        className="px-3 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-medium hover:bg-stone-800 disabled:opacity-30 transition-colors"
                      >
                        Сохранить
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <p
                      className="flex-1 text-sm text-stone-800 whitespace-pre-wrap leading-relaxed cursor-text"
                      onClick={() => startEdit(note)}
                    >
                      {note.text}
                    </p>
                    <div className="flex flex-col items-end justify-between gap-2 shrink-0">
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEdit(note)}
                          title="Редактировать"
                          className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                        >
                          <PencilIcon />
                        </button>
                        <button
                          onClick={() => setConfirmId(note.id)}
                          title="Удалить"
                          className="p-1 rounded-md text-stone-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                      <span className="text-xs text-stone-400">{fmt(note.updatedAt)}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Delete confirmation */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmId(null)} />
          <div className="relative bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h2 className="text-base font-bold text-stone-900 mb-2">Удалить заметку?</h2>
            <p className="text-sm text-stone-500 mb-6 line-clamp-3">
              {notes.find(n => n.id === confirmId)?.text}
            </p>
            <div className="flex gap-3">
              <button
                onClick={doDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Да, удалить
              </button>
              <button
                onClick={() => setConfirmId(null)}
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
