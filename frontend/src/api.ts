import type { BoardCrux, BoardCruxFields, BoardLayout, Crux, CruxFields, GymMap, User } from './types'

/** Fired when the session has expired so the app can return to the login page. */
export const UNAUTHORIZED_EVENT = 'cruxcast:unauthorized'

export class ApiError extends Error {
  status: number
  /** Machine-readable code from the backend, e.g. "video_too_large". */
  code: string

  constructor(status: number, code: string) {
    super(code)
    this.status = status
    this.code = code
  }
}

function errorCode(status: number, body: unknown): string {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string') return detail
  if (status === 422) return 'invalid_input'
  return 'unknown'
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, { credentials: 'same-origin', ...init })
  } catch {
    throw new ApiError(0, 'network')
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    if (response.status === 401 && !path.startsWith('/auth/')) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    }
    throw new ApiError(response.status, errorCode(response.status, body))
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

function uploadVideo(
  id: number,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<Crux> {
  // XHR rather than fetch because fetch can't report upload progress.
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', `/api/cruxes/${id}/video`)
    xhr.responseType = 'json'
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response as Crux)
      } else {
        if (xhr.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
        reject(new ApiError(xhr.status, errorCode(xhr.status, xhr.response)))
      }
    }
    xhr.onerror = () => reject(new ApiError(0, 'network'))
    const form = new FormData()
    form.append('file', file)
    xhr.send(form)
  })
}

export const api = {
  me: () => request<User>('/auth/me'),
  login: (username: string, password: string) =>
    request<User>('/auth/login', json('POST', { username, password })),
  register: (username: string, password: string) =>
    request<User>('/auth/register', json('POST', { username, password })),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),

  listCruxes: () => request<Crux[]>('/cruxes'),
  getCrux: (id: number) => request<Crux>(`/cruxes/${id}`),
  createCrux: (fields: CruxFields) => request<Crux>('/cruxes', json('POST', fields)),
  updateCrux: (id: number, changes: Partial<CruxFields & { is_favorite: boolean }>) =>
    request<Crux>(`/cruxes/${id}`, json('PATCH', changes)),
  deleteCrux: (id: number) => request<void>(`/cruxes/${id}`, { method: 'DELETE' }),

  getGymMap: () => request<GymMap>('/gym/map'),

  getBoardLayout: () => request<BoardLayout>('/board/layout'),
  listBoardCruxes: (params: { scope: 'mine' | 'public'; angle?: number | null; q?: string }) => {
    const query = new URLSearchParams({ scope: params.scope })
    if (params.angle != null) query.set('angle', String(params.angle))
    if (params.q?.trim()) query.set('q', params.q.trim())
    return request<BoardCrux[]>(`/board/cruxes?${query}`)
  },
  getBoardCrux: (id: number) => request<BoardCrux>(`/board/cruxes/${id}`),
  createBoardCrux: (fields: BoardCruxFields) => request<BoardCrux>('/board/cruxes', json('POST', fields)),
  updateBoardCrux: (id: number, changes: Partial<BoardCruxFields>) =>
    request<BoardCrux>(`/board/cruxes/${id}`, json('PATCH', changes)),
  deleteBoardCrux: (id: number) => request<void>(`/board/cruxes/${id}`, { method: 'DELETE' }),

  videoUrl: (id: number) => `/api/cruxes/${id}/video`,
  uploadVideo,
  deleteVideo: (id: number) => request<Crux>(`/cruxes/${id}/video`, { method: 'DELETE' }),
}
