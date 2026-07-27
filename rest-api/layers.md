---
title: "Layer Endpoints"
description: "FluentPlayer REST endpoints for interactive-layer forms and previews."
---

# Layer Endpoints

**Prefix:** `layer` · **Policy:** `LayerPolicy` (requires `edit_others_posts`) · **Controller:** `LayerController` · **Source:** `app/Http/Routes/api.php:60`

Fetch forms and render previews for interactive layers (form, shortcode). `LayerPolicy` calls `current_user_can(Helper::authoringCapability())` — `edit_others_posts` by default, filterable via `fluent_player/authoring_capability` (`app/Http/Policies/LayerPolicy.php:21`). The policy comment reads *"Layer authoring (block editor). Editors/Authors, not admin-only."* (`:20`).

| Method | Path | Handler | Purpose |
|---|---|---|---|
| `GET` | `/forms/{type}` | `LayerController@getForms` | List available forms of a type for a form layer. |
| `GET` | `/form-preview` | `LayerController@getFormPreview` | Render a preview of a form layer. |
| `GET` | `/shortcode-preview` | `LayerController@getShortcodePreview` | Render a preview of a shortcode layer. |

::: info Interactive layers are a FREE feature
All three `layer/*` routes, `LayerController`, `LayerPolicy` and `LayerService` ship in the free plugin. **Pro registers zero `layer/*` routes.**

What *is* Pro-only is **timed content** — content scheduled to appear at specific timestamps — which lives on a different prefix entirely: `PUT media/{id}/timed-content` (Pro `app/Http/Routes/api.php:146`, handled by `TimedContentController`). See [Media → Pro extensions](/rest-api/media#pro-extensions-on-the-media-prefix).
:::

## Request parameters

### `GET /forms/{type}`

| Param | In | Required | Notes |
|---|---|---|---|
| `type` | path | **yes** | Form plugin key. Only `fluentforms` is handled today; any other recognised type returns an empty list (`app/Services/LayerService.php`, `getFormsByType()`). |

`LayerService::getFormsByType()` throws when `type` is empty (*"Form type is required"*) or when the corresponding form plugin is not active (*"Form plugin is not active"*). `LayerController::getForms()` catches every exception and returns `400 {"message": "Failed to load forms"}` (`app/Http/Controllers/LayerController.php:24-26`) — the specific reason is **not** surfaced to the client.

Success:

```json
{ "forms": [ { "id": 7, "title": "Newsletter signup" } ] }
```

### `GET /form-preview`

| Param | In | Required | Notes |
|---|---|---|---|
| `type` | query | **yes** | Form plugin key. |
| `form_id` | query | **yes** | Integer form id. |

Both are read at `LayerController.php:40-42` and validated inside `LayerService::getFormsPreview()`, which throws *"Form type and form ID are required"* when either is missing or `0`. The controller converts any failure to `400 {"message": "Failed to load form preview"}` (`:44-46`).

Success:

```json
{ "html": "<form …>", "form_type": "fluentforms", "form_id": "7" }
```

Conversational Fluent Forms render an explanatory notice instead of the form body, since they display in conversational mode on the player.

### `GET /shortcode-preview`

| Param | In | Required | Notes |
|---|---|---|---|
| `shortcode` | query | **yes** | The raw shortcode string to render. |

Read at `LayerController.php:59-60`. Failures return `400 {"message": "Failed to load shortcode preview"}` (`:62-64`).

Success:

```json
{ "html": "<rendered shortcode output>", "shortcode": "[my_shortcode]" }
```
