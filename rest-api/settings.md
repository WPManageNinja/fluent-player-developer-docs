---
title: "Settings Endpoints"
description: "FluentPlayer REST endpoints for reading and writing global settings."
---

# Settings Endpoints

**Prefix:** `settings` · **Policy:** `SettingsPolicy` (requires `manage_options`) · **Controller:** `SettingsController` · **Source:** `app/Http/Routes/api.php:33`

Read and write the global settings payload (general, performance, branding, storage, YouTube, analytics, etc.). Authenticated admin requests — see the [REST API overview](/rest-api/).

| Method | Path | Handler | Purpose |
|---|---|---|---|
| `GET` | `/` | `SettingsController@get` | Fetch the settings payload. |
| `PUT` | `/` | `SettingsController@update` | Update settings. |
| `POST` | `/reset` | `SettingsController@reset` | Reset settings to defaults. |

## Request/response shapes

### `GET /` — fetch settings

```json
{ "settings": { "general": { }, "performance": { }, "branding": { } } }
```

### `PUT /` — update settings

Send the settings object under a `settings` key. The controller reads `$request->get('settings', [])`, saves via `SettingsService::saveSettings()`, and returns the persisted result.

```json
// request body
{ "settings": { "general": { "default_preset": "modern" } } }

// response
{ "message": "Settings updated successfully", "settings": { "general": { "default_preset": "modern" } } }
```

### `POST /reset` — reset to defaults

Resets settings to their shipped defaults and returns the reset payload.

::: tip
Settings sections are individually filterable server-side via `fluent_player/settings_section/{$section}` — see the [full hooks reference](/hooks/reference).
:::
