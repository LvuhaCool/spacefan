export interface DraftStatus {
  telegram: boolean;
  dzen: boolean;
  test: boolean;
}

const KEY = 'spacefan_draft_status';

export function loadAllStatuses(): Record<string, DraftStatus> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); }
  catch { return {}; }
}

export function saveAllStatuses(statuses: Record<string, DraftStatus>): void {
  localStorage.setItem(KEY, JSON.stringify(statuses));
}

export function getDraftStatus(id: string): DraftStatus {
  return loadAllStatuses()[id] ?? { telegram: false, dzen: false, test: false };
}

export function setDraftStatusItem(id: string, status: DraftStatus): void {
  const all = loadAllStatuses();
  all[id] = status;
  localStorage.setItem(KEY, JSON.stringify(all));
}
