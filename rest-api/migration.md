---
title: "Migration Endpoints"
description: "FluentPlayer REST endpoints for detecting, scanning, and migrating Presto Player data."
---

# Migration Endpoints

**Prefix:** `migration` · **Policy:** `MigrationPolicy` (requires `manage_options`) · **Controller:** `MigrationController` · **Source:** `app/Http/Routes/api.php:74`

Detect the source, scan it, then migrate each data type into FluentPlayer. Admin-only — `MigrationPolicy` requires `manage_options` (`app/Http/Policies/MigrationPolicy.php:18`).

::: warning This surface is Presto Player specific
There is no generic "migrate from any plugin" mechanism here. Every method on `MigrationController` is documented as Presto Player work (`app/Http/Controllers/MigrationController.php:27`, `:46`, `:67`), every service it uses lives under `app/Services/Migrations/PrestoPlayer/`, and the error strings name the source directly — for example *"Failed to detect Presto Player data."* (`:40`) and *"Failed to scan Presto Player data."* (`:61`).

**There is no source-selection parameter and no registration hook for other sources.** A third party cannot plug a different migration source into these endpoints.
:::

## Detect & scan

| Method | Path | Handler | Purpose |
|---|---|---|---|
| `GET` | `/detect` | `MigrationController@detect` | Detect Presto Player data and report prior migration history. |
| `GET` | `/scan` | `MigrationController@scan` | Scan Presto Player data for a migration preview. |

### `GET /detect`

Takes no parameters. Returns `Scanner::detect()` plus one extra key: `migration_history`, summarised from the stored migration map read out of `Scanner::MAP_OPTION` (`MigrationController.php:34-35`).

`migration_history` is `null` when the map option is empty; otherwise it is an object with `has_history`, `settings`, `presets`, `media`, `playlists`, `visits`, `email_submissions`, `content_rewrite`, `media_map`, `unmapped_media` and `unmapped_presets` (`:369-381`). Because it is derived from the map option rather than recomputed, it tells you what a previous run migrated — not what is left.

On failure: `400 {"message": "Failed to detect Presto Player data."}` (`:38-42`).

### `GET /scan`

| Param | Required | Notes |
|---|---|---|
| `type` | no | Defaults to `all`. Whitelisted to `all`, `youtube`, `self_hosted`, `vimeo`, `audio`, `bunny` (`MigrationController.php:24`). **An invalid value is silently coerced to `all`** — no error is returned (`:54-56`). |
| `search` | no | Free-text filter, passed through `Sanitizer::sanitizeTextField()` (`:52`). |

Returns `Scanner::scan($type, $search)`. On failure: `400 {"message": "Failed to scan Presto Player data."}` (`:59-63`).

## Migrate

| Method | Path | Handler | Pro required | Purpose |
|---|---|---|---|---|
| `POST` | `/presets` | `MigrationController@migratePresets` | **yes** | Migrate presets. |
| `POST` | `/settings` | `MigrationController@migrateSettings` | no | Migrate global settings. |
| `POST` | `/media` | `MigrationController@migrateMedia` | no | Migrate media items (batch). |
| `POST` | `/playlists` | `MigrationController@migratePlaylists` | **yes** | Migrate playlists. |
| `POST` | `/visits` | `MigrationController@migrateVisits` | **yes** | Migrate analytics/visit data (batch). |
| `POST` | `/email-submissions` | `MigrationController@migrateEmailSubmissions` | **yes** | Migrate captured emails (batch). |
| `POST` | `/content-rewrite` | `MigrationController@rewriteContent` | no | Rewrite post content to FluentPlayer embeds. |
| `POST` | `/reset` | `MigrationController@reset` | no | Reset / roll back the migration. |

The four Pro-gated endpoints check `Helper::hasPro()` first and return `403` with a specific message (for example *"Preset migration requires FluentPlayer Pro."*, `:72-76`) before doing any work.

Batch endpoints are capped server-side:

| Endpoint | Params | Caps |
|---|---|---|
| `/presets` | `preset_ids` (array or comma string), `force` (`"1"`) | — |
| `/media` | `post_ids` (array or comma string), `force` (`"1"`) | max **100** ids per call (`:110`); empty → `400 {"message": "No media IDs provided."}` (`:112-116`) |
| `/visits` | `offset`, `limit`, `force` (`"1"`) | `limit` clamped to **100** (`:174`); already-migrated returns a no-op success unless `force` (`:165-171`) |
| `/email-submissions` | `after_id`, `limit` | `limit` clamped to **100** (`:202`) |
| `/content-rewrite` | `post_ids` | max **50** ids per call (`:218`); empty → `400 {"message": "No post IDs provided."}` (`:220-224`) |
| `/reset` | `delete_data` (bool) | — |

`POST /reset` clears the migration map unconditionally. Only when `delete_data` is truthy does it also revert rewritten content, revert migrated settings and delete the imported media, playlists, presets and email submissions (`:240-255`). Its response reports the counts:

```json
{
  "message": "Migration has been reset.",
  "deleted_media": 0,
  "deleted_presets": 0,
  "deleted_playlists": 0,
  "deleted_email_submissions": 0,
  "reverted_posts": 0
}
```

Every migrate endpoint returns `400` with a per-endpoint message on an unhandled exception.

The controller pairs with the migration tooling under `app/Services/Migrations/PrestoPlayer/`.
