export interface ApiResult<T> {
  ok: boolean
  status: number
  data?: T
  error?: string
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(path, {
    ...init,
    credentials: 'include',
    headers,
  })

  const body = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: typeof body.error === 'string' ? body.error : 'The request failed.',
    }
  }

  return { ok: true, status: response.status, data: body }
}
