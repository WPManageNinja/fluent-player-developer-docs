import DefaultTheme from 'vitepress/theme'
import GlossaryTooltip from 'vitepress-plugin-glossary/vue'
import './custom.css'

export default {
  ...DefaultTheme,
  enhanceApp({ app }) {
    app.component('GlossaryTooltip', GlossaryTooltip)
  },
}
