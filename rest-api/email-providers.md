---
title: "Email Provider Endpoints"
description: "FluentPlayer REST endpoints for email-provider settings and exporting captured emails."
---

# Email Provider Endpoints

**Prefix:** `email-providers` · **Policy:** `SettingsPolicy` (requires `manage_options`) · **Controller:** `EmailProviderController` · **Source:** `app/Http/Routes/api.php:46`

Configure email providers, export the captured-email list, and validate provider fields. Admin-only — `SettingsPolicy` requires `manage_options` (`app/Http/Policies/SettingsPolicy.php:20`).

| Method | Path | Handler | Purpose |
|---|---|---|---|
| `GET` | `/` | `EmailProviderController@getProvidersSettings` | Fetch provider settings + metadata. |
| `POST` | `/` | `EmailProviderController@saveProviderSettings` | Save one provider's settings. |
| `GET` | `/export-emails` | `EmailProviderController@exportEmails` | Export captured emails (optionally as a file download). |
| `GET` | `/{provider}/{resource}` | `EmailProviderController@getProviderResource` | Fetch a provider-specific resource (lists, tags, …). |
| `POST` | `/{provider}/validate-field/{field}` | `EmailProviderController@validateProviderField` | Validate a single provider field. |

The controller calls `EmailProviderService::init()` in its constructor (`app/Http/Controllers/EmailProviderController.php:18-23`), so providers are always registered before any of these run.

## `GET /` — provider settings

Takes no parameters. Returns three keys (`EmailProviderController.php:51-55`):

```json
{
  "providers": { "mailchimp": { "api_key": "" } },
  "providers_meta": { "mailchimp": { "title": "Mailchimp", "logo": "…" } },
  "allowed_attachment_types": ["application/pdf", "image", "video", "…"]
}
```

`allowed_attachment_types` starts from a fixed list (PDF, image, video, Word, Excel) and is passed through the `fluent_player/email_attachment_allowed_types` filter (`:46-49`).

## `POST /` — save provider settings

| Param | In | Required | Notes |
|---|---|---|---|
| `provider` | body | **yes** | Validated `required\|string` (`:69`). Unknown slug → `422 {"message": "Invalid provider"}` (`:84-88`). |
| `settings` | body | **yes** | Validated `required\|array` (`:70`). |

Validation failure → `422 {"message": "Validation failed", "errors": {…}}` (`:73-78`).
Service-level failure (`WP_Error`) → `400` with that error's message (`:92-96`).

Success (`:98-101`):

```json
{ "message": "Settings saved successfully", "settings": { "api_key": "…" } }
```

## `GET /export-emails` — export captured emails

This is a `GET` that can either return JSON metadata **or stream a file download and terminate the request**. Which one you get depends on `download`.

| Param | Required | Notes |
|---|---|---|
| `format` | no | Defaults to `csv`. Validated `nullable\|string\|in:csv,json,ods` (`:114-116`); anything else → `422`. |
| `download` | no | Parsed with `filter_var(…, FILTER_VALIDATE_BOOLEAN)` (`:131`). Falsy → JSON summary. Truthy → binary download. |

**Metadata mode** (`download` falsy) — normal JSON response (`:140-146`):

```json
{ "filename": "fluent-player-emails.csv", "count": 128, "format": "csv" }
```

**Download mode** (`download` truthy) — the controller flushes all output buffers, lifts the time limit, sets `Content-Type`, `Content-Disposition: attachment`, no-cache headers and (for `ods`) `Content-Length`, streams the body, then calls `exit` (`:159-193`). Consequences for clients:

- The response is **not JSON** and has no envelope. Do not parse it as one.
- `ods` is written to a temp file, streamed with `readfile()` and the temp file deleted; `json` and `csv` are streamed directly by `EmailProviderService::streamJsonExport()` / `streamCsvExport()`.
- Because the handler `exit`s, no later filter or shutdown output runs.

Errors before streaming begins still return JSON: `422` on validation failure, `400` when `prepareEmailExport()` or the ODS writer returns a `WP_Error` (`:134-138`, `:152-156`), and `500 {"message": "Failed to export emails"}` on an unhandled exception (`:194-196`).

## `GET /{provider}/{resource}` — provider resource lookup

| Param | In | Required | Notes |
|---|---|---|---|
| `provider` | path | **yes** | Provider slug. |
| `resource` | path | **yes** | Resource name — `lists`, `tags`, and so on, defined by the provider. |
| *(any)* | query | no | The **entire query string** is forwarded to the provider as `$params`. Every string value is sanitized recursively with `sanitize_text_field()` first (`:209-214`). |

Dispatches to `EmailProviderService::handleProviderAction($provider, $resource, $params)` (`:216`). The response is whatever the provider returns, sent through `sendSuccess()` unwrapped (`:224`) — so the shape is provider-defined, typically an array of `{id, name}` options.

Any `WP_Error` from the provider → `422` with that message (`:218-222`). Note this is `422`, not `400`, and an unknown provider or resource surfaces the same way rather than as a `404`.

## `POST /{provider}/validate-field/{field}` — validate one field

| Param | In | Required | Notes |
|---|---|---|---|
| `provider` | path | **yes** | Sanitized with `Sanitizer::sanitizeTextField` (`:238`). Unknown → `422 {"message": "Invalid provider"}` (`:249-254`). |
| `field` | path | **yes** | Sanitized the same way (`:239`). |
| `<field>` | body | **yes** | **The value is read from a body key named after `{field}` itself**, not from a generic `value` key (`:242`). Missing (`null`) → `422 {"message": "Field value is required"}` (`:243-247`). |

For example, validating the `api_key` field of `mailchimp`:

```
POST /wp-json/fluent-player/v2/email-providers/mailchimp/validate-field/api_key
{ "api_key": "abc123-us1" }
```

Delegates to `$providerInstance->validateField($field, $value)` (`:256`). A `WP_Error` → `400` with that message (`:258-262`); otherwise the provider's result is returned unwrapped (`:264`).

To register a new provider, see [Build a Custom Email Provider](/extending/custom-email-provider).
