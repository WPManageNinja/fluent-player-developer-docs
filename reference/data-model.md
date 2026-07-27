---
title: "Data Model"
description: "Where FluentPlayer stores data — custom tables with exact column types, custom post types, taxonomies, meta keys, option keys, and the table rename/drop history."
---

# Data Model

Everything FluentPlayer persists lives in one of four places: **two custom tables**, **two custom post types**, **post meta**, and **options**. If you are writing a report, an export, a migration, or a GDPR-erasure handler, this is the complete surface.

::: warning Verify against your installed version
Table schemas migrate on activation and on a version-gated runner. Column types below are read from the migrator source in **1.3.0**. Older installs may lag — see [Migration history](#migration-history).
:::

## Custom tables

### `{prefix}flp_email_collections` (free)

Created by `database/Migrations/EmailCollectionsMigrator.php:17-31`. Every email captured by an email-gate or opt-in layer lands here.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `bigint(20) unsigned` | no | `AUTO_INCREMENT` primary key |
| `email` | `varchar(255)` | no | — |
| `media_id` | `bigint(20) unsigned` | yes | — |
| `preset_slug` | `varchar(255)` | yes | — |
| `layer_id` | `bigint(20) unsigned` | yes | — |
| `user_id` | `bigint(20) unsigned` | yes | — |
| `video_time` | `float` | yes | `0` |
| `ip_address` | `varchar(100)` | yes | — |
| `device` | `varchar(100)` | yes | — |
| `browser` | `varchar(100)` | yes | — |
| `meta` | `text` | yes | — |
| `created_at` | `timestamp` | — | `CURRENT_TIMESTAMP` |
| `updated_at` | `timestamp` | — | `CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` |

Six indexes are added idempotently by `ensureIndexes()` (`:65-121`) — `email(191)`, `media_id`, `preset_slug(191)`, `created_at`, `(media_id, user_id)`, and `(media_id, email(191))`.

::: danger Two historic column renames
An install created before these ran will still have the old names, and the migrator renames in place:

| Old column | New column | Renamed at |
|---|---|---|
| `provider_log` | `meta` (`text NULL`) | `EmailCollectionsMigrator.php:43` |
| `preset_id` | `preset_slug` (`varchar(255) NULL`) | `:52` |

`preset_id` → `preset_slug` is the one to watch: the column changed **meaning**, not just name. It now holds a preset **slug string**, not a numeric ID — presets stopped being rows (see below).
:::

Model: `app/Models/EmailCollection.php`.

### `{prefix}flp_visits` **(Pro)**

Created by pro `database/Migrations/VisitsMigrator.php:14-33`. One row per recorded watch session.

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `bigint(20) unsigned` | no | `AUTO_INCREMENT` primary key |
| `media_id` | `bigint(20)` | no | — |
| `user_id` | `bigint(20)` | yes | — |
| `ip_address` | `varchar(100)` | yes | — |
| `country` | `varchar(2)` | yes | — (ISO-3166 alpha-2) |
| `device` | `varchar(100)` | yes | — |
| `browser` | `varchar(100)` | yes | — |
| `duration` | `float` | no | `0` |
| `percentage` | `tinyint unsigned` | no | `0` |
| `created_at` | `datetime` | no | — |
| `updated_at` | `datetime` | no | — |

Six indexes: `media_id`, `user_id`, `ip_address`, `created_at`, `(media_id, created_at)`, `(user_id, created_at)` (`:26-31`).

`percentage` is a **later addition** — for an existing table the migrator takes the `else` branch and runs `ALTER TABLE … ADD percentage tinyint unsigned DEFAULT 0 NOT NULL AFTER duration` (`:36-39`), then backfills the four newer indexes (`:41-56`). Do not assume the column exists on an install that has not run the migrator.

Table ownership moved from free to **Pro**; free never creates it.

### `{prefix}flp_play_resumes` — **dropped**

::: danger This table no longer exists
`database/DBMigrator.php:63-67` unconditionally runs `DROP TABLE IF EXISTS` against **both** `{prefix}fluent_player_play_resumes` and `{prefix}flp_play_resumes` on every migration pass. Resume state moved to browser storage and post meta.

Third-party code that still reads it will get a SQL error, not an empty result.

Because the drop is unconditional and re-runs, re-creating the table is not a viable workaround — it will be dropped again on the next migration pass.
:::

**There is no schema for this table in either tree.** The only occurrence of the name in the 1.3.0 source is the `DROP TABLE IF EXISTS` above. If you maintain code that reads the table, the column definitions can only be recovered from git history: the file was `database/Migrations/fluent_player_play_resumes.sql` in the free repo, and it was deleted in commit **`e43754dc`** ("Refactor DB migration system: rename tables and split free/pro ownership", 20 February 2026). Read it with:

```bash
git show e43754dc^:database/Migrations/fluent_player_play_resumes.sql
```

That file held a bare column list (no `CREATE TABLE` wrapper — WPFluent's migrator supplied it): `id`, `media_id`, `user_id`, `ip_address`, `device`, `position`, `source_url`, `browser`, `created_at`, `updated_at`. Treat it as historical evidence, not a supported contract — nothing in the shipped plugin will recreate or honour it.

A related one-time cleanup, `ResumePlaybackResetMigrator` (`database/Migrations/ResumePlaybackResetMigrator.php:16-26`), strips `save_play_position` from the reserved presets and from every media's `settings` meta, so media inherit the preset/global value instead of carrying a stale flat copy. It is guarded by the `fluent_player_resume_reset_done` option.

### `{prefix}flp_presets` — **migrated into an option**

Presets were once a table. The migration is two-stage:

1. `DBMigrator::maybeRenameTables()` renames `{prefix}fluent_player_presets` → `{prefix}flp_presets` if the old table exists and the new one does not (`DBMigrator.php:43`, `:57-60`).
2. `DBMigrator::migratePresetsToOptions()` (`:70-75`) calls `PresetService::maybeMigrateFromTable()`, then `maybeCreateDefaults()` and `syncBuiltInControls()`.

Presets now live in the **`fluent_player_presets` option** as a JSON string keyed by slug (`app/Services/PresetService.php:13`, read at `:21`, written at `:139`). The table is left in place after migration but is no longer read.

Reserved slugs — `default`, `course`, `simple`, `minimal`, `standard`, `floating`, `ambient` — are declared at `PresetService.php:14`.

## Custom post types

### `fluent_player_media` (free)

Registered at `app/Hooks/Handlers/FluentPlayerMediaCPT.php:48`. Slug constant at `:16`; the **URL** slug (`fluent-player-media`) is a separate value at `:22`.

| Argument | Value |
|---|---|
| `public` | `true` |
| `publicly_queryable` | `true` |
| `exclude_from_search` | `!isDiscoverable()` — i.e. **excluded by default** |
| `show_in_rest` | `true` |
| `show_ui` | `true` |
| `show_in_menu` | `false` |
| `supports` | `['title', 'editor', 'custom-fields']` |
| `has_archive` | `false` |
| `template` | `[['fluent-player/media']]` |
| `template_lock` | `'all'` |
| `capability_type` | `'post'` |
| `hierarchical` | `false` |
| `rewrite` | `['slug' => 'fluent-player-media', 'with_front' => false]` |

::: tip `template_lock: 'all'` is why you cannot add blocks to a media post
The post body is locked to exactly one `fluent-player/media` block. Timed-content children go *inside* it (they declare `parent: ['fluent-player/media']`), which is the only way to add content. See [Blocks](/reference/blocks).
:::

**Discoverability is off by default.** `isDiscoverable()` (`:104-108`) returns `apply_filters('fluent_player/media_discoverable', false)`. While false, dedicated media pages are excluded from search, `noindex`/`nofollow`ed (`:113-129`), and dropped from the WP sitemap plus Yoast and Rank Math sitemaps (`:131-148`).

Two custom rewrite rules are registered by `addRewriteRules()` (`:151-166`), both `top` priority:

| Rule | Pattern | Resolves to |
|---|---|---|
| Fallback (untitled posts) | `fluent-player-media/media-([0-9]+)/?$` (`:154`) | `post_type=fluent_player_media&p=$1` |
| Primary (slug-based) | `fluent-player-media/([^/]+)/?$` (`:160`) | `post_type=fluent_player_media&name=$1` |

`customizePermalink()` (`:171-181`) mirrors the same choice: a valid non-numeric `post_name` yields `/fluent-player-media/{slug}/`, otherwise `/fluent-player-media/media-{ID}/`.

### `fluent_playlist` **(Pro)**

Registered at pro `app/Hooks/Handlers/FluentPlaylistCPT.php:57`. Post-type slug at `:17`, URL slug `fluent-playlist` at `:23`. Two matching rewrite rules at `:116` (`fluent-playlist/playlist-([0-9]+)/?$`) and `:122` (`fluent-playlist/([^/]+)/?$`).

Free is aware of this CPT even without Pro: `app/Hooks/actions.php` redirects `edit.php?post_type=fluent_playlist` and `post-new.php?post_type=fluent_playlist` into the admin SPA.

## Taxonomy

### `flp_media_tag` **(Pro)**

Registered by pro `app/Services/TagService.php:11` against `fluent_player_media`:

| Argument | Value |
|---|---|
| `public` | `false` |
| `show_ui` | `false` |
| `show_in_rest` | `false` |
| `hierarchical` | `false` |
| `rewrite` | `false` |

::: tip This is a free → Pro contract point
Free fires **`fluent_player/register_media_taxonomies`** (an action, 0 args) at `app/Hooks/Handlers/FluentPlayerMediaCPT.php:75` — immediately after `register_post_type()` — for no reason other than to give Pro a correct moment to register this taxonomy. Pro binds it at pro `app/Hooks/actions.php:35`. If you register a taxonomy on `fluent_player_media`, this is the hook to use: it runs inside the CPT registration, before `init` completes.
:::

Tags are synced on save via `fluent_player/after_save_media` → `TagService::onSaveMedia` (pro `app/Hooks/actions.php:36`).

## Post meta keys

| Key | On | Edition | Holds |
|---|---|---|---|
| `settings` | `fluent_player_media` posts | Free | **The main settings blob** — an array covering `src`, `provider`, `posterSrc`, `preset_slug`, `behaviors`, `aspectRatio`, layers, timed-content style, and everything else the player reads. Written by `Media::saveMediaSettings()` (`app/Models/Media.php:112`), read by `Media::getMediaSettings()` (`:222`). Not underscore-prefixed, so it is visible in the Custom Fields UI. |
| `_flp_mux_asset_id` | `fluent_player_media` posts | **(Pro)** | The Mux asset ID for a media backed by Mux. Written at pro `app/Services/MuxService.php:1091` and `:1150`; used as a `meta_key` lookup at `:1255`. |
| `_fluent_player_generated_storyboard_asset_dir` | WP **attachment** posts | **(Pro)** writes, free reads | Sanitized directory name of a generated storyboard's assets. Constant at pro `app/Services/SubtitleService.php:29`; read by free `app/Http/Controllers/MediaController.php:669`. |
| `_fluent_player_generated_storyboard_media_id` | WP **attachment** posts | **(Pro)** writes, free reads | The media post that owns the generated storyboard. Constant at pro `SubtitleService.php:28`; read by free `MediaController.php:704`. |
| `_fp_migration_original_blocks` | Any post migrated from Presto Player | Free | The post's original block markup, saved so a migration can be reverted. Written at `app/Services/Migrations/PrestoPlayer/ContentReverter.php:336`, read at `:334` and `:348`, deleted after a successful revert at `:117`. |

::: warning `settings` was double-serialized before 1.0.2
`Media::getMediaSettings()` still carries the compatibility path: if the meta comes back as a string it runs `maybe_unserialize()`, and if the result is still not an array it tries `json_decode()` (`app/Models/Media.php:222-235`). Read through the model, not `get_post_meta()` directly, or you will hit rows in either legacy shape.
:::

## Option keys

### Free

| Option | Written by | Purpose |
|---|---|---|
| `fluent_player_settings` | `app/Services/SettingsService.php:16` (`SETTINGS_KEY`), `:226` | The global settings array. **Every settings filter reads and writes this.** |
| `fluent_player_presets` | `app/Services/PresetService.php:13` (`OPTION_KEY`), `:139` | All presets, JSON-encoded, keyed by slug. Autoloaded (`true`). |
| `fluent_player_db_version` | `app/Hooks/Handlers/ActivationHandler.php:58` | Gates the migration runner (`boot/app.php:37`). `false` means fresh install (`:55`). Not autoloaded. |
| `fluent_player_access_key_version` | `app/Services/UnlockService.php:157` | Bumping it invalidates every issued unlock token. |
| `fluent_player_duration_backfilled` | `database/Migrations/DurationBackfillMigrator.php:37`, `:81` | One-shot guard for the duration backfill. |
| `fluent_player_resume_reset_done` | `database/Migrations/ResumePlaybackResetMigrator.php:25` | One-shot guard for the resume-playback reset. |
| `fluent_player_rewrite_rules_added` | `app/Hooks/Handlers/FluentPlayerMediaCPT.php:165`, `app/Hooks/Handlers/CPTHandler.php:55` | Set once the CPT rewrite rules have been registered. |
| `fluent_player_rewrite_version` | `app/Hooks/Handlers/CPTHandler.php:54` | Compared against the current version at `:39` to decide whether to re-flush. |
| `fluent_player_force_flush_rules` | `app/Hooks/Handlers/CPTHandler.php:30` | Transient-style flag; deleted after the flush at `:56`. |

### Pro

| Option | Written by | Purpose |
|---|---|---|
| `fluent_player_email_providers` | read at pro `app/EmailProviders/WebhookProvider.php:350`, `app/Utils/Provider/Mailchimp.php:31` | Per-provider email-integration settings. |
| `fluent_player_pro_db_version` | pro `boot/app.php:56` | Gates the Pro migration runner (`:53`). Not autoloaded. |
| `flp_stream_secret` | pro `app/Services/BunnyCDNStorageService.php:141` | HMAC secret for signing Bunny Storage stream tokens. Not autoloaded. **Treat as a credential.** |
| `flp_visits_schema_version` | pro `app/Hooks/Handlers/AnalyticsHandler.php:53` | Gates the `flp_visits` schema check (`:50`). Autoloaded. |
| `fluent_player_pro_rewrite_version` | pro `app/Hooks/Handlers/CPTHandler.php:47` | Playlist CPT rewrite version. |
| `fluent_player_pro_rewrite_schema` | pro `app/Hooks/Handlers/CPTHandler.php:48` | Playlist CPT rewrite schema revision. |
| `fluent_player_pro_rewrite_rules_added` | pro `app/Hooks/Handlers/CPTHandler.php:49` | Set once playlist rewrite rules have been registered. |

### Reading and filtering global settings

`fluent_player_settings` is the option behind the whole settings surface. Reading one section runs a **dynamic filter**:

**`fluent_player/settings_section/{$section}`** — filter · `app/Services/SettingsService.php:141` · 2 args

| Arg | Type | Description |
|---|---|---|
| `$sectionSettings` | `array` | The requested section's settings. |
| `$settings` | `array` | The full settings array. |

```php
add_filter('fluent_player/settings_section/analytics', function ($section, $all) {
    $section['enabled'] = false; // force analytics off for this site
    return $section;
}, 10, 2);
```

Because the hook name interpolates, a plain grep for the literal string finds only the un-interpolated dispatch site — you register the **resolved** name. See the [hooks reference](/hooks/reference#bootstrap-admin).

#### The sections that exist

`$section` is a top-level key of the `fluent_player_settings` array. `getSection()` falls back to `self::$defaults` when the saved option has no such key (`SettingsService.php:139`), so the seven keys declared at `SettingsService.php:24-65` are the complete set of sections that resolve to real data:

| `$section` | Resolved hook | Holds |
|---|---|---|
| `general` | `fluent_player/settings_section/general` | `default_aspect_ratio`, `default_preset`, `resume_playback`, `custom_css` |
| `youtube` | `…/youtube` | `privacy_mode`, `show_subscribe_button` |
| `performance` | `…/performance` | *(empty by default — legacy keys are stripped on read)* |
| `analytics` | `…/analytics` | `enabled`, `auto_cleanup.{enabled,days}` — consumed only with Pro |
| `google_analytics` | `…/google_analytics` | `enabled`, `use_existing_tag`, `measurement_id` |
| `branding` | `…/branding` | `brand_color`, `control_bar_color`, `play_button_color`, `play_button_bg_color`, `logo_url`, `logo_link`, `logo_position`, `logo_width`, `show_powered_by` |
| `subtitle_service` | `…/subtitle_service` | `enabled`, `service_url`, `api_token`, `timeout_seconds` |

::: warning Only one of these actually fires today
`SettingsService::getSection()` has exactly **one** production caller across both trees: `fluent-player-pro/app/Services/SubtitleService.php:73`, which requests `subtitle_service`. (The only other callers are the plugin's own tests.) Everything else reads the settings array directly via `SettingsService::getSettings()` (`:71`) or `SettingsService::get()` (`:355`) and never passes through the dynamic filter.

So `fluent_player/settings_section/subtitle_service` is the only variant with a live dispatch site — and Pro itself hooks it (`fluent-player-pro/app/Hooks/filters.php:157-158`). Registering `…/branding` or `…/analytics` will run without error and simply never fire. To change those values, filter at the specific consumer, or write them with `SettingsService::updateSection()` (`:193`).
:::

## Migration history

`database/DBMigrator.php` is the single entry point. `run()` (`:14-26`) loops multisite blogs when activated network-wide, then `migrate()` (`:28-36`) executes, in order:

1. `maybeRenameTables()` (`:38-68`)
2. `migratePresetsToOptions()` (`:70-75`)
3. `EmailCollectionsMigrator::migrate()`
4. `DurationBackfillMigrator::migrate()`
5. `ResumePlaybackResetMigrator::migrate()`

Rename map (`:42-46`) — each only fires when the old table exists and the new one does not (`:57-60`):

| Old table | New table |
|---|---|
| `{prefix}fluent_player_presets` | `{prefix}flp_presets` |
| `{prefix}fluent_player_email_collections` | `{prefix}flp_email_collections` |
| `{prefix}fluent_player_visits` | `{prefix}flp_visits` |

Then the unconditional drop of `{prefix}fluent_player_play_resumes` and `{prefix}flp_play_resumes` (`:63-67`).

The whole runner is **version-gated** by `fluent_player_db_version` (free `boot/app.php:37`) and `fluent_player_pro_db_version` (pro `boot/app.php:53`), so it does not re-check the schema on every request. If you need to force it, delete the relevant option and reload.

## Conventions

- **IDs are WordPress post IDs.** Media and playlists are custom post types, so `media_id` and `playlist_id` are `wp_posts.ID` values — join against `wp_posts`, not a plugin table.
- **Timestamps.** `flp_email_collections` uses `timestamp` with MySQL-managed defaults; `flp_visits` uses `datetime` written by PHP. Do not assume they are comparable without normalizing.
- **The REST base is `/wp-json/fluent-player/v2/`** — `config/app.php:10-11`. See the [REST API](/rest-api/).
