---
title: "Settings Endpoints"
description: "FluentPlayer REST endpoints for reading and writing global settings."
---

# Settings Endpoints

**Prefix:** `settings` · **Policy:** `SettingsPolicy` (requires `manage_options`) · **Controller:** `SettingsController` · **Source:** `app/Http/Routes/api.php:32`

Read and write the global settings payload. This is a site-configuration surface, so it is genuinely admin-only — `SettingsPolicy` requires `manage_options` (`app/Http/Policies/SettingsPolicy.php:20`). See the [REST API overview](/rest-api/).

| Method | Path | Handler | Purpose |
|---|---|---|---|
| `GET` | `/` | `SettingsController@get` | Fetch the settings payload. |
| `PUT` | `/` | `SettingsController@update` | Update settings. |
| `POST` | `/reset` | `SettingsController@reset` | Reset settings to defaults. |

## Settings sections

`SettingsService::getSettings()` (`app/Services/SettingsService.php:71-122`) merges the saved option `fluent_player_settings` over the shipped defaults with `array_replace_recursive()`, so **every default section is always present** in the response. The defaults are declared at `app/Services/SettingsService.php:24-65`:

| Section key | Contains |
|---|---|
| `general` | `default_aspect_ratio`, `default_preset`, `resume_playback`, `custom_css` |
| `youtube` | `privacy_mode`, `show_subscribe_button` |
| `performance` | (empty by default) |
| `analytics` | `enabled`, `auto_cleanup.enabled`, `auto_cleanup.days` |
| `google_analytics` | `enabled`, `use_existing_tag`, `measurement_id` |
| `branding` | `brand_color`, `control_bar_color`, `play_button_color`, `play_button_bg_color`, `logo_url`, `logo_link`, `logo_position`, `logo_width`, `show_powered_by` |
| `subtitle_service` | `enabled`, `service_url`, `api_token`, `timeout_seconds` |

There is **no `storage` section** — CDN/storage credentials live under [Integrations](/rest-api/integrations), not here.

Three legacy keys are stripped on read, so they never appear in the response even if an older install still stores them (`SettingsService.php:96-117`):

- `general.custom_js` — feature removed
- `general.brand_color` — superseded by `branding.brand_color`
- `performance.dynamic_load_js` — feature removed
- the top-level `email_capture` and `presets` sections — superseded by per-preset `email_capture` and the separate `fluent_player_presets` option

One legacy value is *migrated* rather than stripped: an empty `general.default_preset` falls back to `presets.default_preset` before the `presets` section is dropped (`:87-94`).

## Request/response shapes

### `GET /` — fetch settings

```json
{
  "settings": {
    "general": { "default_aspect_ratio": "original", "default_preset": "course", "resume_playback": false, "custom_css": "" },
    "youtube": { "privacy_mode": false, "show_subscribe_button": false },
    "performance": {},
    "analytics": { "enabled": false, "auto_cleanup": { "enabled": true, "days": 30 } },
    "google_analytics": { "enabled": false, "use_existing_tag": true, "measurement_id": "" },
    "branding": { "brand_color": "#DD1F13", "logo_position": "top-right", "logo_width": 24, "show_powered_by": false },
    "subtitle_service": { "enabled": false, "service_url": "", "api_token": "", "timeout_seconds": 45 }
  }
}
```

On failure: `400 {"message": "Failed to load settings. Please try again."}` (`SettingsController.php:23-27`).

### `PUT /` — update settings

Send the settings object under a `settings` key. The controller reads `$request->get('settings', [])`, saves via `SettingsService::saveSettings()`, and returns the persisted result (`SettingsController.php:37-54`).

```json
// request body
{ "settings": { "general": { "default_preset": "modern" } } }

// response
{ "message": "Settings updated successfully", "settings": { "general": { "default_preset": "modern" } } }
```

On failure: `400 {"message": "Failed to update settings. Please try again."}` (`:49-53`).

### `POST /reset` — reset to defaults

Calls `SettingsService::resetSettings()` and returns the reset payload (`SettingsController.php:60-74`):

```json
{ "message": "Settings have been reset to defaults", "settings": { } }
```

On failure: `400 {"message": "Failed to reset settings. Please try again."}` (`:69-73`).

::: tip
Individual sections are filterable server-side via `fluent_player/settings_section/{$section}` (`app/Services/SettingsService.php:141`). Pro uses it for `subtitle_service` (`fluent-player-pro/app/Hooks/filters.php:157-158`). See the [full hooks reference](/hooks/reference).
:::
