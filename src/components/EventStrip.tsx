import { type SpaceEvent, eventTypeStyle } from './EventModal';

interface Props {
  events: SpaceEvent[];
  onSelect: (event: SpaceEvent) => void;
}

export default function EventStrip({ events, onSelect }: Props) {
  if (events.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-3">
        Ближайшие события
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 snap-x snap-mandatory">
        {events.map((e) => (
          <button
            key={e.id}
            onClick={() => onSelect(e)}
            className="snap-start shrink-0 w-60 bg-white border border-stone-100 rounded-2xl p-4 flex flex-col gap-2 text-left hover:border-stone-300 hover:shadow-sm transition-all"
          >
            <span className={`self-start text-[11px] font-semibold px-2 py-0.5 rounded-full ${eventTypeStyle(e.typeName)}`}>
              {e.typeName || 'Событие'}
            </span>

            <p className="text-sm font-semibold text-stone-900 leading-snug line-clamp-2">
              {e.name}
            </p>

            {e.description && (
              <p className="text-xs text-stone-400 leading-relaxed line-clamp-2">
                {e.description}
              </p>
            )}

            <div className="mt-auto pt-2 border-t border-stone-50">
              {e.location && (
                <p className="text-[11px] text-stone-500 truncate">{e.location}</p>
              )}
              <p className="text-[11px] font-medium text-stone-700 mt-0.5">{e.dateFormatted}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
