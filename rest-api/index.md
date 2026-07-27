---
title: "REST API"
description: "FluentPlayer's WPFluent REST route groups, authentication model, and conventions."
---

# REST API

FluentPlayer's REST API is defined with the **WPFluent router** in `app/Http/Routes/api.php`. Routes are grouped by a URL **prefix**, each guarded by a **policy** (an authorization class) and handled by a controller.

Most routes are authenticated, but **not all of them are admin-only, and three are not authenticated at all**. Read [Authentication](#authentication) before assuming a capability.

## Base namespace

```
/wp-json/fluent-player/v2/
```

The namespace comes from `config/app.php:10-11` (`'rest_namespace' => 'fluent-player'`, `'rest_version' => 'v2'`), joined by `Router::getRestNamespace()` (`vendor/wpfluent/framework/src/WPFluent/Http/Router.php:424-431`).

A concrete request:

```
GET /wp-json/fluent-player/v2/media/123
X-WP-Nonce: <wp_rest nonce>
```

The admin app does not hard-code this — it reads it at runtime from `window.fluentFrameworkAdmin.rest`, built by `Helper::getRestInfo()` (`app/Helpers/Helper.php:435-450`) and localized in `AdminMenuHandler::localizeScript()` (`app/Hooks/Handlers/AdminMenuHandler.php:361` and `:383`). That object carries `base_url`, `url`, `nonce`, `namespace`, and `version`.

The namespace is nevertheless stable at `v2`, and is hard-coded at three runtime sites in the current source:

- `app/Blocks/FluentCommunityMediaBlock.php:535` — `rest_url('fluent-player/v2/')`
- Pro `app/Integrations/MuxIntegration.php:200` — `rest_url('fluent-player/v2/mux/webhook')`
- Pro `app/Services/CloudflareStreamService.php:350` — `rest_url('fluent-player/v2/cloudflare-stream/webhook')`

## Authentication

Every route group runs its policy before the controller. Requests from the admin app and the block editor carry the standard WordPress REST nonce:

```
X-WP-Nonce: <wp_rest nonce>
```

A request that fails the policy returns a permission error (HTTP 401/403).

### Capability per policy

There is **no single capability** across the API. Authoring surfaces (media, presets, layers, smartcodes) are Editor-level; site-configuration surfaces (settings, integrations, migration, analytics) are admin-level.

| Policy | Capability | Source |
|---|---|---|
| `MediaPolicy` | `edit_others_posts` | `app/Http/Policies/MediaPolicy.php:16` |
| `PresetPolicy` (free) | `edit_others_posts` | `app/Http/Policies/PresetPolicy.php:21` |
| `LayerPolicy` | `edit_others_posts` | `app/Http/Policies/LayerPolicy.php:21` |
| `SettingsPolicy` | `manage_options` | `app/Http/Policies/SettingsPolicy.php:20` |
| `MigrationPolicy` | `manage_options` | `app/Http/Policies/MigrationPolicy.php:18` |
| `AnalyticsPolicy` **(Pro)** | `manage_options` | Pro `app/Http/Policies/AnalyticsPolicy.php:12` |
| `PlaylistPolicy` **(Pro)** | `edit_others_posts` | Pro `app/Http/Policies/PlaylistPolicy.php:21-25` |
| `PresetPolicy` **(Pro)** | `manage_options` | Pro `app/Http/Policies/PresetPolicy.php:17` |

`MediaPolicy`, `PresetPolicy` (free) and `LayerPolicy` all call `current_user_can(Helper::authoringCapability())`. That helper returns:

```php
apply_filters('fluent_player/authoring_capability', 'edit_others_posts')
```

`app/Helpers/Helper.php:1110-1113`. So the authoring gate is **Editor-level and filterable** — a site can tighten it to `manage_options` or loosen it, and the change applies to every authoring route at once. The default is deliberately `edit_others_posts` rather than `edit_posts`/`upload_files`: these routes have no per-object ownership check and cover destructive operations (delete, force-delete, bulk actions).

Pro's `PlaylistPolicy` reuses the same helper, with a hard-coded `edit_others_posts` fallback for older free builds that predate `authoringCapability()`.

::: warning Three Pro routes have no policy at all
They are registered outside any `withPolicy()` group, so **no capability is checked**. They are not part of the admin API surface and must not be treated as one:

| Method | Path | Why it is public | Source |
|---|---|---|---|
| `GET` | `bunny/storage/stream` | Serves video bytes to frontend visitors | Pro `app/Http/Routes/api.php:34` (comment at `:33`) |
| `POST` | `cloudflare-stream/webhook` | Provider callback, verified via the `Webhook-Signature` header | Pro `app/Http/Routes/api.php:57` |
| `POST` | `mux/webhook` | Provider callback, verified via the `Mux-Signature` header | Pro `app/Http/Routes/api.php:109` |

See [Pro REST surface](/rest-api/pro) for details.
:::

Separately, the plugin exposes **public `admin-ajax.php` actions** that are not REST routes at all — email capture, unlock, milestone/layer behavior pings. See [Admin-AJAX endpoints](/rest-api/ajax).

## Free route groups (45 routes, 9 groups)

| Prefix | Policy | Capability | Controller | Page |
|---|---|---|---|---|
| `media` | `MediaPolicy` | `edit_others_posts` | `MediaController` | [Media](/rest-api/media) |
| `presets` | `PresetPolicy` | `edit_others_posts` | `PresetController` | [Presets](/rest-api/presets) |
| `settings` | `SettingsPolicy` | `manage_options` | `SettingsController` | [Settings](/rest-api/settings) |
| `integrations` | `SettingsPolicy` | `manage_options` | `IntegrationController` | [Integrations](/rest-api/integrations) |
| `email-providers` | `SettingsPolicy` | `manage_options` | `EmailProviderController` | [Email Providers](/rest-api/email-providers) |
| `youtube` | `SettingsPolicy` | `manage_options` | `YouTubeController` | [YouTube](/rest-api/youtube) |
| `layer` | `LayerPolicy` | `edit_others_posts` | `LayerController` | [Layers](/rest-api/layers) |
| `smartcodes` | `MediaPolicy` | `edit_others_posts` | `SmartcodeController` | [Smartcodes](/rest-api/smartcodes) |
| `migration` | `MigrationPolicy` | `manage_options` | `MigrationController` | [Migration](/rest-api/migration) |

::: tip Pro adds 102 more routes
FluentPlayer Pro registers **102 additional routes** — 99 across 11 prefixes, plus the 3 unprefixed public routes. That includes write routes on the `presets` and `media` prefixes documented above. Total across both plugins: **147**. See [Pro REST surface](/rest-api/pro).
:::

To regenerate the route inventory from source:

```bash
npm run extract:routes
```

The extractor scans both source-of-truth repos (`fluent-player-dev` and `fluent-player-pro`) by default and writes `_generated/routes.md` and `_generated/routes.json`.

## Conventions

- **URL shape:** `/wp-json/fluent-player/v2/` + group prefix + route path.
- **Path parameters** are written `{name}` in the router (and `{name?}` when optional). They compile to named regex groups `(?P<name>…)` at registration time — `vendor/wpfluent/framework/src/WPFluent/Http/Route.php:852-891`. Only one route in either plugin uses optional params: [`analytics/performance-over-time/{scope?}/{id?}`](/rest-api/pro#analytics).
- **IDs** are WordPress post IDs (media is a custom post type, `fluent_player_media`).
- **Responses** are JSON. Most groups wrap success in an envelope; `presets` reads are the exception (bare array/object).
- **Mutations** use `POST` (create), `PUT` (update/restore), `DELETE` (trash/force-delete).
