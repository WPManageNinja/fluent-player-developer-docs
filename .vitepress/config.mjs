import { defineConfig } from 'vitepress'
import { markdownGlossaryPlugin } from 'vitepress-plugin-glossary'
import glossary from './glossary.json'

function resolveBase() {
  const fromEnv = process.env.VITEPRESS_BASE
  if (fromEnv) return fromEnv.endsWith('/') ? fromEnv : `${fromEnv}/`
  const ghRepo = process.env.GITHUB_REPOSITORY?.split('/')[1]
  if (ghRepo && process.env.GITHUB_ACTIONS) return `/${ghRepo}/`
  return '/'
}

// https://vitepress.dev/reference/site-config
export default defineConfig({
  base: resolveBase(),
  title: 'FluentPlayer Developer Docs',
  description: 'Developer documentation for extending the FluentPlayer WordPress plugin — hooks, REST API, extension guides, and the JS API.',
  cleanUrls: true,
  lastUpdated: true,
  srcExclude: ['README.md', 'devdocs.md', '_generated/**'],
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Get Started', link: '/getting-started/' },
      { text: 'Hooks', link: '/hooks/' },
      { text: 'REST API', link: '/rest-api/' },
      { text: 'Reference', link: '/reference/' },
      { text: 'User Docs', link: 'https://docs.fluentplayer.com' },
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Overview', link: '/getting-started/' },
          { text: 'Architecture', link: '/getting-started/architecture' },
        ],
      },
      {
        text: 'Hooks & Filters',
        items: [
          { text: 'Overview', link: '/hooks/' },
          { text: 'Full Reference', link: '/hooks/reference' },
          { text: 'Actions', link: '/hooks/actions' },
          { text: 'Media Rendering', link: '/hooks/media-rendering' },
          { text: 'Access & Gating', link: '/hooks/access-gating' },
          { text: 'Dynamic Media Sources', link: '/hooks/dynamic-sources' },
          { text: 'Email Providers', link: '/hooks/email' },
          { text: 'Progression', link: '/hooks/progression' },
          { text: 'FluentCommunity', link: '/hooks/community' },
          { text: 'Unlock & Tokens', link: '/hooks/unlock' },
          { text: 'Smartcodes', link: '/hooks/smartcodes' },
        ],
      },
      {
        text: 'REST API',
        items: [
          { text: 'Overview', link: '/rest-api/' },
          { text: 'Media', link: '/rest-api/media' },
          { text: 'Presets', link: '/rest-api/presets' },
          { text: 'Settings', link: '/rest-api/settings' },
          { text: 'Integrations', link: '/rest-api/integrations' },
          { text: 'Email Providers', link: '/rest-api/email-providers' },
          { text: 'YouTube', link: '/rest-api/youtube' },
          { text: 'Layers', link: '/rest-api/layers' },
          { text: 'Smartcodes', link: '/rest-api/smartcodes' },
          { text: 'Migration', link: '/rest-api/migration' },
          { text: 'AJAX Endpoints', link: '/rest-api/ajax' },
          { text: 'Pro Routes', link: '/rest-api/pro' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Overview', link: '/reference/' },
          { text: 'Shortcodes', link: '/reference/shortcodes' },
          { text: 'Blocks', link: '/reference/blocks' },
          { text: 'DOM Attributes', link: '/reference/dom-attributes' },
          { text: 'Data Model', link: '/reference/data-model' },
          { text: 'Capabilities', link: '/reference/capabilities' },
        ],
      },
      {
        text: 'Extending FluentPlayer',
        items: [
          { text: 'Overview', link: '/extending/' },
          { text: 'Custom Email Provider', link: '/extending/custom-email-provider' },
          { text: 'Custom Integration', link: '/extending/custom-integration' },
          { text: 'Behavior Handler', link: '/extending/behavior-handler' },
          { text: 'Free → Pro Contract', link: '/extending/free-pro-contract' },
        ],
      },
      {
        text: 'JS API',
        items: [
          { text: 'Overview', link: '/js-api/' },
        ],
      },
      {
        text: 'Recipes',
        items: [
          { text: 'Snippets', link: '/recipes/' },
        ],
      },
      {
        text: 'Changelog',
        items: [
          { text: 'Developer Changelog', link: '/changelog' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/WPManageNinja' },
    ],

    search: { provider: 'local' },
  },
  markdown: {
    config: (md) => {
      md.use(markdownGlossaryPlugin, { glossary, firstOccurrenceOnly: false })
    },
  },
})
