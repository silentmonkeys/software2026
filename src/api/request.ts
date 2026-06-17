import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import { showFailToast } from 'vant'
import { storage } from '@/utils/storage'

export interface ApiResponse<T = unknown> {
  code: number
  msg: string
  data: T
}

const TOKEN_KEY = 'app:token'

export const request: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  timeout: 15000
})

request.interceptors.request.use(cfg => {
  const t = storage.get<string>(TOKEN_KEY)
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})

request.interceptors.response.use(
  res => res,
  err => {
    const status = err?.response?.status
    const url = String(err?.config?.url || '')
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register')
    if (status === 401 && !isAuthEndpoint) {
      storage.remove(TOKEN_KEY)
      // 注意：路由是 hash 模式，必须改 hash 而不是 pathname
      const onLogin = location.hash.startsWith('#/login')
      if (!onLogin) location.hash = '#/login'
    }
    // 仅在网络错误时静默；业务错误由调用方处理
    if (!err?.response) {
      console.warn('[api] network or backend unavailable, returning silently')
    }
    return Promise.reject(err)
  }
)

/** 包装：始终返回 data；失败回退到 fallback（用于演示态） */
export async function safeCall<T>(
  fn: () => Promise<{ data: ApiResponse<T> }>,
  fallback: T
): Promise<T> {
  try {
    const { data } = await fn()
    if (data?.code === 0 && data?.data !== undefined) return data.data
    return fallback
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[api] fallback used:', e)
    return fallback
  }
}

/**
 * 真实后端调用：FastAPI 直接返回 JSON 体本身（不裹 {code,msg,data}）。
 * 第二参数 fallback 用于网络/后端不可用时的演示降级。
 * 失败时若没有 fallback 会向上抛错，调用方自行 try/catch。
 */
export async function rawCall<T>(
  fn: () => Promise<{ data: T }>,
  fallback?: T
): Promise<T> {
  try {
    const { data } = await fn()
    return data as T
  } catch (e) {
    if (fallback !== undefined) {
      if (import.meta.env.DEV) console.warn('[api] raw fallback used:', e)
      return fallback
    }
    throw e
  }
}

export function get<T = unknown>(url: string, params?: object, cfg?: AxiosRequestConfig) {
  return request.get<ApiResponse<T>>(url, { params, ...cfg })
}
export function post<T = unknown>(url: string, body?: unknown, cfg?: AxiosRequestConfig) {
  return request.post<ApiResponse<T>>(url, body, cfg)
}
export function put<T = unknown>(url: string, body?: unknown) {
  return request.put<ApiResponse<T>>(url, body)
}
export function del<T = unknown>(url: string) {
  return request.delete<ApiResponse<T>>(url)
}

export const TOKEN_STORAGE_KEY = TOKEN_KEY

void showFailToast // 防 tree shake
