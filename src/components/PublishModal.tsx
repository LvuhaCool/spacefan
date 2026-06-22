import { useState, useEffect, useRef } from 'react';

interface Image {
  src: string;
  caption: string;
}

interface Props {
  title: string;
  content: string;
  onClose: () => void;
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

export default function PublishModal({ title, content, onClose }: Props) {
  const [tab,         setTab]         = useState<'telegram' | 'dzen'>('telegram');
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const titleEditRef = useRef<HTMLDivElement>(null);
  const bodyEditRef  = useRef<HTMLDivElement>(null);

  const { bodyHtml, images } = parseContent(content);

  // Set initial editable content on mount
  useEffect(() => {
    if (titleEditRef.current) titleEditRef.current.textContent = title;
    if (bodyEditRef.current)  bodyEditRef.current.innerHTML   = bodyHtml;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lock body scroll and handle Escape
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

  return (
    <>
      {/* Full-screen modal */}
      <div className="fixed inset-0 z-50 bg-white flex flex-col">

        {/* Top bar */}
        <div className="flex items-center border-b border-stone-100 px-4 pt-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors mr-2 mb-1 flex-shrink-0"
            title="Назад"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M12 4L6 10l6 6" />
            </svg>
          </button>

          <div className="flex gap-1 flex-1">
            {(['telegram', 'dzen'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  tab === t
                    ? 'text-stone-900 border-stone-900'
                    : 'text-stone-400 border-transparent hover:text-stone-700'
                }`}
              >
                {t === 'telegram' ? 'Телеграм' : 'Дзен'}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'dzen' ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-stone-400 font-medium text-sm">Пока что не работает!</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
              {/* Editable bold heading */}
              <div
                ref={titleEditRef}
                contentEditable
                suppressContentEditableWarning
                data-placeholder="Заголовок"
                className="
                  font-bold text-stone-900 text-[15px] leading-snug outline-none
                  empty:before:content-[attr(data-placeholder)] empty:before:text-stone-300
                "
              />

              {/* Editable body */}
              <div
                ref={bodyEditRef}
                contentEditable
                suppressContentEditableWarning
                data-placeholder="Текст поста…"
                className="
                  text-[15px] text-stone-800 leading-relaxed outline-none
                  [&_p]:mb-3 [&_p:last-child]:mb-0
                  [&_h2]:font-bold [&_h2]:mb-2 [&_h2]:mt-4
                  [&_h3]:font-bold [&_h3]:mb-1 [&_h3]:mt-3
                  [&_ul]:list-disc [&_ul]:ml-4 [&_ul]:mb-3
                  [&_ol]:list-decimal [&_ol]:ml-4 [&_ol]:mb-3
                  [&_blockquote]:border-l-2 [&_blockquote]:border-stone-200 [&_blockquote]:pl-3 [&_blockquote]:text-stone-600
                  empty:before:content-[attr(data-placeholder)] empty:before:text-stone-300
                "
              />

              {/* Image gallery */}
              {images.length > 0 && (
                <div className="pt-2">
                  <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide mb-2">
                    Медиа · {images.length}
                  </p>
                  <div className={`grid gap-1.5 ${
                    images.length === 1 ? 'grid-cols-1' :
                    images.length === 2 ? 'grid-cols-2' :
                    'grid-cols-3'
                  }`}>
                    {images.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setLightboxIdx(i)}
                        className="aspect-square rounded-xl overflow-hidden bg-stone-100 hover:opacity-90 active:opacity-75 transition-opacity"
                      >
                        <img
                          src={img.src}
                          alt={img.caption || `Фото ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom publish button — always visible */}
        <div className="flex-shrink-0 px-6 pb-6 pt-3 border-t border-stone-100">
          <button className="w-full max-w-3xl mx-auto block py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition-colors">
            Опубликовать
          </button>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85"
          onClick={() => setLightboxIdx(null)}
        >
          <div
            className="relative w-full max-w-2xl flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={images[lightboxIdx].src}
              alt={images[lightboxIdx].caption}
              className="w-full rounded-xl object-contain max-h-[65svh]"
            />
            {images[lightboxIdx].caption && (
              <p className="text-white/60 text-sm text-center">
                {images[lightboxIdx].caption}
              </p>
            )}

            {images.length > 1 && (
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setLightboxIdx((i) => (i ?? 0) - 1)}
                  disabled={lightboxIdx === 0}
                  className="w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 transition-colors disabled:opacity-25"
                >
                  ←
                </button>
                <span className="text-white/50 text-xs tabular-nums">
                  {lightboxIdx + 1} / {images.length}
                </span>
                <button
                  onClick={() => setLightboxIdx((i) => (i ?? 0) + 1)}
                  disabled={lightboxIdx === images.length - 1}
                  className="w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 transition-colors disabled:opacity-25"
                >
                  →
                </button>
              </div>
            )}

            <button
              onClick={() => setLightboxIdx(null)}
              className="absolute top-0 right-0 w-8 h-8 rounded-full bg-white/15 text-white text-lg leading-none flex items-center justify-center hover:bg-white/25 transition-colors"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
}
