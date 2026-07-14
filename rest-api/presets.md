---
title: "Preset Endpoints"
description: "FluentPlayer REST endpoints for reading player presets."
---

# Preset Endpoints

**Prefix:** `presets` · **Policy:** `PresetPolicy` · **Controller:** `PresetController` · **Source:** `app/Http/Routes/api.php:28`

Read-only endpoints for player presets (skins). Authenticated admin requests — see the [REST API overview](/rest-api/).

| Method | Path | Handler | Purpose |
|---|---|---|---|
| `GET` | `/` | `PresetController@get` | List all presets. |
| `GET` | `{slug}` | `PresetController@find` | Fetch a single preset by slug. |

Read `app/Http/Policies/PresetPolicy.php` for the exact capability, and `PresetController` for the response shape.
