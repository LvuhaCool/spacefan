import { useRef, useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DraftPanel from '../components/DraftPanel';
import { saveDraft, getDrafts, deleteDraft, getDraft } from '../lib/storage';
import type { Draft } from '../lib/storage';

type SaveStatus = 'saved' | 'saving' | 'unsaved';

function ToolBtn({
  onMouseDown,
  title,
  children,
}: {
  onMouseDown: (e: React.MouseEvent) => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onMouseDown={onMouseDown}
      title={title}
      className="w-8 h-8 flex items-center justify-center rounded-lg text-sm text-stone-500 hover:bg-stone-200/60 hover:text-stone-900 transition-colors select-none"
    >
      {children}
    </button>
  );
}

export default function WritePage() {
  const editorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const draggingFigRef = useRef<HTMLElement | null>(null);
  const skipObserverRef = useRef(false);

  const location = useLocation();
  const navigate = useNavigate();

  const [draftId, setDraftId] = useState<string>(() => crypto.randomUUID());
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [panelOpen, setPanelOpen] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>(() => getDrafts());

  // ── Auto-save ────────────────────────────────────────────────
  const doSave = useCallback(
    (id: string) => {
      setSaveStatus('saving');
      const existing = getDraft(id);
      saveDraft({
        id,
        title: titleRef.current?.value.trim() || 'Без названия',
        content: editorRef.current?.innerHTML ?? '',
        updatedAt: Date.now(),
        createdAt: existing?.createdAt ?? Date.now(),
      });
      setDrafts(getDrafts());
      setSaveStatus('saved');
    },
    []
  );

  const scheduleAutoSave = useCallback(() => {
    setSaveStatus('unsaved');
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => doSave(draftId), 700);
  }, [draftId, doSave]);

  // MutationObserver on the editor
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const obs = new MutationObserver(() => {
      if (skipObserverRef.current) return;
      scheduleAutoSave();
    });
    obs.observe(editor, { childList: true, subtree: true, characterData: true });
    return () => obs.disconnect();
  }, [scheduleAutoSave]);

  // ── Load from navigation state (write-about-this) ────────────
  useEffect(() => {
    const state = location.state as { fromTitle?: string } | null;
    if (!state?.fromTitle) return;
    const newId = crypto.randomUUID();
    setDraftId(newId);
    if (titleRef.current) titleRef.current.value = state.fromTitle;
    if (editorRef.current) editorRef.current.innerHTML = '';
    setSaveStatus('unsaved');
    navigate('/write', { replace: true, state: null });
  }, [location.state, navigate]);

  // ── Draft management ─────────────────────────────────────────
  const loadDraft = useCallback((draft: Draft) => {
    skipObserverRef.current = true;
    setDraftId(draft.id);
    if (titleRef.current) titleRef.current.value = draft.title === 'Без названия' ? '' : draft.title;
    if (editorRef.current) editorRef.current.innerHTML = draft.content;
    setPanelOpen(false);
    setSaveStatus('saved');
    setTimeout(() => { skipObserverRef.current = false; }, 50);
  }, []);

  const newDraft = useCallback(() => {
    skipObserverRef.current = true;
    const id = crypto.randomUUID();
    setDraftId(id);
    if (titleRef.current) titleRef.current.value = '';
    if (editorRef.current) editorRef.current.innerHTML = '';
    setPanelOpen(false);
    setSaveStatus('saved');
    setTimeout(() => { skipObserverRef.current = false; }, 50);
  }, []);

  const handleDeleteDraft = useCallback(
    (id: string) => {
      deleteDraft(id);
      const remaining = getDrafts();
      setDrafts(remaining);
      if (id === draftId) newDraft();
    },
    [draftId, newDraft]
  );

  const openPanel = () => {
    setDrafts(getDrafts());
    setPanelOpen(true);
  };

  // ── Drag-and-drop for image blocks ───────────────────────────
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const clearDropIndicators = () => {
      editor.querySelectorAll('[data-drop-before]').forEach((el) =>
        el.removeAttribute('data-drop-before')
      );
    };

    const getDropTarget = (clientY: number): Element | null => {
      const children = Array.from(editor.children).filter(
        (c) => c !== draggingFigRef.current
      );
      for (const child of children) {
        const rect = child.getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2) return child;
      }
      return null;
    };

    const onDragStart = (e: DragEvent) => {
      const fig = (e.target as HTMLElement).closest<HTMLElement>('[data-image-block]');
      if (!fig) return;
      draggingFigRef.current = fig;
      fig.classList.add('is-dragging');
      e.dataTransfer!.effectAllowed = 'move';
    };

    const onDragEnd = () => {
      draggingFigRef.current?.classList.remove('is-dragging');
      draggingFigRef.current = null;
      clearDropIndicators();
    };

    const onDragOver = (e: DragEvent) => {
      if (!draggingFigRef.current) return;
      e.preventDefault();
      clearDropIndicators();
      const target = getDropTarget(e.clientY);
      if (target) target.setAttribute('data-drop-before', '');
    };

    const onDrop = (e: DragEvent) => {
      if (!draggingFigRef.current) return;
      e.preventDefault();
      clearDropIndicators();
      const insertBefore = getDropTarget(e.clientY);
      if (insertBefore) {
        editor.insertBefore(draggingFigRef.current, insertBefore);
      } else {
        editor.appendChild(draggingFigRef.current);
      }
      draggingFigRef.current.classList.remove('is-dragging');
      draggingFigRef.current = null;
      scheduleAutoSave();
    };

    editor.addEventListener('dragstart', onDragStart);
    editor.addEventListener('dragend', onDragEnd);
    editor.addEventListener('dragover', onDragOver);
    editor.addEventListener('drop', onDrop);
    return () => {
      editor.removeEventListener('dragstart', onDragStart);
      editor.removeEventListener('dragend', onDragEnd);
      editor.removeEventListener('dragover', onDragOver);
      editor.removeEventListener('drop', onDrop);
    };
  }, [scheduleAutoSave]);

  // ── Image insertion ──────────────────────────────────────────
  const insertImage = (file: File) => {
    const editor = editorRef.current;
    if (!editor) return;

    const url = URL.createObjectURL(file);

    const figure = document.createElement('figure');
    figure.setAttribute('data-image-block', '');
    figure.setAttribute('contenteditable', 'false');
    figure.setAttribute('draggable', 'true');

    const handle = document.createElement('div');
    handle.className = 'drag-handle';
    handle.textContent = '⠿';

    const img = document.createElement('img');
    img.src = url;
    img.alt = file.name;

    const caption = document.createElement('figcaption');
    caption.setAttribute('contenteditable', 'true');
    caption.setAttribute('data-placeholder', 'Подпись к фото...');

    figure.append(handle, img, caption);

    // Insert after the current block-level cursor position
    const sel = window.getSelection();
    let inserted = false;
    if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
      let node: Node | null = sel.anchorNode;
      while (node && node.parentNode !== editor) node = node.parentNode;
      if (node && node.parentNode === editor) {
        (node as Element).after(figure);
        inserted = true;
      }
    }
    if (!inserted) editor.appendChild(figure);

    // Ensure a paragraph after the figure
    if (!figure.nextElementSibling) {
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      figure.after(p);
    }

    scheduleAutoSave();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach(insertImage);
    e.target.value = '';
  };

  // ── execCommand wrapper ──────────────────────────────────────
  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
  };

  const prevent = (e: React.MouseEvent) => e.preventDefault();

  // ── Save status label ────────────────────────────────────────
  const statusLabel =
    saveStatus === 'saving'
      ? 'Сохранение...'
      : saveStatus === 'unsaved'
      ? '●'
      : 'Сохранено';

  return (
    <>
      <main className="max-w-3xl mx-auto px-4 pb-24">
        {/* Top bar */}
        <div className="flex items-center justify-between py-4">
          <button
            onClick={openPanel}
            className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-900 transition-colors"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 flex-shrink-0">
              <rect x="2" y="2" width="12" height="2" rx="1" />
              <rect x="2" y="7" width="9" height="2" rx="1" />
              <rect x="2" y="12" width="6" height="2" rx="1" />
            </svg>
            Мои статьи
            {drafts.length > 0 && (
              <span className="text-stone-300">({drafts.length})</span>
            )}
          </button>

          <div className="flex items-center gap-3">
            <span
              className={`text-xs transition-colors ${
                saveStatus === 'unsaved' ? 'text-amber-400' : 'text-stone-300'
              }`}
            >
              {statusLabel}
            </span>
            <button
              onClick={newDraft}
              className="text-sm text-stone-400 hover:text-stone-900 transition-colors"
            >
              + Новая
            </button>
          </div>
        </div>

        {/* Title */}
        <input
          ref={titleRef}
          type="text"
          placeholder="Заголовок"
          onChange={scheduleAutoSave}
          className="w-full text-3xl sm:text-4xl font-bold text-stone-900 placeholder:text-stone-200 outline-none bg-transparent mb-6 leading-tight"
        />

        {/* Toolbar */}
        <div className="flex items-center gap-0.5 flex-wrap pb-4 mb-2 border-b border-stone-100">
          <ToolBtn onMouseDown={(e) => { prevent(e); exec('bold'); }} title="Жирный">
            <strong className="font-bold">B</strong>
          </ToolBtn>
          <ToolBtn onMouseDown={(e) => { prevent(e); exec('italic'); }} title="Курсив">
            <em>I</em>
          </ToolBtn>
          <ToolBtn onMouseDown={(e) => { prevent(e); exec('underline'); }} title="Подчёркнутый">
            <span className="underline">U</span>
          </ToolBtn>
          <ToolBtn onMouseDown={(e) => { prevent(e); exec('strikeThrough'); }} title="Зачёркнутый">
            <span className="line-through">S</span>
          </ToolBtn>

          <div className="w-px h-5 bg-stone-100 mx-1 flex-shrink-0" />

          <ToolBtn onMouseDown={(e) => { prevent(e); exec('formatBlock', 'H2'); }} title="Заголовок H2">
            <span className="text-xs font-bold">H2</span>
          </ToolBtn>
          <ToolBtn onMouseDown={(e) => { prevent(e); exec('formatBlock', 'H3'); }} title="Заголовок H3">
            <span className="text-xs font-bold">H3</span>
          </ToolBtn>
          <ToolBtn onMouseDown={(e) => { prevent(e); exec('formatBlock', 'p'); }} title="Обычный текст">
            <span className="text-xs">P</span>
          </ToolBtn>

          <div className="w-px h-5 bg-stone-100 mx-1 flex-shrink-0" />

          <ToolBtn
            onMouseDown={(e) => { prevent(e); exec('insertUnorderedList'); }}
            title="Маркированный список"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <circle cx="2" cy="4" r="1.5" />
              <rect x="5" y="3" width="9" height="2" rx="1" />
              <circle cx="2" cy="8" r="1.5" />
              <rect x="5" y="7" width="9" height="2" rx="1" />
              <circle cx="2" cy="12" r="1.5" />
              <rect x="5" y="11" width="9" height="2" rx="1" />
            </svg>
          </ToolBtn>
          <ToolBtn
            onMouseDown={(e) => { prevent(e); exec('insertOrderedList'); }}
            title="Нумерованный список"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <text x="0" y="5" fontSize="5" fontFamily="monospace">1.</text>
              <rect x="5" y="3" width="9" height="2" rx="1" />
              <text x="0" y="9" fontSize="5" fontFamily="monospace">2.</text>
              <rect x="5" y="7" width="9" height="2" rx="1" />
              <text x="0" y="13" fontSize="5" fontFamily="monospace">3.</text>
              <rect x="5" y="11" width="9" height="2" rx="1" />
            </svg>
          </ToolBtn>

          <div className="w-px h-5 bg-stone-100 mx-1 flex-shrink-0" />

          <ToolBtn
            onMouseDown={(e) => { prevent(e); fileInputRef.current?.click(); }}
            title="Вставить изображение"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
              <rect x="1" y="3" width="14" height="10" rx="2" />
              <circle cx="5.5" cy="6.5" r="1.5" />
              <path d="M1 10l3.5-3 3 3 2.5-2.5 4 3.5" strokeLinejoin="round" />
            </svg>
          </ToolBtn>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Editor canvas */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Начните писать..."
          className="
            min-h-[65vh] outline-none
            text-[16px] leading-relaxed text-stone-800
            empty:before:content-[attr(data-placeholder)] empty:before:text-stone-200 empty:before:pointer-events-none
            [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-stone-900 [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:leading-tight
            [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-stone-900 [&_h3]:mt-4 [&_h3]:mb-1
            [&_p]:mb-3
            [&_ul]:list-disc [&_ul]:ml-5 [&_ul]:mb-3
            [&_ol]:list-decimal [&_ol]:ml-5 [&_ol]:mb-3
          "
        />
      </main>

      {/* Fixed footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#f8f7f5]/90 backdrop-blur-sm border-t border-stone-100 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex gap-2">
          <button className="flex-1 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition-colors">
            Опубликовать
          </button>
          <button className="px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">
            Telegram
          </button>
          <button className="px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">
            Дзен
          </button>
        </div>
      </div>

      {panelOpen && (
        <DraftPanel
          drafts={drafts}
          currentId={draftId}
          onLoad={loadDraft}
          onDelete={handleDeleteDraft}
          onNew={newDraft}
          onClose={() => setPanelOpen(false)}
        />
      )}
    </>
  );
}
