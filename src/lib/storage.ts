export interface Draft {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
  createdAt: number;
}

const LEGACY_KEY = 'spacefan_drafts';

export async function getDrafts(): Promise<Omit<Draft, 'content'>[]> {
  try {
    const res = await fetch('/api/drafts');
    if (!res.ok) return [];
    return await res.json();
  } catch {
    try {
      const local: Draft[] = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? '[]');
      return local.map(({ content: _c, ...rest }) => rest);
    } catch { return []; }
  }
}

export async function getDraft(id: string): Promise<Draft | null> {
  try {
    const res = await fetch(`/api/drafts/${id}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    // Legacy localStorage fallback
    try {
      const local: Draft[] = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? '[]');
      return local.find(d => d.id === id) ?? null;
    } catch { return null; }
  }
}

export async function saveDraft(draft: Draft): Promise<void> {
  const res = await fetch('/api/drafts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
  });
  if (!res.ok) throw new Error(`Save failed: ${res.status}`);
}

export async function deleteDraft(id: string): Promise<void> {
  await fetch(`/api/drafts/${id}`, { method: 'DELETE' });
}
