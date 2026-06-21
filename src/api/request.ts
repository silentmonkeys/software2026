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

/**
 * 包装：返回 {code,msg,data} 信封中的 data；失败抛出错误（FIX5 第 16 项：不再 mock 兜底）。
 * 注意：本项目后端多数接口直接返回 JSON 体，请优先使用 rawCall。
 */
export async function safeCall<T>(
  fn: () => Promise<{ data: ApiResponse<T> }>
): Promise<T> {
  const { data } = await fn()
  if (data?.code === 0) return data.data
  throw new Error(data?.msg || '请求失败')
}

/**
 * 真实后端调用：FastAPI 直接返回 JSON 体本身（不裹 {code,msg,data}）。
 * 失败时抛错，由调用方 try/catch 并展示错误状态（FIX5 第 16 项：不再 mock 兜底）。
 */
export async function rawCall<T>(
  fn: () => Promise<{ data: T }>
): Promise<T> {
  const { data } = await fn()
  return data as T
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
