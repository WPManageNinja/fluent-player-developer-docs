import DefaultTheme from 'vitepress/theme'
import GlossaryTooltip from 'vitepress-plugin-glossary/vue'

export default {
  ...DefaultTheme,
  enhanceApp({ app }) {
    app.component('GlossaryTooltip', GlossaryTooltip)
  },
}
