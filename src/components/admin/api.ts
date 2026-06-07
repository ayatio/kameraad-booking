// Thin client-side fetch helpers for the admin JSON API. The session cookie is
// sent automatically (same-origin). Every helper returns a discriminated result
// so callers can branch on status without try/catch noise.

export interface ApiResult<T> {
  ok: boolean
  status: number
  data: T | null
}

async function request<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })
    let data: T | null = null
    try {
      data = (await res.json()) as T
    } catch {
      data = null
    }
    return { ok: res.ok, status: res.status, data }
  } catch {
    return { ok: false, status: 0, data: null }
  }
}

export function apiGet<T>(url: string): Promise<ApiResult<T>> {
  return request<T>(url)
}

export function apiPost<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  return request<T>(url, { method: 'POST', body: JSON.stringify(body) })
}

export function apiPut<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  return request<T>(url, { method: 'PUT', body: JSON.stringify(body) })
}

export function apiPatch<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  return request<T>(url, { method: 'PATCH', body: JSON.stringify(body) })
}

export function apiDelete<T>(url: string): Promise<ApiResult<T>> {
  return request<T>(url, { method: 'DELETE' })
}
