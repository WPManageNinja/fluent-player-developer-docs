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

## Structure

```
.
├── index.md                     # home (hero + feature cards)
├── getting-started/             # overview + architecture
├── hooks/                       # actions + filter groups (access-gating, dynamic-sources, email)
├── rest-api/                    # route-group reference (media expanded)
├── extending/                   # "build a custom X" guides (email provider)
├── js-api/                      # frontend player/events surface
├── recipes/                     # copy-paste snippets
├── changelog.md                 # developer-facing changelog
└── .vitepress/
    ├── config.mjs               # nav, sidebar, glossary, local search — SINGLE SOURCE OF TRUTH
    ├── glossary.json            # auto-linked term tooltips
    └── theme/index.js           # extends default theme + glossary tooltip
```

## Authoring

Skills for writing these docs live under `.claude/skills/` (master `fluentplayer-dev-doc-writer`,
the hooks/rest/extension specialists, and the `fluentplayer-dev-code-to-docs` orchestrator).
The developer surface map is `.claude/plugin-memory/DEV-SURFACE.md`.

Plugin source (read-only): `/Volumes/Projects/work/forms/wp-content/plugins/fluent-player`.
Signatures on reference pages are verified against that source and cited with `file:line`.

## Status

Scaffold + seed content complete and building. Reference pages are curated seeds — the full
hook (62 filters) / route (~45) surface is documented incrementally via the code-to-docs skill.
`bin/extract-hooks.mjs` / `bin/extract-routes.mjs` are planned (grep fallbacks are in the skill for now).
