---
title: "Migration Endpoints"
description: "FluentPlayer REST endpoints for detecting, scanning, and migrating data from another player plugin."
---

# Migration Endpoints

**Prefix:** `migration` · **Policy:** `MigrationPolicy` · **Controller:** `MigrationController` · **Source:** `app/Http/Routes/api.php:73`

Detect a source, scan it, then migrate each data type into FluentPlayer. Authenticated admin requests — see the [REST API overview](/rest-api/).

## Detect & scan

| Method | Path | Handler | Purpose |
|---|---|---|---|
| `GET` | `/detect` | `MigrationController@detect` | Detect a migratable source. |
| `GET` | `/scan` | `MigrationController@scan` | Scan the source for migratable data. |

## Migrate

| Method | Path | Handler | Purpose |
|---|---|---|---|
| `POST` | `/presets` | `MigrationController@migratePresets` | Migrate presets. |
| `POST` | `/settings` | `MigrationController@migrateSettings` | Migrate settings. |
| `POST` | `/media` | `MigrationController@migrateMedia` | Migrate media items. |
| `POST` | `/playlists` | `MigrationController@migratePlaylists` | Migrate playlists. |
| `POST` | `/visits` | `MigrationController@migrateVisits` | Migrate analytics/visit data. |
| `POST` | `/email-submissions` | `MigrationController@migrateEmailSubmissions` | Migrate captured emails. |
| `POST` | `/content-rewrite` | `MigrationController@rewriteContent` | Rewrite post content to FluentPlayer embeds. |
| `POST` | `/reset` | `MigrationController@reset` | Reset/roll back the migration. |

Read `app/Http/Policies/MigrationPolicy.php` for the capability. The controller pairs with the migration tooling under `app/Services/Migrations/`.
