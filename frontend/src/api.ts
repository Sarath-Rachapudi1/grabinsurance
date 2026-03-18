/**
 * API base URL — reads from Vite env var (set in docker-compose or .env).
 * Falls back to localhost for local dev without Docker.
 * Vite proxy forwards /api/* to the backend when running `npm run dev`.
 */
export const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? "";

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}
