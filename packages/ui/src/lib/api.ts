export async function api<T = unknown>(method: string, url: string, body?: unknown): Promise<T> {
  const r = await fetch('/api/' + url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText)
  return (r.status === 204 ? null : await r.json()) as T
}

export function localGet(k: string) {
  try { return localStorage.getItem(k) } catch { return null }
}

export function localSet(k: string, v: string) {
  try { localStorage.setItem(k, v) } catch { /* private mode */ }
}
