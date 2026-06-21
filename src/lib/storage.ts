export interface Draft {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
  createdAt: number;
}

const LEGACY_KEY = 'spacefan_drafts';

export async function getDrafts(): Promise<Draft[]> {
  try {
    const res = await fetch('/api/drafts');
    if (!res.ok) return [];
    const serverDrafts: Draft[] = await res.json();

    // One-time migration: if server is empty but localStorage still has drafts, upload them
    if (serverDrafts.length === 0) {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (raw) {
        try {
          const local: Draft[] = JSON.parse(raw);
          if (local.length > 0) {
            await Promise.all(local.map(saveDraft));
            localStorage.removeItem(LEGACY_KEY);
            return local;
          }
        } catch { /* malformed, ignore */ }
      }
    }

    return serverDrafts;
  } catch {
    // Server unreachable — fall back to localStorage so the page isn't broken offline
    try { return JSON.parse(localStorage.getItem(LEGACY_KEY) ?? '[]'); } catch { return []; }
  }
}

export async function saveDraft(draft: Draft): Promise<void> {
  await fetch('/api/drafts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
  });
}

export async function deleteDraft(id: string): Promise<void> {
  await fetch(`/api/drafts/${id}`, { method: 'DELETE' });
}
