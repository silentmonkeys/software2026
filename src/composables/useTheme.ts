import { ref, watch } from 'vue'

type Theme = 'light' | 'dark' | 'contrast'
type FontSize = 'base' | 'lg' | 'xl'
type Glove = 'off' | 'on'

const KEY_THEME = 'app:theme'
const KEY_FONT = 'app:fontsize'
const KEY_GLOVE = 'app:glove'

const theme = ref<Theme>((localStorage.getItem(KEY_THEME) as Theme) || 'light')
const fontSize = ref<FontSize>((localStorage.getItem(KEY_FONT) as FontSize) || 'base')
const glove = ref<Glove>((localStorage.getItem(KEY_GLOVE) as Glove) || 'off')

const apply = () => {
  const html = document.documentElement
  html.dataset.theme = theme.value
  html.dataset.fontsize = fontSize.value
  html.dataset.glove = glove.value
}
apply()

watch(theme, v => { localStorage.setItem(KEY_THEME, v); apply() })
watch(fontSize, v => { localStorage.setItem(KEY_FONT, v); apply() })
watch(glove, v => { localStorage.setItem(KEY_GLOVE, v); apply() })

export function useTheme() {
  const toggleDark = () => { theme.value = theme.value === 'dark' ? 'light' : 'dark' }
  const setTheme = (t: Theme) => { theme.value = t }
  const setFontSize = (s: FontSize) => { fontSize.value = s }
  const toggleGlove = () => { glove.value = glove.value === 'on' ? 'off' : 'on' }

  return { theme, fontSize, glove, toggleDark, setTheme, setFontSize, toggleGlove }
}
