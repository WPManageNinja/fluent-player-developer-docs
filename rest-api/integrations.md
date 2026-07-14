---
title: "Integration Endpoints"
description: "FluentPlayer REST endpoints for listing and configuring integrations."
---

# Integration Endpoints

**Prefix:** `integrations` · **Policy:** `SettingsPolicy` (requires `manage_options`) · **Controller:** `IntegrationController` · **Source:** `app/Http/Routes/api.php:39`

List available integrations, fetch their field schemas, save settings, and test a connection. Authenticated admin requests — see the [REST API overview](/rest-api/).

| Method | Path | Handler | Purpose |
|---|---|---|---|
| `GET` | `/` | `IntegrationController@getIntegrations` | List integrations. |
| `GET` | `/fields` | `IntegrationController@getIntegrationFields` | Field schema for an integration. |
| `POST` | `{integration}` | `IntegrationController@saveIntegrationSettings` | Save an integration's settings. |
| `POST` | `{integration}/test-connection` | `IntegrationController@testConnection` | Test connectivity/credentials. |

The registered integration set is filterable via `fluent_player/integrations` — see [Extending FluentPlayer](/extending/).
