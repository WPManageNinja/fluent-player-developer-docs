---
title: "Getting Started"
description: "Orientation for developers extending the FluentPlayer WordPress plugin."
---

# Getting Started

This site documents the **developer surface** of FluentPlayer: the WordPress hooks, REST API, extension base classes, and JS API you use to customize or build on top of the plugin. For end-user, click-through documentation, see the [user docs](https://docs.fluentplayer.com).

## What you can extend

| You want to... | Start here |
|---|---|
| Change what the player renders, or gate access to media | [Hooks & Filters](/hooks/) |
| Call the plugin's admin endpoints from your own code | [REST API](/rest-api/) |
| Call a frontend `admin-ajax.php` action | [AJAX actions](/rest-api/ajax) |
| Send captured emails to a new service | [Custom Email Provider](/extending/custom-email-provider) |
| Add a hosted-streaming or third-party integration | [Custom Integration](/extending/custom-integration) |
| Resolve a media source dynamically (URL, post meta, filter) | [Dynamic Media Sources](/hooks/dynamic-sources) |
| Embed a player from a template or another plugin | [Shortcode reference](/reference/shortcodes) |
| Read or write the plugin's stored data directly | [Data model](/reference/data-model) |
| Work out which capability guards a route | [Capabilities](/reference/capabilities) |
| React to player events in the browser | [JS API](/js-api/) |
| Find or preserve the `data-*` attributes the runtime depends on | [DOM attributes](/reference/dom-attributes) |
| Copy a working snippet | [Recipes](/recipes/) |

## Requirements

Verified against the plugin headers and `readme.txt` at **1.3.0**:

| | Free | Pro |
|---|---|---|
| Plugin folder / slug | `fluent-player` | `fluent-player-pro` |
| Version | 1.3.0 (`fluent-player.php:6`) | 1.3.0 |
| **PHP** | **7.4** (`readme.txt:6`) | **7.4** |
| WordPress | 6.4 or later, tested to 7.0 | 5.0 or later, tested to 6.9 |
| Text domain | `fluent-player` (`fluent-player.php:10`) | **`fluent-player-pro`** (`fluent-player-pro/fluent-player-pro.php:13`) |

::: danger PHP 7.4 is the floor — write to it
`Requires PHP: 7.4` means your callbacks run on PHP 7.4 installs. `str_ends_with()`, `str_contains()`, `str_starts_with()`, `match`, enums, constructor promotion, and named arguments are all PHP 8.0+ and cause a **fatal error**, not a warning. In a filter attached to an AJAX handler that fatal is the whole request. Every snippet on this site is 7.4-safe; keep yours the same.
:::

## Detecting Pro

`FluentPlayer\App\Helpers\Helper::hasPro()` is the canonical check (`app/Helpers/Helper.php:1093-1096`). It returns `defined('FLUENT_PLAYER_PRO_VERSION')`, so the bare `defined()` call is equivalent and works even before FluentPlayer's own classes are autoloaded.

```php
if (defined('FLUENT_PLAYER_PRO_VERSION')) {
    // Pro is active
}
```

::: warning `defined()` means Pro's file loaded — not that Pro booted
The free plugin defines `FLUENT_PLAYER_MIN_PRO_VERSION` = `1.0.7` (`fluent-player.php:23`), but **nothing is gated by it**. Its only consumer is an `admin_notices` callback (`app/Hooks/actions.php:43-59`) that prints "Your FluentPlayer Pro is outdated" to users with `activate_plugins`. An older Pro still loads and still registers everything.

The enforced gate runs the other way. Pro declares `FLUENT_PLAYER_PRO_MIN_CORE_VERSION` = `1.0.9` (`fluent-player-pro/fluent-player-pro.php:22`) and, inside its `fluent_player/loaded` listener, `return`s **before** `new Application(...)` when the free version is below it (`fluent-player-pro/boot/app.php:14-19`). In that state `FLUENT_PLAYER_PRO_VERSION` is defined — the constant is set at `fluent-player-pro.php:20`, before the boot closure runs — yet no Pro route, hook, block, or integration exists.

So if you depend on a specific Pro hook, compare `FLUENT_PLAYER_PRO_VERSION` explicitly, or feature-detect the thing you actually need (`has_filter()`, `class_exists()`), rather than treating `defined()` as proof Pro is running.
:::

The same flag reaches the browser as `window.fluent_player.has_pro` (`app/Services/MediaRenderer.php:310`) and the block editor as `window.fluentPlayerBlockVars.hasPro`.

## Conventions used across these docs

- PHP hooks use the **`fluent_player/`** prefix (`config/app.php:9`). Pro adds most of its hooks under the same prefix; only three use `fluent_player_pro/` — `generate_storyboard`, `license_key`, and `storyboard_asset_allowed_hosts`.
- The **text domains differ between the two plugins**: `fluent-player` in free (`config/app.php:8`), `fluent-player-pro` in Pro. See [i18n and text domains](/getting-started/architecture#i18n-and-text-domains).
- Namespaces are **`FluentPlayer\App\...`** (the plugin is built on WPFluent).
- The REST namespace is **`fluent-player/v2`** — every endpoint lives under `/wp-json/fluent-player/v2/` (`config/app.php:10-11`).
- Code examples are runnable, minimal, and PHP 7.4-safe. Signatures are verified against the plugin source; the file and line are cited so you can read the call site yourself.
- Anything marked **(Pro)** ships in the separate FluentPlayer Pro plugin, not the free build. The marker is used in the [Full Hooks Reference](/hooks/reference) Edition column, on the [Pro REST routes](/rest-api/pro) page, and inline on any free page that mentions a Pro-gated feature.

::: warning Version stability
Hook names, arguments, and endpoints can change between releases. Test customizations on staging and pin to the plugin version you verified against. The [Developer Changelog](/changelog) tracks developer-facing changes.
:::

## Next

Read the [Architecture](/getting-started/architecture) overview to learn how the plugin is laid out, then jump into the [Hooks](/hooks/) or [REST API](/rest-api/) reference — or skip straight to a working snippet in [Recipes](/recipes/).
