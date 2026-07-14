---
title: "Email Provider Endpoints"
description: "FluentPlayer REST endpoints for email-provider settings and exporting captured emails."
---

# Email Provider Endpoints

**Prefix:** `email-providers` · **Policy:** `SettingsPolicy` (requires `manage_options`) · **Controller:** `EmailProviderController` · **Source:** `app/Http/Routes/api.php:47`

Configure email providers, export the captured-email list, and validate provider fields. Authenticated admin requests — see the [REST API overview](/rest-api/).

| Method | Path | Handler | Purpose |
|---|---|---|---|
| `GET` | `/` | `EmailProviderController@getProvidersSettings` | Fetch provider settings. |
| `POST` | `/` | `EmailProviderController@saveProviderSettings` | Save provider settings. |
| `GET` | `/export-emails` | `EmailProviderController@exportEmails` | Export captured emails. |
| `GET` | `/{provider}/{resource}` | `EmailProviderController@getProviderResource` | Fetch a provider-specific resource (e.g. lists/tags). |
| `POST` | `/{provider}/validate-field/{field}` | `EmailProviderController@validateProviderField` | Validate a single provider field. |

To register a new provider, see [Build a Custom Email Provider](/extending/custom-email-provider).
