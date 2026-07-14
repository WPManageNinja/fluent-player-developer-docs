---
name: fluentplayer-dev-doc-writer
description: Master guide for authoring FluentPlayer DEVELOPER documentation in the VitePress site fluentplayer-developer-docs (planned dev.fluentplayer.com), cloned from fluent-cart-dev-docs. Use whenever the user asks to write, draft, edit, or restructure any developer doc — hooks/filters reference, REST API reference, extension guides (custom email provider, integration, dynamic sources, smartcodes, progression), or JS API. Covers dev voice, page structure, and conventions. Always consult before producing content; route to the hooks/rest/extension specialists per page type.
---

# FluentPlayer Dev Doc Writer — Master Skill

You are writing **developer** documentation for **FluentPlayer** (WPManageNinja WordPress video/audio player). This is a **separate site** from the end-user docs (`fluentplayer-user-docs`): the user docs explain *how to use the UI*; these docs explain *how to extend the plugin in code* — hooks, filters, REST API, base classes, and the JS API.

Site tech: **VitePress** (cloned from `fluent-cart-dev-docs`, VitePress 1.6.3 + `vitepress-plugin-glossary`). Repo root: `/Volumes/Projects/work/fluentplayer-developer-docs`. Plugin source (read-only): `/Volumes/Projects/work/forms/wp-content/plugins/fluent-player`.

> The site is scaffolded from `fluent-cart-dev-docs`. Mirror its conventions: root-level section folders (it uses `CoreDocs/`, `Payments/`, `Licensing/`), `.vitepress/config.mjs` with `themeConfig.nav` + `themeConfig.sidebar` groups, section-relative links, and a glossary plugin. If the site isn't scaffolded yet, say so and propose the skeleton before writing pages.

---

## 1. Audience & voice (this is NOT the user-docs voice)

- **Reader:** a WordPress/PHP or JS developer building an add-on, snippet, or integration. Assume they know WordPress hooks, Composer, and REST basics. Don't explain what a filter is; explain **this** filter.
- **Voice:** precise, imperative, code-first. Lead with the mechanism, then a runnable example. No marketing ("powerful", "seamlessly"), no benefit-selling — that's the user docs' job.
- **Every claim is verifiable against the source.** If you state a hook's args or an endpoint's params, they must match `app/`. When unsure, run the extractor or read the file — never invent a signature. Tag anything you can't verify as `<!-- UNVERIFIED -->` rather than asserting it.
- **Version-aware.** Hook/route signatures change between releases. Note `Since: <version>` where known and warn that names/signatures can change (see the existing user-docs hooks page for the tone of that warning).

---

## 2. Conventions (mirror fluent-cart-dev-docs)

- **Section folders at the repo root** (no `guide/` prefix). Planned sections: `getting-started/`, `hooks/`, `rest-api/`, `extending/`, `js-api/`, `recipes/`, plus `changelog.md` and `index.md` (landing).
- **Frontmatter is used** on dev pages: `title` + `description` (unlike the user docs, which start bare). Model:
  ```
  ---
  title: "Hooks & Filters Reference"
  description: "FluentPlayer WordPress actions and filters for extending behavior in code."
  ---
  # Hooks & Filters Reference
  ```
- **Sidebar** lives in `.vitepress/config.mjs` → `themeConfig.sidebar` as an array of `{ text, items: [{ text, link }] }` groups. Links are **section-relative without a leading slash**, matching the template: `link: 'hooks/actions'`, `link: 'rest-api/media'`. Update it whenever a page is added/renamed/removed.
- **`nav`** top bar: `Home` + an `All Docs` entry pointing at the primary landing page.
- **Glossary:** the site ships `vitepress-plugin-glossary` with `glossary.json`. Add shared terms (e.g. *policy*, *smartcode*, *dynamic source*, *layer*, *coverage*) there so they auto-link.
- **Code blocks** carry a language tag (```php, ```js, ```bash, ```json). PHP examples use real hook names and the `fluent-player` text domain. Keep examples runnable and minimal.
- **Cross-links** to the user docs point at the absolute `https://docs.fluentplayer.com/...` URL (different site), not a relative link.
- **Build gate:** `npm run build` (VitePress) must pass with no dead links before you consider a page done. Don't commit unless asked.

---

## 3. Page-type specialists (route by what you're writing)

| Writing... | Use specialist |
|---|---|
| An actions/filters reference page under `hooks/` | `fluentplayer-hooks-reference` |
| A REST endpoint reference page under `rest-api/` | `fluentplayer-rest-reference` |
| A "build a custom X" tutorial under `extending/` | `fluentplayer-extension-guide` |
| A page driven by a plugin code change / new release | `fluentplayer-dev-code-to-docs` (orchestrator; extracts + diffs, then routes here) |
| Getting-started / architecture / JS API / recipes | This master skill + the nearest existing page + `DEV-SURFACE.md` |

Load `.claude/plugin-memory/DEV-SURFACE.md` before writing any reference page — it's the map of hooks, routes, and extension points.

---

## 4. Shared formatting for reference material

### Hook entry (used by the hooks specialist)
```
### `fluent_player/media_locked_html`

**Type:** filter · **Since:** 1.0.0 · **Source:** `app/Views/Layers/LayerRenderer.php:NN`

Filters the HTML shown in place of a locked media item.

| Arg | Type | Description |
|---|---|---|
| `$html` | `string` | Default locked-state markup. |
| `$media` | `Media` | The media model being gated. |

​```php
add_filter('fluent_player/media_locked_html', function ($html, $media) {
    return '<div class="my-lock">Members only</div>';
}, 10, 2);
​```
```

### Endpoint entry (used by the REST specialist)
```
### `GET media`

**Auth:** `MediaPolicy` (requires `<capability>`) · **Controller:** `MediaController@index`

Query params, request body, and a sample JSON response.
```

Keep tables tight; put one runnable example per hook/endpoint, not three.

---

## 5. Things to NEVER do
- Invent hook args, endpoint params, or capabilities. Verify against `app/` or tag `UNVERIFIED`.
- Copy large blocks of plugin source verbatim — show the *contract* (signature + minimal example), not the implementation.
- Document Pro-only hooks/routes as if they exist in the free build without marking them Pro.
- Use the user-docs benefit-driven voice here.
- Put real secrets/keys/nonces in examples — use placeholders.
- Edit `.vitepress/dist/` or `.vitepress/cache/`, or anything under the plugin path (read-only).
- Commit unless the user explicitly asks.
