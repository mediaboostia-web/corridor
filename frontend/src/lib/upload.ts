// Client-side helper for POST /api/upload. Kept separate from `api()`
// (lib/api.ts is protected — no edits) because that wrapper always JSON.
// stringifies its body; multipart/form-data needs a plain fetch. CSRF
// reading duplicates api.ts's small cookie-fallback logic on purpose rather
// than exporting it from the protected file.
import { API_URL, COOKIE_PREFIX } from './constants';
import { ApiError, storeCsrfToken } from './api';

const CSRF_COOKIE_NAME = `${COOKIE_PREFIX}-csrf`;

function getCsrfToken(): string | null {
  if (typeof window === 'undefined') return null;
  const fromStorage = localStorage.getItem(CSRF_COOKIE_NAME);
  if (fromStorage) return fromStorage;
  const escaped = CSRF_COOKIE_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));
  return match && match[1] ? decodeURIComponent(match[1]) : null;
}

// Duplicates api.ts's private refreshAccessToken (same reasoning as the
// CSRF helper above — that function isn't exported from the protected
// file). A 15-minute access token routinely expires mid-form while the
// user fills in title/description/budget before picking an image, so the
// upload call needs the same 401 -> refresh -> retry-once behavior every
// other request gets via api().
async function refreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { csrfToken?: string };
    if (data.csrfToken) storeCsrfToken(data.csrfToken);
    return true;
  } catch {
    return false;
  }
}

export interface UploadedFile {
  id: string;
  key: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  url: string;
}

export async function uploadImage(file: File, _isRetryAfterRefresh = false): Promise<UploadedFile> {
  const csrfToken = getCsrfToken();
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    body: form,
    credentials: 'include',
    headers: csrfToken ? { 'x-csrf-token': csrfToken } : {},
  });

  if (!res.ok) {
    if (res.status === 401 && !_isRetryAfterRefresh) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return uploadImage(file, true);
    }

    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const message =
      typeof body.error === 'string'
        ? body.error
        : typeof body.message === 'string'
          ? body.message
          : `Error ${res.status}`;
    throw new ApiError(res.status, message, body);
  }

  return res.json() as Promise<UploadedFile>;
}
