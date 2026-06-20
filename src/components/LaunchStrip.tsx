interface Launch {
  id: string;
  name: string;
  rocket: string;
  provider: string;
  pad: string;
  location: string;
  netFormatted: string;
  statusAbbrev: string;
  statusName: string;
}

function statusStyle(abbrev: string) {
  switch (abbrev) {
    case 'Go':        return 'bg-green-50 text-green-700';
    case 'Hold':      return 'bg-amber-50 text-amber-700';
    case 'In Flight': return 'bg-blue-50 text-blue-700';
    default:          return 'bg-stone-100 text-stone-500';
  }
}

export default function LaunchStrip({ launches }: { launches: Launch[] }) {
  if (launches.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-3">
        Ближайшие запуски
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 snap-x snap-mandatory">
        {launches.map((l) => (
          <div
            key={l.id}
            className="snap-start shrink-0 w-60 bg-white border border-stone-100 rounded-2xl p-4 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${statusStyle(l.statusAbbrev)}`}>
                {l.statusAbbrev}
              </span>
              <span className="text-[11px] text-stone-400 truncate">{l.provider}</span>
            </div>

            <p className="text-sm font-semibold text-stone-900 leading-snug line-clamp-2">
              {l.name || l.rocket}
            </p>

            {l.rocket && (
              <p className="text-xs text-stone-400 truncate">{l.rocket}</p>
            )}

            <div className="mt-auto pt-1 border-t border-stone-50">
              <p className="text-[11px] text-stone-500 leading-relaxed">
                {l.location}
              </p>
              <p className="text-[11px] font-medium text-stone-700 mt-0.5">
                {l.netFormatted}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
