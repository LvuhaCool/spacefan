import { useEffect } from 'react';

interface LandingSite {
  name: string;
  type: string;
  reused: boolean;
}

export interface Launch {
  id: string;
  name: string;
  rocket: string;
  provider: string;
  pad: string;
  location: string;
  netFormatted: string;
  statusName: string;
  statusAbbrev: string;
  landingInfo: LandingSite[];
}

function statusStyle(abbrev: string) {
  switch (abbrev) {
    case 'Go':        return 'bg-green-50 text-green-700';
    case 'Hold':      return 'bg-amber-50 text-amber-700';
    case 'In Flight': return 'bg-blue-50 text-blue-700';
    default:          return 'bg-stone-100 text-stone-500';
  }
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-stone-800">{value}</span>
    </div>
  );
}

interface Props {
  launch: Launch | null;
  onClose: () => void;
}

export default function LaunchModal({ launch, onClose }: Props) {
  useEffect(() => {
    if (!launch) return;
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [launch, onClose]);

  if (!launch) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 flex flex-col gap-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-stone-400 mb-1">{launch.provider}</p>
              <h2 className="text-lg font-bold text-stone-900 leading-snug">{launch.name || launch.rocket}</h2>
            </div>
            <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${statusStyle(launch.statusAbbrev)}`}>
              {launch.statusAbbrev}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <Row label="Ракета"         value={launch.rocket} />
            <Row label="Время запуска"  value={launch.netFormatted} />
            <Row label="Стартовый стол" value={launch.pad} />
            <Row label="Стартовый сайт" value={launch.location} />
            {launch.statusName && launch.statusName !== launch.statusAbbrev && (
              <Row label="Статус" value={launch.statusName} />
            )}
          </div>

          {launch.landingInfo.length > 0 && (
            <div>
              <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide">
                Посадка ступеней
              </span>
              <div className="mt-2 flex flex-col gap-2">
                {launch.landingInfo.map((site, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-stone-800">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 font-mono shrink-0">
                      {site.type || '?'}
                    </span>
                    <span>{site.name || 'Площадка TBD'}</span>
                    {site.reused && (
                      <span className="text-xs text-stone-400 ml-auto">б/у ступень</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-6">
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
