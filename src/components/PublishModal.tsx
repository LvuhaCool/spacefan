import { useState, useEffect } from 'react';

interface Image {
  src: string;
  caption: string;
}

interface Props {
  title: string;
  content: string; // editor innerHTML
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

  const { bodyHtml, images } = parseContent(content);

  // Close on Escape
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
      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

        <div
          className="relative bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[92svh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Tab bar */}
          <div className="flex items-center border-b border-stone-100 px-5 pt-4 gap-1 flex-shrink-0">
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
            <button
              onClick={onClose}
              className="w-7 h-7 mb-1 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors text-xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto">
            {tab === 'dzen' ? (
              <div className="flex items-center justify-center h-48">
                <p className="text-stone-400 font-medium text-sm">Пока что не работает!</p>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                {/* Bold heading */}
                {title && (
                  <p className="font-bold text-stone-900 text-[15px] leading-snug">
                    {title}
                  </p>
                )}

                {/* Body text — images already stripped */}
                <div
                  className="
                    text-[15px] text-stone-800 leading-relaxed
                    [&_p]:mb-3 [&_p:last-child]:mb-0
                    [&_h2]:font-bold [&_h2]:mb-2 [&_h2]:mt-4
                    [&_h3]:font-bold [&_h3]:mb-1 [&_h3]:mt-3
                    [&_ul]:list-disc [&_ul]:ml-4 [&_ul]:mb-3
                    [&_ol]:list-decimal [&_ol]:ml-4 [&_ol]:mb-3
                    [&_blockquote]:border-l-2 [&_blockquote]:border-stone-200 [&_blockquote]:pl-3 [&_blockquote]:text-stone-600
                  "
                  dangerouslySetInnerHTML={{ __html: bodyHtml }}
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

                {/* Placeholder for credit + Космоголик line */}
                <div className="pt-4 border-t border-stone-100">
                  <p className="text-[13px] text-stone-300 italic">
                    🎨 Изображения: … · Космоголик | #… — скоро
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Send button (Telegram only) */}
          {tab === 'telegram' && (
            <div className="flex-shrink-0 px-6 pb-6 pt-3 border-t border-stone-100">
              <button className="w-full py-2.5 rounded-xl bg-[#229ED9] text-white text-sm font-medium hover:bg-[#1a8ec8] transition-colors">
                Отправить в Телеграм
              </button>
            </div>
          )}
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

            {/* Prev / counter / Next */}
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
