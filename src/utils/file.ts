/**
 * 文件 / 图片工具函数
 */

/**
 * 将 File 转为 base64 data URL，用于持久化到 localStorage。
 * blob URL (URL.createObjectURL) 刷新页面后失效，不能存入聊天历史。
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * 批量转换，返回 data URL 数组（与输入顺序一致）
 */
export async function filesToBase64(files: File[]): Promise<string[]> {
  return Promise.all(files.map(f => fileToBase64(f)))
}
