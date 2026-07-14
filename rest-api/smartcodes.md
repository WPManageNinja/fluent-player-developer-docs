---
title: "Smartcode Endpoints"
description: "FluentPlayer REST endpoint for available smartcodes."
---

# Smartcode Endpoints

**Prefix:** `smartcodes` · **Policy:** `SettingsPolicy` (requires `manage_options`) · **Controller:** `SmartcodeController` · **Source:** `app/Http/Routes/api.php:68`

| Method | Path | Handler | Purpose |
|---|---|---|---|
| `GET` | `/` | `SmartcodeController@get` | List available smartcode groups and codes. |

Authenticated admin request — see the [REST API overview](/rest-api/). The registered smartcode set is filterable via `fluent_player/smartcodes` and `fluent_player/smartcode_groups` — see the [full hooks reference](/hooks/reference).
