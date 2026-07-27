---
name: fluentplayer-hooks-reference
description: Specialist template for FluentPlayer action/filter reference pages under hooks/ in the developer docs. Use when writing or editing any hooks reference page (all actions, all filters, or a grouped page like Media Rendering, Access Gating, Email Providers, Dynamic Sources). Produces verified hook entries with signature, args, since-version, source location, and one runnable example each. Always pair with fluentplayer-dev-doc-writer and load DEV-SURFACE.md.
---

# FluentPlayer Hooks Reference Template

Hook reference pages document `do_action`/`apply_filters` extension points. FluentPlayer exposes **15 actions** and **77 filters** (free tree) under the `fluent_player/` prefix — enough to warrant grouped pages, not one giant list.

## Page organization

Prefer **grouped pages** over a single dump (groups from `DEV-SURFACE.md` §2):
- `hooks/index.md` — what hooks are, the version-stability warning, links to the groups, and the "discover all" grep tip.
- `hooks/actions.md` — the 15 actions (media lifecycle, email, watch, registries, FluentCRM behavior).
- `hooks/media-rendering.md` — `block_media_output`, `media_block_vars`, `media_default_settings`, `default_preload`, `allowed_media_providers`, etc.
- `hooks/access-gating.md` — `media_locked_html`, `access_denied_message`, etc.
- `hooks/email-providers.md` — `email_providers`, `email_data`, `email_export_columns`, `email_template`, etc.
- `hooks/dynamic-sources.md` — `dynamic_source_overrides`, `dynamic_source_post_id`, `dynamic_source_meta_key_allowed`, `external_tracked_media`.
- `hooks/community.md`, `hooks/playlist.md`, `hooks/i18n.md` as the surface warrants.

## Required page structure

```
---
title: "<Group> Hooks"
description: "<one line>"
---
# <Group> Hooks

<One-paragraph intro: what this group of hooks lets you do.>

::: warning
Hook names and signatures can change between releases. Test on staging and pin to the plugin version you verified against.
:::

## `fluent_player/<hook_name>`

**Type:** filter | action · **Since:** <version | UNVERIFIED> · **Source:** `app/<path>:<line>`

<One or two sentences: exactly what it filters / when it fires.>

| Arg | Type | Description |
|---|---|---|
| `$first` | `string` | ... |
| `$second` | `Media` | ... |

​```php
add_filter('fluent_player/<hook_name>', function ($first, $second) {
    // ...
    return $first;
}, 10, 2);
​```

## `fluent_player/<next_hook>`
...
```

### Rules
- **Verify every entry against source.** Get the arg list and count from the actual `apply_filters(...)`/`do_action(...)` call. The `accepted_args` in the example must match. Cite `file:line`.
- **Action vs filter is not guesswork** — actions have no return; filters must `return`. The example must reflect which it is.
- **One runnable example per hook.** Minimal, real hook name, `fluent-player` text domain, correct priority/arg-count.
- **Order within a group:** most-used first, or by lifecycle order for actions (before_* then after_*).
- **Mark Pro-only hooks** with `(Pro)` in the heading and a note; verify against the Pro build or the user.
- **Discovery tip** belongs on `hooks/index.md`: tell readers to grep `apply_filters( 'fluent_player/` and `do_action( 'fluent_player` in their installed version for the exhaustive list.

## Generating entries (hybrid workflow)
Don't hand-list 77 filters. Run the extractor from `fluentplayer-dev-code-to-docs` to emit stubs (name, file:line, arg count) per group, then curate each: write the description, name the args by reading the call site, add the example. The extractor keeps the *set* correct; you make it *readable*.

## Sidebar entry

Add under a `Hooks` group in `.vitepress/config.mjs` → `themeConfig.sidebar`:
```js
{ text: 'Access & Gating', link: 'hooks/access-gating' }
```

## Common pitfalls
- **Stale arg counts** — the most common error. Re-read the call site; don't trust an old example.
- **Mislabeling action/filter** — check for a `return` at the call site.
- **Listing a Pro hook as free.**
- **A wall of hooks with no examples** — every documented hook gets one example.
