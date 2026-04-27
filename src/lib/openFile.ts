/**
 * Opens a file URL in a new tab, bypassing ad-blockers that block
 * direct *.supabase.co/storage URLs (ERR_BLOCKED_BY_CLIENT).
 *
 * Strategy:
 *  1. Try fetch -> blob -> blob URL (works even if direct nav is blocked).
 *  2. Fallback to window.open of the original URL.
 */
export async function openFileSafe(url: string): Promise<void> {
  if (!url) return;

  // External links (Drive, Maps, http(s) outside our storage) — open directly
  const isSupabaseStorage = /supabase\.co\/storage\//i.test(url);
  if (!isSupabaseStorage) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const win = window.open(blobUrl, "_blank", "noopener,noreferrer");
    // Revoke after a short delay so the new tab has time to load it
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    if (!win) {
      // Popup blocked — fall back to direct nav
      window.location.href = blobUrl;
    }
  } catch (err) {
    console.warn("openFileSafe fallback to direct open:", err);
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
