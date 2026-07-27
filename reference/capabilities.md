---
title: "Capabilities & Permissions"
description: "The exact capability every FluentPlayer REST policy requires, the filterable authoring gate, the free/Pro PresetPolicy trap, and the separate nonce-based AJAX model."
---

# Capabilities & Permissions

FluentPlayer has **three** distinct permission models, and confusing them is the most common source of "why is this 403 / why is this open?" questions:

| Surface | Gate | Failure |
|---|---|---|
| REST routes | A **policy class** run as WordPress's `permission_callback` | 401 / 403 |
| AJAX actions | A **nonce**, plus rate limiting — *not* a capability | JSON error response |
| Three Pro REST routes | **Nothing** — public by design, authenticated by provider signature or a signed token | — |

::: danger Not everything requires `manage_options`
**22 of the 45 free routes require only `edit_others_posts`** (Editor level), not `manage_options`. Any documentation or assumption that "the REST API is admin-only" is wrong. The split is exact:

| Capability | Free routes |
|---|---|
| `edit_others_posts` (via `Helper::authoringCapability()`) | 22 — `media` (16), `smartcodes` (1), `layer` (3), `presets` (2) |
| `manage_options` | 23 — `settings` (3), `integrations` (4), `email-providers` (5), `youtube` (1), `migration` (10) |
:::

## Policy map

| Policy | Capability | Source | Edition |
|---|---|---|---|
| `MediaPolicy` | `Helper::authoringCapability()` → `edit_others_posts` | free `app/Http/Policies/MediaPolicy.php:16` | Free |
| `PresetPolicy` | `Helper::authoringCapability()` → `edit_others_posts` | free `app/Http/Policies/PresetPolicy.php:21` | Free |
| `LayerPolicy` | `Helper::authoringCapability()` → `edit_others_posts` | free `app/Http/Policies/LayerPolicy.php:21` | Free |
| `SettingsPolicy` | `manage_options` | free `app/Http/Policies/SettingsPolicy.php:20` | Free |
| `MigrationPolicy` | `manage_options` | free `app/Http/Policies/MigrationPolicy.php:18` | Free |
| `AnalyticsPolicy` **(Pro)** | `manage_options` | pro `app/Http/Policies/AnalyticsPolicy.php:12` | Pro |
| `PlaylistPolicy` **(Pro)** | `Helper::authoringCapability()` → `edit_others_posts` | pro `app/Http/Policies/PlaylistPolicy.php:21-25` | Pro |
| `PresetPolicy` **(Pro)** | `manage_options` | pro `app/Http/Policies/PresetPolicy.php:17` | Pro |

### Free route groups

| Prefix | Policy | Capability | Registered |
|---|---|---|---|
| `media` | `MediaPolicy` | `edit_others_posts` | `app/Http/Routes/api.php:8` |
| `presets` | `PresetPolicy` | `edit_others_posts` | `:27` |
| `settings` | `SettingsPolicy` | `manage_options` | `:32` |
| `integrations` | `SettingsPolicy` | `manage_options` | `:38` |
| `email-providers` | `SettingsPolicy` | `manage_options` | `:46` |
| `youtube` | `SettingsPolicy` | `manage_options` | `:55` |
| `layer` | `LayerPolicy` | `edit_others_posts` | `:60` |
| `smartcodes` | **`MediaPolicy`** | `edit_others_posts` | `:69` |
| `migration` | `MigrationPolicy` | `manage_options` | `:74` |

::: tip `smartcodes` is an authoring gate, not a settings gate
`smartcodes` is a read-only token list consumed by the block editor's shortcode inserter, so it deliberately uses `MediaPolicy` (`api.php:66-71`) — an Editor authoring a media needs it. Do not assume it follows the other read-only groups onto `SettingsPolicy`.
:::

### Pro route groups

| Prefix | Policy | Capability | Registered |
|---|---|---|---|
| `bunny/stream` | free `MediaPolicy` | `edit_others_posts` | pro `app/Http/Routes/api.php:11` |
| `bunny/storage` | free `MediaPolicy` | `edit_others_posts` | pro `:25` |
| `r2` | free `MediaPolicy` | `edit_others_posts` | pro `:37` |
| `cloudflare-stream` | free `MediaPolicy` | `edit_others_posts` | pro `:47` |
| `mux` (media operations) | free `MediaPolicy` | `edit_others_posts` | pro `:60` |
| `mux` (infrastructure) | free `SettingsPolicy` | **`manage_options`** | pro `:97` |
| `gumlet` | free `MediaPolicy` | `edit_others_posts` | pro `:112` |
| `media` (subtitles) | free `MediaPolicy` | `edit_others_posts` | pro `:128` |
| `settings/license` | free `SettingsPolicy` | `manage_options` | pro `:136-137` |
| `media` (timed content) | free `MediaPolicy` | `edit_others_posts` | pro `:145` |
| `presets` | **Pro** `PresetPolicy` | **`manage_options`** | pro `:149` |
| `analytics` | `AnalyticsPolicy` | `manage_options` | pro `:156` |
| `playlist` | `PlaylistPolicy` | `edit_others_posts` | pro `:181` |

## The authoring capability is filterable

`MediaPolicy`, `PresetPolicy` (free), `LayerPolicy`, and Pro's `PlaylistPolicy` all resolve their capability through one helper:

```php
public static function authoringCapability()
{
    return (string) apply_filters('fluent_player/authoring_capability', 'edit_others_posts');
}
```

free `app/Helpers/Helper.php:1110-1114` (the `apply_filters` call is `:1113`).

**`fluent_player/authoring_capability`** — filter · free `app/Helpers/Helper.php:1113` · 1 arg

| Arg | Type | Description |
|---|---|---|
| `$capability` | `string` | The capability string checked with `current_user_can()`. Defaults to `edit_others_posts`. |

The default is deliberately `edit_others_posts` and deliberately **not** `edit_posts` or `upload_files`: these routes have no per-object ownership check and cover destructive operations (delete, force-delete, bulk actions), so Contributors and Authors are excluded (`:1100-1106`).

**Tighten it** — restrict media/preset/layer/playlist authoring to administrators:

```php
add_filter('fluent_player/authoring_capability', fn () => 'manage_options');
```

**Loosen it** — let any user who can publish posts author media (accepting that they can delete other users' media):

```php
add_filter('fluent_player/authoring_capability', fn () => 'publish_posts');
```

**Scope it to a custom capability** you grant per role:

```php
add_filter('fluent_player/authoring_capability', fn () => 'manage_fluent_player_media');
```

The filter changes **all four** policies at once — there is no per-policy variant. Site-config routes (`settings`, `integrations`, `migration`) stay on `manage_options` regardless.

::: warning Pro's `PlaylistPolicy` fails safe, not open
Pro guards the call with `method_exists(Helper::class, 'authoringCapability')` and falls back to the literal `'edit_others_posts'` when running against a free build that predates the helper (pro `app/Http/Policies/PlaylistPolicy.php:21-23`). If you filter the capability *up*, an older free plugin means playlists silently stay at Editor level.
:::

## Trap: `PresetPolicy` means two different things

::: danger Same class name, different capability, different edition
| | Free `PresetPolicy` | Pro `PresetPolicy` |
|---|---|---|
| Namespace | `FluentPlayer\App\Http\Policies` | `FluentPlayerPro\App\Http\Policies` |
| Capability | `Helper::authoringCapability()` → `edit_others_posts` | `manage_options` |
| Source | free `app/Http/Policies/PresetPolicy.php:21` | pro `app/Http/Policies/PresetPolicy.php:17` |
| Guards | `GET presets/`, `GET presets/{slug}` (free `api.php:27-30`) | `POST presets/`, `PUT presets/{slug}`, `DELETE presets/{slug}` (pro `api.php:149-153`) |

The split is coherent — **reading** presets is part of authoring, **writing** them is site configuration — but the shared class name makes it easy to misread. An Editor can list and fetch presets and cannot create, edit, or delete one.
:::

## Trap: the Mux capability split **(Pro)**

Mux routes are registered as **two groups under the same `mux` prefix** with different policies:

| Group | Policy | Routes |
|---|---|---|
| Media operations (pro `api.php:60-91`) | free `MediaPolicy` — `edit_others_posts` | assets, direct uploads, tracks/subtitles, live-stream CRUD, delivery usage, captions |
| Infrastructure (pro `api.php:97-106`) | free `SettingsPolicy` — **`manage_options`** | `signing-keys/generate`, `GET/POST signing-keys`, `DELETE signing-keys/{id}`, `live-streams/{id}/reset-stream-key`, `GET/POST playback-restrictions`, `DELETE playback-restrictions/{id}` |

The escalation is deliberate and documented in the source (pro `api.php:93-96`): signing keys sign playback tokens, resetting a stream key disrupts a live stream, and playback restrictions control who can play. Those must not fall under the editor-level authoring gate.

**Consequence:** an Editor can create and delete a Mux live stream but cannot reset its stream key. Do not assume a role that passes one `mux/*` route passes all of them.

## Public routes: three, all Pro

Three Pro routes are registered **outside any `withPolicy()` group** and therefore have no capability check at all:

| Route | Registered | How it actually authenticates |
|---|---|---|
| `GET bunny/storage/stream` | pro `app/Http/Routes/api.php:34` | A signed, expiring stream token — `BunnyCDNStorageService::verifyStreamToken($fileName, $expires, $token)` (pro `app/Http/Controllers/BunnyCDNStorageController.php:247`), HMAC'd with the `flp_stream_secret` option. |
| `POST cloudflare-stream/webhook` | pro `:57` | The `Webhook-Signature` request header, checked against the stored `webhook_secret` (pro `app/Http/Controllers/CloudflareStreamController.php:128-129`). |
| `POST mux/webhook` | pro `:109` | The `Mux-Signature` header HMAC (pro `app/Http/Controllers/MuxController.php:928`, `:938`). |

::: warning These are not "unprotected"
They authenticate by **provider signature or signed token**, not by WordPress capability, because the caller is Mux/Cloudflare/an anonymous video request — none of which have a WP user. Do not "fix" them by adding a policy; that would break playback and webhook delivery. Do treat `flp_stream_secret` and each provider's `webhook_secret` as credentials.
:::

## How policies become permission callbacks

WPFluent wires the policy as WordPress's own REST `permission_callback` — `vendor/wpfluent/framework/src/WPFluent/Http/Route.php:813` (`[$this, 'permissionCallback']`) and `:1589` (`$policyHandler`). A rejected request therefore returns the **standard WordPress REST error**: 401 when unauthenticated, 403 when authenticated but under-privileged. Admin-app requests carry the usual nonce:

```
X-WP-Nonce: <wp_rest nonce>
```

The REST base is `/wp-json/fluent-player/v2/` (`config/app.php:10-11`).

## The AJAX surface has a different model

Front-end AJAX actions are gated by **nonces**, not capabilities — a logged-out visitor must be able to submit an email or record progress. See [AJAX endpoints](/rest-api/ajax) for the full request/response shapes.

Two nonce actions are in play:

| Nonce action | Used by | Created at |
|---|---|---|
| `fluent_player_frontend` | Progression, unlock, FluentCommunity media data | `app/Services/MediaRenderer.php:308`, `app/Blocks/FluentCommunityMediaBlock.php:534` |
| `fluent_player_behavior` | Every `AbstractBehaviorHandler` subclass | `app/Hooks/Handlers/AbstractBehaviorHandler.php:15` (`NONCE_ACTION`) |

| AJAX action | `nopriv`? | Registered | Nonce |
|---|---|---|---|
| `fluent_player_progression` | **No** — logged-in only | `app/Hooks/Handlers/ProgressionHandler.php:21` | `fluent_player_frontend` (`:28`) |
| `fluent_player_unlock` | Yes | `app/Hooks/Handlers/UnlockHandler.php:21-22` | `fluent_player_frontend` (`:29`) |
| `fluent_player_email_submit` | Yes | `app/Hooks/Handlers/EmailCollectionHandler.php:57-58` | verified at `:290` |
| `fluent_player_get_media_data` | Yes | `app/Blocks/FluentCommunityMediaBlock.php:65-66` | `fluent_player_frontend` (`:747`) |
| `fluent_player_layer_event` | Yes | via `AbstractBehaviorHandler.php:35-36`; action name at `app/Hooks/Handlers/LayerEventHandler.php:13` | `fluent_player_behavior` (`:84`) |
| `fluent_player_media_milestone` | Yes | via `AbstractBehaviorHandler.php:35-36`; action name at `app/Hooks/Handlers/MediaMilestoneHandler.php:13` | `fluent_player_behavior` (`:84`) |
| `fluent_player_track_event` **(Pro)** | Yes | pro `app/Hooks/Handlers/AnalyticsHandler.php:56-57` | verified at pro `:118` |

**Five free actions are `nopriv`** — reachable by logged-out visitors. `fluent_player_progression` is the only free AJAX action restricted to authenticated users.

### Rate limiting stands in for authorization

Because a nonce is not an authorization decision, `AbstractBehaviorHandler` adds throttling (`app/Hooks/Handlers/AbstractBehaviorHandler.php:15-20`):

| Constant | Value | Meaning |
|---|---|---|
| `RATE_LIMIT` | `60` | Max requests per 60-second window (`:241-251`) |
| `LOCK_TTL` | `15` | Seconds a per-request lock is held before it is considered stale (`:205`) |
| `ANON_COOKIE_TTL` | `21600` | 6 hours — anonymous visitor identity cookie lifetime |

If you subclass `AbstractBehaviorHandler`, you inherit all three. Raising `RATE_LIMIT` on a public handler removes the only quantitative protection that endpoint has.

## Checklist for a new route

1. Pick the policy by **what the route does**, not by which controller it lives in: authoring content → `MediaPolicy`/`LayerPolicy`; changing site config, credentials, or anything that signs tokens → `SettingsPolicy`.
2. Never register a route outside a `withPolicy()` group unless it authenticates some other way, and document that mechanism inline.
3. If it must be reachable by logged-out visitors, it belongs on the **AJAX surface** with a nonce and a rate limit, not on REST.
4. Verify what you shipped:

```bash
grep -rnE "withPolicy\(|\\\$router->(get|post|put|delete)\(" \
  wp-content/plugins/fluent-player/app/Http/Routes/ \
  wp-content/plugins/fluent-player-pro/app/Http/Routes/
```

Any `$router->get|post|put|delete` that is not inside a `withPolicy(...)->group(...)` closure is public.
