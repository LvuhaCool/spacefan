import { useEffect } from 'react';

export interface SpaceEvent {
  id: number;
  name: string;
  typeName: string;
  description: string;
  date: string;
  dateFormatted: string;
  location: string;
  imageUrl: string;
}

export function eventTypeStyle(type: string) {
  switch (type) {
    case 'EVA':        return 'bg-purple-50 text-purple-700';
    case 'Docking':    return 'bg-blue-50 text-blue-700';
    case 'Undocking':  return 'bg-amber-50 text-amber-700';
    case 'Landing':    return 'bg-green-50 text-green-700';
    default:           return 'bg-stone-100 text-stone-500';
  }
}

interface Props {
  event: SpaceEvent | null;
  onClose: () => void;
}

export default function EventModal({ event, onClose }: Props) {
  useEffect(() => {
    if (!event) return;
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [event, onClose]);

  if (!event) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden max-h-[90svh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {event.imageUrl && (
          <div className="aspect-[16/7] overflow-hidden bg-stone-100 flex-shrink-0">
            <img src={event.imageUrl} alt={event.name} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="p-6 flex flex-col gap-4 overflow-y-auto">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-bold text-stone-900 leading-snug flex-1">{event.name}</h2>
            <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${eventTypeStyle(event.typeName)}`}>
              {event.typeName || 'Событие'}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {event.dateFormatted && (
              <div>
                <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide mb-0.5">Дата и время</p>
                <p className="text-sm text-stone-800">{event.dateFormatted}</p>
              </div>
            )}
            {event.location && (
              <div>
                <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide mb-0.5">Место</p>
                <p className="text-sm text-stone-800">{event.location}</p>
              </div>
            )}
            {event.description && (
              <div>
                <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide mb-0.5">Описание</p>
                <p className="text-sm text-stone-700 leading-relaxed">{event.description}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
