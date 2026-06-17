/**
 * Markdown 渲染（FIX3 第 3.1 项）
 * - 关闭 html 解析（防 XSS）
 * - 关闭 linkify（避免误识别）
 * - 链接自动加 target="_blank"，仅允许 https / # / mailto
 */
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({
  html: false,
  linkify: false,
  breaks: true,
  typographer: false
})

// 链接安全：仅放行 https / # / mailto / 站内 hash 路由
const SAFE_PROTO = /^(https?:|mailto:|#|\/)/i
const defaultRender = md.renderer.rules.link_open || function (tokens, idx, options, _env, self) {
  return self.renderToken(tokens, idx, options)
}
md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  const tok = tokens[idx]
  const hrefIndex = tok.attrIndex('href')
  if (hrefIndex >= 0) {
    const href = tok.attrs![hrefIndex][1] || ''
    if (!SAFE_PROTO.test(href)) {
      tok.attrs![hrefIndex][1] = '#'
    }
  }
  const targetIdx = tok.attrIndex('target')
  if (targetIdx < 0) tok.attrPush(['target', '_blank'])
  else tok.attrs![targetIdx][1] = '_blank'
  const relIdx = tok.attrIndex('rel')
  if (relIdx < 0) tok.attrPush(['rel', 'noopener noreferrer'])
  return defaultRender(tokens, idx, options, env, self)
}

export const renderMarkdown = (src: string): string => {
  if (!src) return ''
  try {
    return md.render(src)
  } catch {
    return md.utils.escapeHtml(src)
  }
}
