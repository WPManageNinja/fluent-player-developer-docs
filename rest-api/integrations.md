---
title: "Integration Endpoints"
description: "FluentPlayer REST endpoints for listing and configuring integrations."
---

# Integration Endpoints

**Prefix:** `integrations` · **Policy:** `SettingsPolicy` (requires `manage_options`) · **Controller:** `IntegrationController` · **Source:** `app/Http/Routes/api.php:38`

List available integrations, fetch their field schemas, save settings, and test a connection. Admin-only — `SettingsPolicy` requires `manage_options` (`app/Http/Policies/SettingsPolicy.php:20`). These endpoints hold storage/CDN credentials, which is why they sit on the admin gate rather than the authoring gate.

| Method | Path | Handler | Purpose |
|---|---|---|---|
| `GET` | `/` | `IntegrationController@getIntegrations` | Settings for every registered integration. |
| `GET` | `/fields` | `IntegrationController@getIntegrationFields` | Field schemas for every registered integration. |
| `POST` | `{integration}` | `IntegrationController@saveIntegrationSettings` | Save one integration's settings. |
| `POST` | `{integration}/test-connection` | `IntegrationController@testConnection` | Test connectivity/credentials without saving. |

## `GET /` — all integration settings

Takes no parameters. Iterates every registered integration and returns a map keyed by integration slug, each value being that integration's `getSettingsWithDefaults()` (`app/Http/Controllers/IntegrationController.php:18-35`):

```json
{
  "bunny": { "api_key": "", "library_id": "" },
  "mux": { "token_id": "", "token_secret": "" }
}
```

Note this is **not** wrapped under a `data` or `integrations` key — the map is the response body.

On failure: `400 {"message": "Failed to load integrations"}` (`:32-34`).

## `GET /fields` — all field schemas

Takes no parameters. Returns `IntegrationService::getAllSettingsFields()` — the schema the admin UI renders forms from (`IntegrationController.php:126-134`). Despite the singular wording in older docs, it returns schemas for **all** integrations at once, not one.

On failure: `400 {"message": "Failed to load integration fields"}` (`:131-133`).

## `POST {integration}` — save settings

| Param | In | Required | Notes |
|---|---|---|---|
| `integration` | path | **yes** | Integration slug, run through `sanitize_text_field()` (`:45`). Empty after sanitizing → `400 {"message": "Integration key is required"}` (`:59-61`). |
| `settings` | body | **yes** | Validated as `present\|array` (`:48-50`). Missing or non-array → `422` with the validator's error bag. |

Validation runs **before** the empty-key check, so a request with a bad slug *and* a missing `settings` returns `422`, not `400`.

```json
// 422
{ "message": "Validation failed", "errors": { "settings": ["…"] } }
```

Success (`:72-75`):

```json
{ "message": "Integration settings saved successfully", "settings": { "api_key": "…" } }
```

If `IntegrationService::saveSettings()` returns a `WP_Error`, the response is `400` with that error's message (`:68-70`). Any other exception → `400 {"message": "Failed to save integration settings"}` (`:76-78`).

## `POST {integration}/test-connection` — test credentials

Same parameter contract as save: path `integration` plus a `present|array` `settings` body (`IntegrationController.php:87-106`). The credentials in `settings` are the ones tested — **nothing is persisted**, so this can be called against unsaved form values.

Success (`:115`):

```json
{ "message": "Connection test successful" }
```

A failed test surfaces the provider's own message: `400 {"message": "<provider error>"}` (`:111-113`). Validation failure → `422`; empty slug → `400 {"message": "Integration key is required"}`; unhandled exception → `400 {"message": "Failed to test integration connection"}` (`:116-118`).

The registered integration set is filterable via `fluent_player/integrations` — see [Extending FluentPlayer](/extending/).
