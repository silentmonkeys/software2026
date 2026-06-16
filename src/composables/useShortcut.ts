import { onMounted, onBeforeUnmount } from 'vue'

type Handler = (ev: KeyboardEvent) => void
interface Bind { combo: string; handler: Handler }

/** ⌘K / Ctrl+K / Esc 之类的快捷键。combo 例：'mod+k', 'esc', 'mod+/' */
export function useShortcut(binds: Bind[]) {
  const onKey = (ev: KeyboardEvent) => {
    for (const b of binds) {
      if (matchCombo(b.combo, ev)) {
        ev.preventDefault()
        b.handler(ev)
      }
    }
  }
  onMounted(() => window.addEventListener('keydown', onKey))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
}

function matchCombo(combo: string, ev: KeyboardEvent): boolean {
  const parts = combo.toLowerCase().split('+').map(s => s.trim())
  const wantMod = parts.includes('mod')
  const isMod = ev.metaKey || ev.ctrlKey
  if (wantMod !== isMod) return false
  if (parts.includes('shift') !== ev.shiftKey) return false
  if (parts.includes('alt') !== ev.altKey) return false
  const key = parts.filter(p => !['mod', 'shift', 'alt', 'ctrl', 'meta'].includes(p))[0]
  if (!key) return false
  return ev.key.toLowerCase() === key
}
