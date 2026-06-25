import { useRef, useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DraftPanel from '../components/DraftPanel';
import PublishModal from '../components/PublishModal';
import { saveDraft, getDrafts, getDraft, deleteDraft } from '../lib/storage';
import type { Draft } from '../lib/storage';

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

interface ActiveFormats {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikeThrough: boolean;
  blockType: string;
  mixed: boolean;
  link: boolean;
}

const EMPTY_FORMATS: ActiveFormats = {
  bold: false, italic: false, underline: false,
  strikeThrough: false, blockType: '', mixed: false, link: false,
};

function ToolBtn({
  onMouseDown,
  title,
  children,
  active = false,
}: {
  onMouseDown: (e: React.MouseEvent) => void;
  title: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      onMouseDown={onMouseDown}
      title={title}
      className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors select-none ${
        active
          ? 'bg-stone-900 text-white'
          : 'text-stone-500 hover:bg-stone-200/60 hover:text-stone-900'
      }`}
    >
      {children}
    </button>
  );
}

function FloatBtn({
  onMouseDown,
  title,
  children,
  active = false,
}: {
  onMouseDown: (e: React.MouseEvent) => void;
  title: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      onMouseDown={onMouseDown}
      title={title}
      className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors select-none ${
        active
          ? 'bg-white/25 text-white'
          : 'text-white/80 hover:bg-white/15 active:bg-white/25'
      }`}
    >
      {children}
    </button>
  );
}

export default function WritePage() {
  const editorRef    = useRef<HTMLDivElement>(null);
  const titleRef     = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef    = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const draggingFigRef  = useRef<HTMLElement | null>(null);
  const skipObserverRef = useRef(false);
  // tracks the createdAt timestamp for the draft currently open in the editor
  const createdAtRef    = useRef<number>(Date.now());

  const location = useLocation();
  const navigate = useNavigate();

  const [draftId,       setDraftId]       = useState<string>(() => crypto.randomUUID());
  const [saveStatus,    setSaveStatus]    = useState<SaveStatus>('saved');
  const [panelOpen,     setPanelOpen]     = useState(false);
  const [drafts,        setDrafts]        = useState<Omit<Draft, 'content'>[]>([]);
  const [floatPos,      setFloatPos]      = useState<{ top: number; left: number } | null>(null);
  const [activeFormats, setActiveFormats] = useState<ActiveFormats>(EMPTY_FORMATS);
  const [publishData,    setPublishData]    = useState<{ title: string; content: string; draftId: string } | null>(null);
  const [linkPromptOpen, setLinkPromptOpen] = useState(false);
  const [linkUrl,        setLinkUrl]        = useState('');
  const [charCount,      setCharCount]      = useState(0);
  const savedRangeRef = useRef<Range | null>(null);

  // ── Active format detection ──────────────────────────────────
  const updateActiveFormats = useCallback(() => {
    const sel    = window.getSelection();
    const editor = editorRef.current;

    // Detect link even on collapsed cursor
    let link = false;
    if (sel && sel.rangeCount && editor?.contains(sel.anchorNode)) {
      let n: Node | null = sel.anchorNode;
      while (n && n !== editor) {
        if ((n as HTMLElement).tagName === 'A') { link = true; break; }
        n = n.parentNode;
      }
    }

    if (!sel || sel.isCollapsed || !sel.rangeCount || !editor?.contains(sel.anchorNode)) {
      setActiveFormats({ ...EMPTY_FORMATS, link });
      return;
    }

    try {
      const blockType     = document.queryCommandValue('formatBlock').toLowerCase();
      const isHeading     = blockType === 'h2' || blockType === 'h3';
      const bold          = isHeading ? false : document.queryCommandState('bold');
      const italic        = document.queryCommandState('italic');
      const underline     = document.queryCommandState('underline');
      const strikeThrough = document.queryCommandState('strikeThrough');

      const range    = sel.getRangeAt(0);
      const fragment = range.cloneContents();

      let mixed = false;
      if (!bold        && fragment.querySelector('b, strong'))            mixed = true;
      if (!italic      && fragment.querySelector('i, em'))                mixed = true;
      if (!underline   && fragment.querySelector('u'))                    mixed = true;
      if (!strikeThrough && (fragment.querySelector('s, strike')))        mixed = true;

      setActiveFormats({ bold, italic, underline, strikeThrough, blockType, mixed, link });
    } catch {
      setActiveFormats(EMPTY_FORMATS);
    }
  }, []);

  // ── Load drafts on mount ─────────────────────────────────────
  useEffect(() => {
    getDrafts().then(setDrafts);
  }, []);

  // ── Auto-save ────────────────────────────────────────────────
  const doSave = useCallback(
    async (id: string) => {
      setSaveStatus('saving');
      try {
        await saveDraft({
          id,
          title:     titleRef.current?.textContent?.trim() || 'Без названия',
          content:   editorRef.current?.innerHTML ?? '',
          updatedAt: Date.now(),
          createdAt: createdAtRef.current,
        });
        setDrafts(await getDrafts());
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
    },
    []
  );

  const scheduleAutoSave = useCallback(() => {
    setSaveStatus('unsaved');
    setCharCount((titleRef.current?.textContent?.length ?? 0) + (editorRef.current?.textContent?.length ?? 0));
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => doSave(draftId), 700);
  }, [draftId, doSave]);

  // MutationObserver on the editor body
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

  // ── selectionchange: active formats + mobile floating toolbar ─
  useEffect(() => {
    const isTouch  = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const TOOLBAR_W = 300;
    const TOOLBAR_H = 60;  // slightly tall to account for optional label row
    const SAMSUNG_H = 58;  // Samsung/iOS system selection toolbar height
    const GAP = 8;

    const onSelectionChange = () => {
      updateActiveFormats();
      if (!isTouch) return;

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) { setFloatPos(null); return; }

      const range  = sel.getRangeAt(0);
      const editor = editorRef.current;
      if (!editor || !editor.contains(range.commonAncestorContainer)) { setFloatPos(null); return; }

      const rect = range.getBoundingClientRect();
      if (!rect.width && !rect.height) { setFloatPos(null); return; }

      let left = rect.left + rect.width / 2 - TOOLBAR_W / 2;
      left = Math.max(GAP, Math.min(left, window.innerWidth - TOOLBAR_W - GAP));

      // Place BELOW the selection by default — system toolbar is usually above the text,
      // so this avoids overlap. Only go above when below is off-screen, leaving SAMSUNG_H
      // gap above the text for the system bar.
      let top = rect.bottom + GAP;
      if (top + TOOLBAR_H > window.innerHeight - 16) {
        top = rect.top - TOOLBAR_H - SAMSUNG_H - GAP;
        if (top < GAP) top = GAP;
      }

      setFloatPos({ top, left });
    };

    const onScroll = () => setFloatPos(null);

    document.addEventListener('selectionchange', onSelectionChange);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      window.removeEventListener('scroll', onScroll);
    };
  }, [updateActiveFormats]);

  // ── Load from navigation state (write-about-this) ────────────
  useEffect(() => {
    const state = location.state as { fromTitle?: string } | null;
    if (!state?.fromTitle) return;
    const newId = crypto.randomUUID();
    setDraftId(newId);
    createdAtRef.current = Date.now();
    if (titleRef.current)  titleRef.current.textContent  = state.fromTitle;
    if (editorRef.current) editorRef.current.innerHTML   = '';
    setSaveStatus('unsaved');
    navigate('/write', { replace: true, state: null });
  }, [location.state, navigate]);

  // ── Draft management ─────────────────────────────────────────
  const loadDraft = useCallback(async (draft: Omit<Draft, 'content'>) => {
    const full = await getDraft(draft.id);
    if (!full) return;
    skipObserverRef.current = true;
    setDraftId(full.id);
    createdAtRef.current = full.createdAt;
    if (titleRef.current)  titleRef.current.textContent  = full.title === 'Без названия' ? '' : full.title;
    if (editorRef.current) editorRef.current.innerHTML   = full.content;
    setPanelOpen(false);
    setSaveStatus('saved');
    setTimeout(() => {
      setCharCount((titleRef.current?.textContent?.length ?? 0) + (editorRef.current?.textContent?.length ?? 0));
      skipObserverRef.current = false;
    }, 50);
  }, []);

  const newDraft = useCallback(() => {
    skipObserverRef.current = true;
    const id = crypto.randomUUID();
    setDraftId(id);
    createdAtRef.current = Date.now();
    if (titleRef.current)  titleRef.current.textContent  = '';
    if (editorRef.current) editorRef.current.innerHTML   = '';
    setPanelOpen(false);
    setSaveStatus('saved');
    setCharCount(0);
    setTimeout(() => { skipObserverRef.current = false; }, 50);
  }, []);

  const handleDeleteDraft = useCallback(
    async (id: string) => {
      await deleteDraft(id);
      setDrafts(await getDrafts());
      if (id === draftId) newDraft();
    },
    [draftId, newDraft]
  );

  const openPanel = () => {
    getDrafts().then(setDrafts);
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
    editor.addEventListener('dragend',   onDragEnd);
    editor.addEventListener('dragover',  onDragOver);
    editor.addEventListener('drop',      onDrop);
    return () => {
      editor.removeEventListener('dragstart', onDragStart);
      editor.removeEventListener('dragend',   onDragEnd);
      editor.removeEventListener('dragover',  onDragOver);
      editor.removeEventListener('drop',      onDrop);
    };
  }, [scheduleAutoSave]);

  // ── Image insertion ──────────────────────────────────────────
  const insertImage = async (file: File) => {
    const editor = editorRef.current;
    if (!editor) return;

    // Capture insertion point NOW (synchronously) before the async FileReader,
    // because the selection may change or clear by the time the read completes.
    let insertAfterNode: Node | null = null;
    const sel0 = window.getSelection();
    if (sel0 && sel0.rangeCount > 0 && editor.contains(sel0.anchorNode)) {
      let node: Node | null = sel0.anchorNode;
      while (node && node.parentNode !== editor) node = node.parentNode;
      if (node && node.parentNode === editor) insertAfterNode = node;
    }

    // Base64 so the image survives across devices, tabs, and sessions
    const url = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target!.result as string);
      reader.readAsDataURL(file);
    });

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

    if (insertAfterNode) {
      (insertAfterNode as Element).after(figure);
    } else {
      editor.appendChild(figure);
    }

    if (!figure.nextElementSibling) {
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      figure.after(p);
    }

    // Park the cursor in the paragraph right after the image so the next paste
    // (or keystroke) lands there, not at the old position or the document end.
    const afterFig = figure.nextElementSibling;
    if (afterFig) {
      const r = document.createRange();
      r.setStart(afterFig, 0);
      r.collapse(true);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(r);
      editor.focus();
    }

    scheduleAutoSave();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach(file => { void insertImage(file); });
    e.target.value = '';
  };

  // Intercept image paste (Ctrl+V / mobile paste)
  const handleEditorPaste = (e: React.ClipboardEvent) => {
    const items     = Array.from(e.clipboardData.items);
    const imageItem = items.find(item => item.type.startsWith('image/'));
    if (imageItem) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (file) void insertImage(file);
    }
  };

  // ── execCommand wrapper ──────────────────────────────────────
  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
  };

  const prevent = (e: React.MouseEvent) => e.preventDefault();

  // ── Link prompt ──────────────────────────────────────────────
  const openLinkPrompt = () => {
    if (activeFormats.link) { exec('unlink'); return; }
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    setLinkUrl('');
    setLinkPromptOpen(true);
  };

  const applyLink = (url: string) => {
    setLinkPromptOpen(false);
    if (!url.trim()) return;
    const range = savedRangeRef.current;
    if (range) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    exec('createLink', /^https?:\/\//i.test(url) ? url : `https://${url}`);
    savedRangeRef.current = null;
  };

  // ── Callout (blockquote) toggle ──────────────────────────────
  const toggleCallout = (e?: React.MouseEvent) => {
    if (e) prevent(e);
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      let node: Node | null = sel.anchorNode;
      while (node && node !== editorRef.current) {
        if ((node as HTMLElement).tagName === 'BLOCKQUOTE') {
          exec('formatBlock', 'P');
          return;
        }
        node = node.parentNode;
      }
    }
    exec('formatBlock', 'BLOCKQUOTE');
  };

  // ── Editor keydown: shortcuts + blockquote exit ──────────────
  const handleEditorKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b': e.preventDefault(); exec('bold'); return;
        case 'i': e.preventDefault(); exec('italic'); return;
        case 'u': e.preventDefault(); exec('underline'); return;
        case 't': e.preventDefault(); exec('strikeThrough'); return;
        case '2': e.preventDefault(); exec('formatBlock', 'H2'); return;
        case '3': e.preventDefault(); exec('formatBlock', 'H3'); return;
        case 'o': e.preventDefault(); toggleCallout(); return;
        case 'k': e.preventDefault(); openLinkPrompt(); return;
      }
    }
    if (e.key !== 'Enter') return;

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    // If cursor is inside a link, take over: browsers corrupt/drop <a> on Enter.
    // Find the block-level child of the editor, insert a fresh <p> after it.
    {
      let n: Node | null = sel.anchorNode;
      while (n && n !== editorRef.current) {
        if ((n as HTMLElement).tagName === 'A') {
          e.preventDefault();
          let block: Node = n;
          while (block.parentNode !== editorRef.current) block = block.parentNode!;
          const newP = document.createElement('p');
          newP.innerHTML = '<br>';
          (block as Element).after(newP);
          const r = document.createRange();
          r.setStart(newP, 0);
          r.collapse(true);
          sel.removeAllRanges();
          sel.addRange(r);
          editorRef.current?.focus();
          scheduleAutoSave();
          return;
        }
        n = n.parentNode;
      }
    }

    // Walk up to find enclosing blockquote
    let node: Node | null = sel.anchorNode;
    while (node && node !== editorRef.current) {
      if ((node as HTMLElement).tagName === 'BLOCKQUOTE') {
        const bq = node as HTMLElement;

        // Find the direct child of the blockquote that contains the cursor
        let blockNode: Node | null = sel.anchorNode;
        while (blockNode && blockNode.parentNode !== bq) blockNode = blockNode.parentNode;

        if (blockNode) {
          const el      = blockNode as HTMLElement;
          const isEmpty = !(el.textContent?.trim()) &&
                          (el.innerHTML === '' || el.innerHTML === '<br>');
          if (isEmpty) {
            e.preventDefault();
            el.remove();
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            bq.after(p);
            const r = document.createRange();
            r.setStart(p, 0);
            r.collapse(true);
            sel.removeAllRanges();
            sel.addRange(r);
            scheduleAutoSave();
          }
        }
        return;
      }
      node = node.parentNode;
    }
  };

  // ── Save status label ────────────────────────────────────────
  const statusLabel =
    saveStatus === 'saving'  ? 'Сохранение...' :
    saveStatus === 'unsaved' ? '●' :
    saveStatus === 'error'   ? 'Ошибка сохранения' :
    'Сохранено';

  // Shortcuts for active-state props (suppress highlighting when mixed)
  const af = activeFormats;
  const noMix = !af.mixed;

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
              <rect x="2" y="7" width="9"  height="2" rx="1" />
              <rect x="2" y="12" width="6" height="2" rx="1" />
            </svg>
            Мои статьи
            {drafts.length > 0 && (
              <span className="text-stone-300">({drafts.length})</span>
            )}
          </button>

          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-300 tabular-nums">{charCount.toLocaleString()} симв.</span>
            <span
              className={`text-xs transition-colors ${
                saveStatus === 'unsaved' ? 'text-amber-400' :
                saveStatus === 'error'   ? 'text-red-400' :
                'text-stone-300'
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

        {/* Title — contenteditable so long titles wrap */}
        <div
          ref={titleRef}
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Заголовок"
          onInput={scheduleAutoSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              editorRef.current?.focus();
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            const text = e.clipboardData.getData('text/plain');
            document.execCommand('insertText', false, text);
          }}
          className="w-full text-3xl sm:text-4xl font-bold text-stone-900 outline-none bg-transparent mb-6 leading-tight empty:before:content-[attr(data-placeholder)] empty:before:text-stone-200 empty:before:pointer-events-none"
        />

        {/* Toolbar */}
        <div className="flex items-center gap-0.5 flex-wrap pb-4 mb-2 border-b border-stone-100">
          <ToolBtn active={af.bold && noMix}        onMouseDown={(e) => { prevent(e); exec('bold'); }}         title="Жирный">
            <strong className="font-bold">B</strong>
          </ToolBtn>
          <ToolBtn active={af.italic && noMix}      onMouseDown={(e) => { prevent(e); exec('italic'); }}       title="Курсив">
            <em>I</em>
          </ToolBtn>
          <ToolBtn active={af.underline && noMix}   onMouseDown={(e) => { prevent(e); exec('underline'); }}    title="Подчёркнутый">
            <span className="underline">U</span>
          </ToolBtn>
          <ToolBtn active={af.strikeThrough && noMix} onMouseDown={(e) => { prevent(e); exec('strikeThrough'); }} title="Зачёркнутый">
            <span className="line-through">S</span>
          </ToolBtn>

          <div className="w-px h-5 bg-stone-100 mx-1 flex-shrink-0" />

          <ToolBtn active={af.blockType === 'h2' && noMix} onMouseDown={(e) => { prevent(e); exec('formatBlock', 'H2'); }} title="Заголовок H2">
            <span className="text-xs font-bold">H2</span>
          </ToolBtn>
          <ToolBtn active={af.blockType === 'h3' && noMix} onMouseDown={(e) => { prevent(e); exec('formatBlock', 'H3'); }} title="Заголовок H3">
            <span className="text-xs font-bold">H3</span>
          </ToolBtn>
          <ToolBtn active={false} onMouseDown={(e) => { prevent(e); exec('formatBlock', 'p'); }} title="Обычный текст">
            <span className="text-xs">P</span>
          </ToolBtn>

          <div className="w-px h-5 bg-stone-100 mx-1 flex-shrink-0" />

          <ToolBtn active={false} onMouseDown={(e) => { prevent(e); exec('insertUnorderedList'); }} title="Маркированный список">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <circle cx="2" cy="4" r="1.5" />
              <rect x="5" y="3" width="9" height="2" rx="1" />
              <circle cx="2" cy="8" r="1.5" />
              <rect x="5" y="7" width="9" height="2" rx="1" />
              <circle cx="2" cy="12" r="1.5" />
              <rect x="5" y="11" width="9" height="2" rx="1" />
            </svg>
          </ToolBtn>
          <ToolBtn active={false} onMouseDown={(e) => { prevent(e); exec('insertOrderedList'); }} title="Нумерованный список">
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

          <ToolBtn active={af.blockType === 'blockquote' && noMix} onMouseDown={toggleCallout} title="Выноска «»">
            <span className="text-sm font-bold leading-none">«»</span>
          </ToolBtn>
          <ToolBtn active={af.link} onMouseDown={(e) => { prevent(e); openLinkPrompt(); }} title="Ссылка (Ctrl+K)">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M6.5 9.5a3.182 3.182 0 004.5 0l2-2a3.182 3.182 0 00-4.5-4.5L7 4.5" />
              <path d="M9.5 6.5a3.182 3.182 0 00-4.5 0l-2 2a3.182 3.182 0 004.5 4.5L9.5 11" />
            </svg>
          </ToolBtn>

          <div className="w-px h-5 bg-stone-100 mx-1 flex-shrink-0" />

          <ToolBtn active={false} onMouseDown={(e) => { prevent(e); fileInputRef.current?.click(); }} title="Вставить изображение">
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
          onPaste={handleEditorPaste}
          onKeyDown={handleEditorKeyDown}
          className="
            write-editor
            min-h-[65vh] outline-none
            text-[16px] leading-relaxed text-stone-800
            empty:before:content-[attr(data-placeholder)] empty:before:text-stone-200 empty:before:pointer-events-none
          "
        />
      </main>

      {/* Fixed footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#f8f7f5]/90 backdrop-blur-sm border-t border-stone-100 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <button
            onClick={() => setPublishData({
              title:   titleRef.current?.textContent?.trim() ?? '',
              content: editorRef.current?.innerHTML ?? '',
              draftId,
            })}
            className="w-full py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition-colors"
          >
            Опубликовать
          </button>
        </div>
      </div>

      {publishData && (
        <PublishModal
          title={publishData.title}
          content={publishData.content}
          draftId={publishData.draftId}
          onClose={() => setPublishData(null)}
        />
      )}

      {/* Mobile floating toolbar */}
      {floatPos && (
        <div
          className="fixed z-50 flex flex-col bg-stone-900 rounded-xl shadow-xl overflow-hidden"
          style={{ top: floatPos.top, left: floatPos.left, width: 300 }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {af.mixed && (
            <p className="text-center text-[10px] text-white/40 tracking-wide pt-1.5 pb-0.5 select-none">
              разные эффекты
            </p>
          )}
          <div className="flex items-center gap-0.5 px-1.5 py-1">
            <FloatBtn active={af.bold && noMix}        onMouseDown={(e) => { prevent(e); exec('bold'); }}          title="Жирный">
              <strong className="text-xs font-bold">B</strong>
            </FloatBtn>
            <FloatBtn active={af.italic && noMix}      onMouseDown={(e) => { prevent(e); exec('italic'); }}        title="Курсив">
              <em className="text-xs">I</em>
            </FloatBtn>
            <FloatBtn active={af.underline && noMix}   onMouseDown={(e) => { prevent(e); exec('underline'); }}     title="Подчёркнутый">
              <span className="underline text-xs">U</span>
            </FloatBtn>
            <FloatBtn active={af.strikeThrough && noMix} onMouseDown={(e) => { prevent(e); exec('strikeThrough'); }} title="Зачёркнутый">
              <span className="line-through text-xs">S</span>
            </FloatBtn>

            <div className="w-px h-4 bg-white/20 mx-0.5 flex-shrink-0" />

            <FloatBtn active={af.blockType === 'h2' && noMix} onMouseDown={(e) => { prevent(e); exec('formatBlock', 'H2'); }} title="H2">
              <span className="text-[10px] font-bold">H2</span>
            </FloatBtn>
            <FloatBtn active={af.blockType === 'h3' && noMix} onMouseDown={(e) => { prevent(e); exec('formatBlock', 'H3'); }} title="H3">
              <span className="text-[10px] font-bold">H3</span>
            </FloatBtn>
            <FloatBtn active={false} onMouseDown={(e) => { prevent(e); exec('formatBlock', 'p'); }} title="Абзац">
              <span className="text-[10px]">P</span>
            </FloatBtn>

            <div className="w-px h-4 bg-white/20 mx-0.5 flex-shrink-0" />

            <FloatBtn active={false} onMouseDown={(e) => { prevent(e); exec('insertUnorderedList'); }} title="Список">
              <svg viewBox="0 0 12 12" fill="currentColor" className="w-3 h-3">
                <circle cx="1.5" cy="2.5" r="1.5" />
                <rect x="4" y="1.5" width="7" height="1.5" rx="0.5" />
                <circle cx="1.5" cy="6" r="1.5" />
                <rect x="4" y="5"   width="7" height="1.5" rx="0.5" />
                <circle cx="1.5" cy="9.5" r="1.5" />
                <rect x="4" y="8.5" width="7" height="1.5" rx="0.5" />
              </svg>
            </FloatBtn>
            <FloatBtn active={false} onMouseDown={(e) => { prevent(e); exec('insertOrderedList'); }} title="Нумер. список">
              <svg viewBox="0 0 12 12" fill="currentColor" className="w-3 h-3">
                <text x="0" y="4"   fontSize="4" fontFamily="monospace">1.</text>
                <rect x="4" y="1.5" width="7" height="1.5" rx="0.5" />
                <text x="0" y="7.5" fontSize="4" fontFamily="monospace">2.</text>
                <rect x="4" y="5"   width="7" height="1.5" rx="0.5" />
                <text x="0" y="11"  fontSize="4" fontFamily="monospace">3.</text>
                <rect x="4" y="8.5" width="7" height="1.5" rx="0.5" />
              </svg>
            </FloatBtn>

            <div className="w-px h-4 bg-white/20 mx-0.5 flex-shrink-0" />

            <FloatBtn active={af.blockType === 'blockquote' && noMix} onMouseDown={(e) => toggleCallout(e)} title="Выноска">
              <span className="text-xs font-bold">«»</span>
            </FloatBtn>
            <FloatBtn active={af.link} onMouseDown={(e) => { prevent(e); openLinkPrompt(); }} title="Ссылка">
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                <path d="M4.5 7.5a2.5 2.5 0 003.5 0l1.5-1.5a2.5 2.5 0 00-3.5-3.5L5 3.5" />
                <path d="M7.5 4.5a2.5 2.5 0 00-3.5 0L2.5 6A2.5 2.5 0 006 9.5L6.5 9" />
              </svg>
            </FloatBtn>
          </div>
        </div>
      )}

      {linkPromptOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setLinkPromptOpen(false)} />
          <div className="relative bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-base font-semibold text-stone-900 mb-3">Вставить ссылку</h3>
            <input
              autoFocus
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyLink(linkUrl);
                if (e.key === 'Escape') setLinkPromptOpen(false);
              }}
              placeholder="https://..."
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-stone-400 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => applyLink(linkUrl)}
                className="flex-1 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition-colors"
              >
                Вставить
              </button>
              <button
                onClick={() => setLinkPromptOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

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
