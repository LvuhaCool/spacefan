import { useRef, useState, useCallback } from 'react';

interface AttachedImage {
  id: string;
  url: string;
  name: string;
}

type FormatCommand =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikeThrough'
  | 'insertUnorderedList'
  | 'insertOrderedList'
  | 'formatBlock';

function ToolbarButton({
  onClick,
  title,
  active,
  children,
}: {
  onClick: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors ${
        active
          ? 'bg-stone-900 text-white'
          : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
      }`}
    >
      {children}
    </button>
  );
}

export default function WritePage() {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [title, setTitle] = useState('');

  const exec = useCallback((cmd: FormatCommand, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach((file) => {
      const url = URL.createObjectURL(file);
      setImages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), url, name: file.name },
      ]);
    });
    e.target.value = '';
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img) URL.revokeObjectURL(img.url);
      return prev.filter((i) => i.id !== id);
    });
  };

  const insertImageIntoEditor = (url: string) => {
    const img = `<img src="${url}" alt="" class="max-w-full rounded-xl my-2" />`;
    document.execCommand('insertHTML', false, img);
    editorRef.current?.focus();
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-stone-900 mb-1">Написать статью</h1>
        <p className="text-sm text-stone-400">Черновик · не сохранён</p>
      </div>

      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
        {/* Title */}
        <div className="px-5 pt-5 pb-2 border-b border-stone-100">
          <input
            type="text"
            placeholder="Заголовок статьи"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-xl font-bold text-stone-900 placeholder:text-stone-300 outline-none bg-transparent"
          />
        </div>

        {/* Toolbar */}
        <div className="px-3 py-2 border-b border-stone-100 flex items-center gap-0.5 flex-wrap">
          <ToolbarButton onClick={() => exec('bold')} title="Жирный (Ctrl+B)">
            <strong>B</strong>
          </ToolbarButton>
          <ToolbarButton onClick={() => exec('italic')} title="Курсив (Ctrl+I)">
            <em>I</em>
          </ToolbarButton>
          <ToolbarButton onClick={() => exec('underline')} title="Подчёркнутый (Ctrl+U)">
            <span className="underline">U</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => exec('strikeThrough')} title="Зачёркнутый">
            <span className="line-through">S</span>
          </ToolbarButton>

          <div className="w-px h-5 bg-stone-200 mx-1" />

          <ToolbarButton onClick={() => exec('formatBlock', 'H2')} title="Заголовок H2">
            <span className="text-xs font-bold">H2</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => exec('formatBlock', 'H3')} title="Заголовок H3">
            <span className="text-xs font-bold">H3</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => exec('formatBlock', 'P')} title="Обычный текст">
            <span className="text-xs">P</span>
          </ToolbarButton>

          <div className="w-px h-5 bg-stone-200 mx-1" />

          <ToolbarButton onClick={() => exec('insertUnorderedList')} title="Маркированный список">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <circle cx="2" cy="4" r="1.5" />
              <rect x="5" y="3" width="9" height="2" rx="1" />
              <circle cx="2" cy="8" r="1.5" />
              <rect x="5" y="7" width="9" height="2" rx="1" />
              <circle cx="2" cy="12" r="1.5" />
              <rect x="5" y="11" width="9" height="2" rx="1" />
            </svg>
          </ToolbarButton>
          <ToolbarButton onClick={() => exec('insertOrderedList')} title="Нумерованный список">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <text x="0" y="5" fontSize="5" fontFamily="monospace">1.</text>
              <rect x="5" y="3" width="9" height="2" rx="1" />
              <text x="0" y="9" fontSize="5" fontFamily="monospace">2.</text>
              <rect x="5" y="7" width="9" height="2" rx="1" />
              <text x="0" y="13" fontSize="5" fontFamily="monospace">3.</text>
              <rect x="5" y="11" width="9" height="2" rx="1" />
            </svg>
          </ToolbarButton>

          <div className="w-px h-5 bg-stone-200 mx-1" />

          <ToolbarButton
            onClick={() => fileInputRef.current?.click()}
            title="Прикрепить изображение"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
              <rect x="1" y="3" width="14" height="10" rx="2" />
              <circle cx="5.5" cy="6.5" r="1.5" />
              <path d="M1 10l3.5-3 3 3 2.5-2.5 4 3.5" strokeLinejoin="round" />
            </svg>
          </ToolbarButton>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageChange}
          />
        </div>

        {/* Editor */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Начните писать..."
          onInput={() => {}}
          className="min-h-64 px-5 py-4 text-[15px] text-stone-800 leading-relaxed outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-stone-300 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-stone-900 [&_h2]:mt-4 [&_h2]:mb-1 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-stone-900 [&_h3]:mt-3 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:ml-5 [&_ol]:list-decimal [&_ol]:ml-5"
        />

        {/* Attached images */}
        {images.length > 0 && (
          <div className="px-5 pb-4 border-t border-stone-100 pt-3">
            <p className="text-xs text-stone-400 mb-2 uppercase tracking-wide">
              Прикреплённые изображения
            </p>
            <div className="flex flex-wrap gap-2">
              {images.map((img) => (
                <div key={img.id} className="relative group">
                  <img
                    src={img.url}
                    alt={img.name}
                    className="w-20 h-20 object-cover rounded-xl border border-stone-200"
                  />
                  <button
                    onClick={() => insertImageIntoEditor(img.url)}
                    title="Вставить в текст"
                    className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium"
                  >
                    Вставить
                  </button>
                  <button
                    onClick={() => removeImage(img.id)}
                    title="Удалить"
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-stone-900 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-stone-200 flex items-center justify-center text-stone-300 hover:border-stone-400 hover:text-stone-400 transition-colors text-2xl"
              >
                +
              </button>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-stone-100 flex gap-2 flex-wrap">
          <button className="flex-1 min-w-32 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 transition-colors">
            Опубликовать
          </button>
          <button className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">
            Telegram
          </button>
          <button className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">
            Дзен
          </button>
          <button className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">
            Сохранить черновик
          </button>
        </div>
      </div>
    </main>
  );
}
