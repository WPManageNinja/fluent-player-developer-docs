---
title: "Layer Endpoints"
description: "FluentPlayer REST endpoints for interactive-layer forms and previews."
---

# Layer Endpoints

**Prefix:** `layer` · **Policy:** `LayerPolicy` · **Controller:** `LayerController` · **Source:** `app/Http/Routes/api.php:60`

Fetch forms and render previews for interactive layers (form, shortcode). Authenticated admin requests — see the [REST API overview](/rest-api/).

| Method | Path | Handler | Purpose |
|---|---|---|---|
| `GET` | `/forms/{type}` | `LayerController@getForms` | List available forms of a type for a form layer. |
| `GET` | `/form-preview` | `LayerController@getFormPreview` | Render a preview of a form layer. |
| `GET` | `/shortcode-preview` | `LayerController@getShortcodePreview` | Render a preview of a shortcode layer. |

Read `app/Http/Policies/LayerPolicy.php` for the exact capability. Interactive layers are largely a **Pro** feature.
