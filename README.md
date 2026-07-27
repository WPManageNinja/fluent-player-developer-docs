# FluentPlayer Developer Docs

VitePress source for the FluentPlayer **developer** documentation (planned domain: `dev.fluentplayer.com`).
This is separate from the end-user docs (`fluentplayer-user-docs`): the user docs explain the UI; this site
documents how to extend the plugin in code — hooks, REST API, extension base classes, and the JS API.

## Commands

```bash
npm install
npm run dev       # local dev server with HMR
npm run build     # production build (fails on dead internal links)
npm run preview   # preview the production build
```

`npm run build:gh-pages` builds with the `/fluentplayer-developer-docs/` base path for GitHub Pages.

## Regenerating the reference surface

```bash
npm run extract           # hooks + routes (runs both extractors)
npm run extract:hooks     # → _generated/hooks.json + _generated/hooks.md
npm run extract:routes    # → _generated/routes.json + _generated/routes.md
```

Both scripts take an optional `[freePath] [proPath]` pair and default to
`/Volumes/Projects/forms/wp-content/plugins/fluent-player-dev` and
`/Volumes/Projects/forms/wp-content/plugins/fluent-player-pro`:

```bash
node bin/extract-hooks.mjs  /path/to/fluent-player-dev /path/to/fluent-player-pro
node bin/extract-routes.mjs /path/to/fluent-player-dev /path/to/fluent-player-pro
```

They scan `app/` and `boot/` in **both** trees, cover all four dispatch forms
(`do_action` / `apply_filters` plus the WPFluent wrappers `$app->doAction()` / `$app->applyFilters()`),
and tag every hook `free` / `pro` / `both`. Test trees, `vendor/`, and `node_modules/` are excluded,
so the counts reflect the shipped surface. Hooks with no literal name at their dispatch site — the
`fluent_player/daily_cleanup` cron hook and the two behavior actions dispatched via
`do_action($this->eventName(), …)` — are carried as verified manual entries, and
`extract-hooks.mjs` exits non-zero if it meets a dynamic dispatch site no entry accounts for.
`callbackArgs` is the **minimum** across a hook's dispatch sites: the contract a callback can
safely rely on.

The `_generated/` output is authoritative for **names, counts, arg counts, and `file:line`**.
Descriptions and examples on the content pages are curated by hand on top of it.

## Structure

```
.
├── index.md                     # home (hero + feature cards)
├── getting-started/             # overview + architecture
├── hooks/                       # actions + filter groups + full generated reference
├── rest-api/                    # route-group reference, Pro routes, AJAX actions
├── reference/                   # shortcodes, data model, capabilities
├── extending/                   # "build a custom X" guides
├── js-api/                      # frontend globals, events, localized config objects
├── recipes/                     # copy-paste snippets
├── changelog.md                 # developer-facing changelog
├── _generated/                  # extractor output (hooks.json/md, routes.json/md)
├── bin/                         # extract-hooks.mjs, extract-routes.mjs
└── .vitepress/
    ├── config.mjs               # nav, sidebar, glossary, local search — SINGLE SOURCE OF TRUTH
    ├── glossary.json            # auto-linked term tooltips
    └── theme/index.js           # extends default theme + glossary tooltip
```

## Authoring

Skills for writing these docs live under `.claude/skills/` (master `fluentplayer-dev-doc-writer`,
the hooks/rest/extension specialists, and the `fluentplayer-dev-code-to-docs` orchestrator).
The developer surface map is `.claude/plugin-memory/DEV-SURFACE.md`.

Plugin sources (read-only), both at **1.3.0**:

- Free: `/Volumes/Projects/forms/wp-content/plugins/fluent-player-dev`
- Pro: `/Volumes/Projects/forms/wp-content/plugins/fluent-player-pro`

Signatures on reference pages are verified against those trees and cited with `file:line`.

Two rules that keep the site honest:

1. **Every code example must run.** Trace it to its call site before publishing it.
2. **PHP 7.4 is the floor** (both plugins declare `Requires PHP: 7.4`). No `str_ends_with`,
   `str_contains`, `match`, enums, or named arguments in any snippet.

## Status

Building. Current surface as generated from 1.3.0:

| | Actions | Filters | REST routes |
|---|---|---|---|
| Free | 15 | 77 | 45 |
| Pro-only | 8 | 12 | 102 |

REST base is `/wp-json/fluent-player/v2/` (`config/app.php:10-11`).
