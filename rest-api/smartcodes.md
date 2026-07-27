---
title: "Smartcode Endpoints"
description: "FluentPlayer REST endpoint for available smartcodes."
---

# Smartcode Endpoints

**Prefix:** `smartcodes` · **Policy:** `MediaPolicy` (requires `edit_others_posts`) · **Controller:** `SmartcodeController` · **Source:** `app/Http/Routes/api.php:69`

| Method | Path | Handler | Purpose |
|---|---|---|---|
| `GET` | `/` | `SmartcodeController@get` | List the smartcode groups shown in the editor's inserter. |

::: warning This group uses `MediaPolicy`, not `SettingsPolicy`
The route group is registered `withPolicy('MediaPolicy')` (`app/Http/Routes/api.php:69`), so the required capability is **`edit_others_posts`**, not `manage_options`. The source comment at `:66-68` explains why:

> Smartcode API Routes — read-only token list consumed by the block editor's shortcode inserter, so it uses the authoring gate (MediaPolicy), not the admin-only settings gate.

An Editor authoring media in the block editor must be able to open the token picker, so this endpoint sits behind the authoring gate like `media`, `presets` and `layer`.
:::

## Response

`SmartcodeController::get()` (`app/Http/Controllers/SmartcodeController.php:12-42`) returns:

```json
{
  "has_fluentcrm": true,
  "smartcodes": [
    { "key": "user", "title": "User", "shortcodes": { "{{user.first_name}}": "First Name" } },
    { "key": "contact", "title": "Contact", "shortcodes": {} }
  ],
  "install_url": ""
}
```

| Key | Type | Notes |
|---|---|---|
| `has_fluentcrm` | bool | `defined('FLUENTCRM')` (`:16`). |
| `smartcodes` | array | `array_values()` of the UI group list (`:34`). |
| `install_url` | string | **Empty when FluentCRM is present**; otherwise a `plugin-install.php` search URL for FluentCRM (`:35`). |

On any exception: `400 {"message": "Failed to load shortcodes"}` (`:37-41`).

### FluentCRM merge is deliberately partial

When FluentCRM is active and `\FluentCrm\App\Services\Helper` exists, the controller pulls `getGlobalSmartCodes()` and merges **only two groups** — `contact` and `contact_custom_fields` (`:23-27`). CRM's `general` group is excluded on purpose:

> Only contact fields — CRM's "general" group holds the subscription/unsubscribe codes, which we never expose here.
>
> — `SmartcodeController.php:21-22`

## The two filters are not interchangeable

The docs previously listed `fluent_player/smartcodes` and `fluent_player/smartcode_groups` together. They act on different things, and only one of them changes this endpoint's response:

| Filter | Filters | Where | Affects this endpoint? |
|---|---|---|---|
| `fluent_player/smartcodes` | The **core namespace registry** — token definitions plus their resolvers, keyed by namespace | `app/Services/Smartcode/SmartcodeRegistry.php:21` (inside `namespaces()`) | Indirectly. The REST controller never calls it; it reaches the response only because `uiGroups()` derives from `namespaces()`. Registering a namespace here is what makes a token *resolve at render time*. |
| `fluent_player/smartcode_groups` | The **UI group list this endpoint returns**, after the FluentCRM merge | `app/Http/Controllers/SmartcodeController.php:30` | **Yes** — this is the last hook before the response is built. Use it to add, reorder or remove picker groups without touching the parser. |

To add a working token, register it through `fluent_player/smartcodes` (definition + resolver together, so the picker and the parser cannot drift). To change only what the picker shows, use `fluent_player/smartcode_groups`.

See the [full hooks reference](/hooks/reference) and [Smartcode hooks](/hooks/smartcodes).
