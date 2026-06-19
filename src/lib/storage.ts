export interface Draft {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
  createdAt: number;
}

const KEY = 'spacefan_drafts';

export function getDrafts(): Draft[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function saveDraft(draft: Draft): void {
  const rest = getDrafts().filter((d) => d.id !== draft.id);
  localStorage.setItem(KEY, JSON.stringify([draft, ...rest]));
}

export function deleteDraft(id: string): void {
  localStorage.setItem(KEY, JSON.stringify(getDrafts().filter((d) => d.id !== id)));
}

export function getDraft(id: string): Draft | undefined {
  return getDrafts().find((d) => d.id === id);
}
