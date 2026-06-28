import { useState, useEffect, useRef, useCallback } from 'react';
import { getDraftStatus, setDraftStatusItem } from '../lib/draftStatus';

interface Image {
  src: string;
  caption: string;
}

interface Props {
  title: string;
  content: string;
  onClose: () => void;
  draftId?: string;
}

function parseContent(html: string): { bodyHtml: string; images: Image[] } {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const images: Image[] = [];
  doc.querySelectorAll('[data-image-block]').forEach((fig) => {
    const src     = (fig.querySelector('img') as HTMLImageElement | null)?.src ?? '';
    const caption = (fig.querySelector('figcaption') as HTMLElement | null)?.textContent?.trim() ?? '';
    if (src) images.push({ src, caption });
    fig.remove();
  });
  return { bodyHtml: doc.body.innerHTML, images };
}

function transformForTelegram(title: string, bodyHtml: string): string {
  const doc  = new DOMParser().parseFromString(bodyHtml, 'text/html');
  const body = doc.body;

  body.querySelectorAll('ol').forEach((ol) => {
    const frag = doc.createDocumentFragment();
    ol.querySelectorAll('li').forEach((li, i) => {
      const p = doc.createElement('p');
      p.innerHTML = `${i + 1}. ${li.innerHTML}`;
      frag.appendChild(p);
    });
    ol.replaceWith(frag);
  });

  body.querySelectorAll('ul').forEach((ul) => {
    const frag = doc.createDocumentFragment();
    ul.querySelectorAll('li').forEach((li) => {
      const p = doc.createElement('p');
      p.innerHTML = `• ${li.innerHTML}`;
      frag.appendChild(p);
    });
    ul.replaceWith(frag);
  });

  body.querySelectorAll('h2, h3').forEach((h) => {
    const p      = doc.createElement('p');
    const strong = doc.createElement('strong');
    strong.innerHTML = h.innerHTML;
    p.appendChild(strong);
    h.replaceWith(p);
  });

  body.querySelectorAll('blockquote').forEach((bq) => {
    const p  = doc.createElement('p');
    const em = doc.createElement('em');
    em.innerHTML = bq.innerHTML;
    p.appendChild(em);
    bq.replaceWith(p);
  });

  while (body.lastChild) {
    const node = body.lastChild;
    const text = node.textContent?.trim() ?? '';
    const inner = node.nodeType === Node.ELEMENT_NODE
      ? (node as Element).innerHTML.replace(/<br\s*\/?>/gi, '').trim()
      : '';
    if (text === '' || inner === '') {
      body.removeChild(node);
    } else {
      break;
    }
  }

  if (title) {
    const spacer = doc.createElement('p');
    spacer.innerHTML = '<br>';
    body.insertBefore(spacer, body.firstChild);

    const titleP      = doc.createElement('p');
    const titleStrong = doc.createElement('strong');
    titleStrong.textContent = title;
    titleP.appendChild(titleStrong);
    body.insertBefore(titleP, body.firstChild);
  }

  // Footer: blank line + channel credit
  const footerSpacer = doc.createElement('p');
  footerSpacer.innerHTML = '<br>';
  body.appendChild(footerSpacer);

  const footerP = doc.createElement('p');
  const footerLink = doc.createElement('a');
  footerLink.href = 'http://t.me/spafic';
  footerLink.textContent = 'Космоголик';
  footerP.appendChild(footerLink);
  footerP.appendChild(doc.createTextNode(' | #'));
  body.appendChild(footerP);

  return body.innerHTML;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function toTelegramHtml(el: HTMLElement): string {
  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent ?? '');
    const e = node as Element;
    const inner = Array.from(e.childNodes).map(walk).join('');
    switch (e.tagName?.toLowerCase()) {
      case 'b': case 'strong': return `<b>${inner}</b>`;
      case 'i': case 'em':     return `<i>${inner}</i>`;
      case 'u':                return `<u>${inner}</u>`;
      case 's': case 'del': case 'strike': return `<s>${inner}</s>`;
      case 'h2': case 'h3': return `<b>${inner}</b>\n`;
      case 'a': {
        const href = (e as HTMLAnchorElement).href;
        return href ? `<a href="${href}">${inner}</a>` : inner;
      }
      case 'br': return '\n';
      case 'p': {
        const trimmed = inner.replace(/\n/g, '').trim();
        return trimmed ? trimmed + '\n' : '\n';
      }
      default: return inner;
    }
  }
  return Array.from(el.childNodes).map(walk).join('').trim();
}

function FormatBar({ editorRef }: { editorRef: React.RefObject<HTMLDivElement | null> }) {
  const [af, setAf] = useState({ bold: false, italic: false, underline: false, strikeThrough: false, blockType: '', link: false });
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl,  setLinkUrl]  = useState('');
  const savedRange = useRef<Range | null>(null);

  useEffect(() => {
    const update = () => {
      const sel    = window.getSelection();
      const editor = editorRef.current;
      if (!sel || !editor || !editor.contains(sel.anchorNode)) return;

      let link = false;
      let n: Node | null = sel.anchorNode;
      while (n && n !== editor) {
        if ((n as HTMLElement).tagName === 'A') { link = true; break; }
        n = n.parentNode;
      }
      if (link) { setAf(p => ({ ...p, link: true })); return; }

      const blockType    = document.queryCommandValue('formatBlock').toLowerCase();
      const isHeading    = blockType === 'h2' || blockType === 'h3';
      const bold         = isHeading ? false : document.queryCommandState('bold');
      const italic       = document.queryCommandState('italic');
      const underline    = document.queryCommandState('underline');
      const strikeThrough = document.queryCommandState('strikeThrough');
      setAf({ bold, italic, underline, strikeThrough, blockType, link: false });
    };
    document.addEventListener('selectionchange', update);
    return () => document.removeEventListener('selectionchange', update);
  }, [editorRef]);

  const exec = (cmd: string, val?: string) => { document.execCommand(cmd, false, val); editorRef.current?.focus(); };
  const prevent = (e: React.MouseEvent) => e.preventDefault();

  const openLink = (e: React.MouseEvent) => {
    prevent(e);
    if (af.link) { exec('unlink'); return; }
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) savedRange.current = sel.getRangeAt(0).cloneRange();
    setLinkUrl('');
    setLinkOpen(true);
  };

  const applyLink = (url: string) => {
    setLinkOpen(false);
    if (!url.trim()) return;
    const r = savedRange.current;
    if (r) { const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(r); }
    exec('createLink', /^https?:\/\//i.test(url) ? url : `https://${url}`);
    savedRange.current = null;
  };

  const toggleCallout = (e: React.MouseEvent) => {
    prevent(e);
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      let n: Node | null = sel.anchorNode;
      while (n && n !== editorRef.current) {
        if ((n as HTMLElement).tagName === 'BLOCKQUOTE') { exec('formatBlock', 'P'); return; }
        n = n.parentNode;
      }
    }
    exec('formatBlock', 'BLOCKQUOTE');
  };

  const Btn = ({ active, onMouseDown, title, children }: {
    active?: boolean; onMouseDown: (e: React.MouseEvent) => void; title: string; children: React.ReactNode;
  }) => (
    <button onMouseDown={onMouseDown} title={title}
      className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors select-none ${
        active ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-200/60 hover:text-stone-900'
      }`}>{children}</button>
  );
  const Sep = () => <div className="w-px h-5 bg-stone-100 mx-1 flex-shrink-0" />;

  return (
    <>
      <div className="flex items-center gap-0.5 flex-wrap py-2 mb-4 border-b border-stone-100 sticky top-0 bg-white z-10">
        <Btn active={af.bold}        onMouseDown={e => { prevent(e); exec('bold'); }}        title="Жирный"><strong className="font-bold">B</strong></Btn>
        <Btn active={af.italic}      onMouseDown={e => { prevent(e); exec('italic'); }}      title="Курсив"><em>I</em></Btn>
        <Btn active={af.underline}   onMouseDown={e => { prevent(e); exec('underline'); }}   title="Подчёркнутый"><span className="underline">U</span></Btn>
        <Btn active={af.strikeThrough} onMouseDown={e => { prevent(e); exec('strikeThrough'); }} title="Зачёркнутый"><span className="line-through">S</span></Btn>
        <Sep />
        <Btn active={af.blockType === 'h2'} onMouseDown={e => { prevent(e); exec('formatBlock', 'H2'); }} title="Заголовок H2"><span className="text-xs font-bold">H2</span></Btn>
        <Btn active={af.blockType === 'h3'} onMouseDown={e => { prevent(e); exec('formatBlock', 'H3'); }} title="Заголовок H3"><span className="text-xs font-bold">H3</span></Btn>
        <Btn active={false} onMouseDown={e => { prevent(e); exec('formatBlock', 'p'); }} title="Обычный текст"><span className="text-xs">P</span></Btn>
        <Sep />
        <Btn active={false} onMouseDown={e => { prevent(e); exec('insertUnorderedList'); }} title="Маркированный список">
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
            <circle cx="2" cy="4" r="1.5" /><rect x="5" y="3" width="9" height="2" rx="1" />
            <circle cx="2" cy="8" r="1.5" /><rect x="5" y="7" width="9" height="2" rx="1" />
            <circle cx="2" cy="12" r="1.5" /><rect x="5" y="11" width="9" height="2" rx="1" />
          </svg>
        </Btn>
        <Btn active={false} onMouseDown={e => { prevent(e); exec('insertOrderedList'); }} title="Нумерованный список">
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
            <text x="0" y="5" fontSize="5" fontFamily="monospace">1.</text><rect x="5" y="3" width="9" height="2" rx="1" />
            <text x="0" y="9" fontSize="5" fontFamily="monospace">2.</text><rect x="5" y="7" width="9" height="2" rx="1" />
            <text x="0" y="13" fontSize="5" fontFamily="monospace">3.</text><rect x="5" y="11" width="9" height="2" rx="1" />
          </svg>
        </Btn>
        <Sep />
        <Btn active={af.blockType === 'blockquote'} onMouseDown={toggleCallout} title="Выноска «»"><span className="text-sm font-bold leading-none">«»</span></Btn>
        <Btn active={af.link} onMouseDown={openLink} title="Ссылка">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M6.5 9.5a3.182 3.182 0 004.5 0l2-2a3.182 3.182 0 00-4.5-4.5L7 4.5" />
            <path d="M9.5 6.5a3.182 3.182 0 00-4.5 0l-2 2a3.182 3.182 0 004.5 4.5L9.5 11" />
          </svg>
        </Btn>
      </div>

      {linkOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setLinkOpen(false)} />
          <div className="relative bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-base font-semibold text-stone-900 mb-3">Вставить ссылку</h3>
            <input
              autoFocus type="url" placeholder="https://…"
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') applyLink(linkUrl); if (e.key === 'Escape') setLinkOpen(false); }}
              className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-stone-900 mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setLinkOpen(false)} className="flex-1 py-2 rounded-xl border border-stone-200 text-sm text-stone-600 hover:bg-stone-50 transition-colors">Отмена</button>
              <button onClick={() => applyLink(linkUrl)} className="flex-1 py-2 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition-colors">Вставить</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CheckCircle() {
  return (
    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
      <svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
  );
}

function ImageGallery({ images, onLightbox }: { images: Image[]; onLightbox: (i: number) => void }) {
  if (images.length === 0) return null;
  return (
    <div className="pt-4">
      <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide mb-2">
        Медиа · {images.length}
      </p>
      <div className={`grid gap-1.5 ${
        images.length === 1 ? 'grid-cols-1' :
        images.length === 2 ? 'grid-cols-2' :
        'grid-cols-3'
      }`}>
        {images.map((img, i) => (
          <button key={i} onClick={() => onLightbox(i)}
            className="aspect-square rounded-xl overflow-hidden bg-stone-100 hover:opacity-90 active:opacity-75 transition-opacity">
            <img src={img.src} alt={img.caption || `Фото ${i + 1}`} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PublishModal({ title, content, onClose, draftId }: Props) {
  const [tab, setTab] = useState<'telegram' | 'dzen'>('telegram');
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const [tgSending,  setTgSending]  = useState(false);
  const [tgPosted,   setTgPosted]   = useState(false);
  const [tgError,    setTgError]    = useState('');
  const [charCount,  setCharCount]  = useState(0);

  const [dzenCharCount, setDzenCharCount] = useState(0);
  const [dzenCopied,    setDzenCopied]    = useState(false);

  const bodyEditRef  = useRef<HTMLDivElement>(null);
  const dzenTitleRef = useRef<HTMLDivElement>(null);
  const dzenBodyRef  = useRef<HTMLDivElement>(null);

  const { bodyHtml, images } = parseContent(content);

  useEffect(() => {
    if (bodyEditRef.current) {
      bodyEditRef.current.innerHTML = transformForTelegram(title, bodyHtml);
      setCharCount(bodyEditRef.current.textContent?.length ?? 0);
    }
    if (dzenTitleRef.current) {
      dzenTitleRef.current.textContent = title;
    }
    if (dzenBodyRef.current) {
      dzenBodyRef.current.innerHTML = content;
      setDzenCharCount((title?.length ?? 0) + (dzenBodyRef.current.textContent?.length ?? 0));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Telegram published → auto-close after 2 s
  useEffect(() => {
    if (!tgPosted) return;
    const t = setTimeout(onClose, 2000);
    return () => clearTimeout(t);
  }, [tgPosted, onClose]);

  const updateDzenCharCount = useCallback(() => {
    setDzenCharCount(
      (dzenTitleRef.current?.textContent?.length ?? 0) +
      (dzenBodyRef.current?.textContent?.length ?? 0)
    );
  }, []);

  const handlePublish = useCallback(async () => {
    if (tgPosted || tgSending || !bodyEditRef.current) return;
    const text = toTelegramHtml(bodyEditRef.current);
    setTgSending(true);
    setTgError('');
    try {
      const res = await fetch('/api/publish/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, images }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Ошибка сервера');
      setTgPosted(true);
      if (draftId) {
        const st = getDraftStatus(draftId);
        setDraftStatusItem(draftId, { ...st, telegram: true, test: false });
      }
    } catch (err) {
      setTgError(err instanceof Error ? err.message : 'Неизвестная ошибка');
    } finally {
      setTgSending(false);
    }
  }, [tgPosted, tgSending, images, draftId]);

  const handleCopyForDzen = useCallback(async () => {
    const titleText = dzenTitleRef.current?.textContent?.trim() ?? '';
    // Strip base64 images — too large for clipboard and won't render in Дзен's mobile editor
    const cleanBody = (dzenBodyRef.current?.innerHTML ?? '').replace(/src="data:[^"]+"/g, 'src=""');
    const html  = `<h1>${titleText}</h1>${cleanBody}`;
    const plain = `${titleText}\n\n${dzenBodyRef.current?.textContent ?? ''}`;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html':  new Blob([html],  { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        }),
      ]);
    } catch {
      await navigator.clipboard.writeText(plain);
    }
    setDzenCopied(true);
    setTimeout(() => setDzenCopied(false), 2000);
  }, []);


  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxIdx !== null) setLightboxIdx(null);
        else onClose();
      }
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [lightboxIdx, onClose]);

  const showLimit = tab === 'telegram' && images.length > 0;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-white flex flex-col">

        {tgPosted ? (
          /* ── Telegram published: show success then close ── */
          <div className="flex-1 flex flex-col items-center justify-center gap-5">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-stone-900">Опубликовано!</p>
            <p className="text-sm text-stone-400">Возвращаемся к редактору…</p>
          </div>
        ) : (
          <>
            {/* Top bar */}
            <div className="flex items-center border-b border-stone-100 px-4 pt-3 flex-shrink-0">
              <button onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors mr-2 mb-1 flex-shrink-0"
                title="Назад">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <path d="M12 4L6 10l6 6" />
                </svg>
              </button>

              <div className="flex gap-1 flex-1">
                {(['telegram', 'dzen'] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${
                      tab === t
                        ? 'text-stone-900 border-stone-900'
                        : 'text-stone-400 border-transparent hover:text-stone-700'
                    }`}>
                    {t === 'telegram' ? 'Телеграм' : 'Дзен'}
                    {t === 'telegram' && tgPosted && (
                      <span className="text-green-500 text-xs">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">

              {/* Telegram tab */}
              <div className={tab === 'telegram' ? '' : 'hidden'}>
                {tgPosted ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-3">
                    <CheckCircle />
                    <p className="text-base font-semibold text-stone-700">Опубликовано в Телеграм</p>
                  </div>
                ) : (
                  <div className="max-w-3xl mx-auto px-6 py-6">
                    <FormatBar editorRef={bodyEditRef} />
                    <div
                      ref={bodyEditRef}
                      contentEditable
                      suppressContentEditableWarning
                      data-placeholder="Текст поста…"
                      onInput={() => setCharCount(bodyEditRef.current?.textContent?.length ?? 0)}
                      className="
                        text-[15px] text-stone-800 leading-relaxed outline-none
                        [&_p]:mb-3 [&_p:last-child]:mb-0
                        [&_strong]:font-bold [&_em]:italic [&_u]:underline [&_s]:line-through
                        [&_a]:text-blue-600 [&_a]:underline
                        empty:before:content-[attr(data-placeholder)] empty:before:text-stone-300
                      "
                    />
                    <ImageGallery images={images} onLightbox={setLightboxIdx} />
                  </div>
                )}
              </div>

              {/* Dzen tab */}
              <div className={tab === 'dzen' ? '' : 'hidden'}>
                  <div className="max-w-3xl mx-auto px-6 py-6">
                    <div
                      ref={dzenTitleRef}
                      contentEditable
                      suppressContentEditableWarning
                      data-placeholder="Заголовок"
                      onInput={updateDzenCharCount}
                      className="w-full text-3xl sm:text-4xl font-bold text-stone-900 outline-none bg-transparent mb-6 leading-tight empty:before:content-[attr(data-placeholder)] empty:before:text-stone-200 empty:before:pointer-events-none"
                    />
                    <FormatBar editorRef={dzenBodyRef} />
                    <div
                      ref={dzenBodyRef}
                      contentEditable
                      suppressContentEditableWarning
                      data-placeholder="Текст статьи…"
                      onInput={updateDzenCharCount}
                      className="write-editor outline-none text-[15px] text-stone-800 leading-relaxed min-h-[4rem] empty:before:content-[attr(data-placeholder)] empty:before:text-stone-300 empty:before:pointer-events-none"
                    />
                  </div>
              </div>

            </div>

            {/* Bottom publish button */}
            <div className="flex-shrink-0 px-6 pb-6 pt-3 border-t border-stone-100 max-w-3xl mx-auto w-full">
              <div className="flex justify-end mb-1.5">
                {tab === 'telegram' && !tgPosted && (
                  <span className={`text-xs tabular-nums ${
                    showLimit && charCount > 1024 ? 'text-red-400 font-medium' : 'text-stone-300'
                  }`}>
                    {charCount.toLocaleString()}{showLimit ? ' / 1024' : ' симв.'}
                  </span>
                )}
                {tab === 'dzen' && (
                  <span className="text-xs tabular-nums text-stone-300">
                    {dzenCharCount.toLocaleString()} симв.
                  </span>
                )}
              </div>
              {tgError && tab === 'telegram' && (
                <p className="text-xs text-red-500 text-center mb-2">{tgError}</p>
              )}
              <div className="flex gap-2">
                {tab === 'dzen' && (
                  <button
                    onClick={handleCopyForDzen}
                    className={`flex-none py-2.5 px-4 rounded-xl text-sm font-medium border transition-colors ${
                      dzenCopied
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    {dzenCopied ? '✓ Скопировано' : 'Скопировать'}
                  </button>
                )}
                {tab === 'dzen' ? (
                  <a
                    href="https://dzen.ru/profile/editor/spacefan"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium text-center bg-stone-900 text-white hover:bg-stone-800 transition-colors"
                  >
                    Опубликовать
                  </a>
                ) : (
                  <button
                    onClick={handlePublish}
                    disabled={tgPosted || tgSending}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${
                      tgPosted ? 'bg-green-600 text-white' :
                      tgError  ? 'bg-red-600 text-white hover:bg-red-700' :
                                 'bg-stone-900 text-white hover:bg-stone-800'
                    }`}
                  >
                    {tgPosted  ? 'Опубликовано ✓' :
                     tgSending ? 'Отправляем…' :
                     tgError   ? 'Попробовать снова' :
                                 'Опубликовать'}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85"
          onClick={() => setLightboxIdx(null)}>
          <div className="relative w-full max-w-2xl flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}>
            <img src={images[lightboxIdx].src} alt={images[lightboxIdx].caption}
              className="w-full rounded-xl object-contain max-h-[65svh]" />
            {images[lightboxIdx].caption && (
              <p className="text-white/60 text-sm text-center">{images[lightboxIdx].caption}</p>
            )}
            {images.length > 1 && (
              <div className="flex items-center gap-4">
                <button onClick={() => setLightboxIdx((i) => (i ?? 0) - 1)}
                  disabled={lightboxIdx === 0}
                  className="w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 transition-colors disabled:opacity-25">←</button>
                <span className="text-white/50 text-xs tabular-nums">{lightboxIdx + 1} / {images.length}</span>
                <button onClick={() => setLightboxIdx((i) => (i ?? 0) + 1)}
                  disabled={lightboxIdx === images.length - 1}
                  className="w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 transition-colors disabled:opacity-25">→</button>
              </div>
            )}
            <button onClick={() => setLightboxIdx(null)}
              className="absolute top-0 right-0 w-8 h-8 rounded-full bg-white/15 text-white text-lg leading-none flex items-center justify-center hover:bg-white/25 transition-colors">×</button>
          </div>
        </div>
      )}
    </>
  );
}
