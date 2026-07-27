---
title: "Preset Endpoints"
description: "FluentPlayer REST endpoints for reading player presets."
---

# Preset Endpoints

**Prefix:** `presets` · **Policy:** `PresetPolicy` (free reads) / `FluentPlayerPro\App\Http\Policies\PresetPolicy` (Pro writes) · **Controller:** `PresetController` · **Source:** `app/Http/Routes/api.php:27`

Player presets (skins). The free plugin registers the two read routes; **Pro adds three write routes on the same prefix under a stricter policy**, so the capability required on this prefix depends on the HTTP method.

## Endpoints

| Method | Path | Handler | Capability | Edition | Purpose |
|---|---|---|---|---|---|
| `GET` | `/` | `PresetController@get` | `edit_others_posts` | free | List all presets. |
| `GET` | `{slug}` | `PresetController@find` | `edit_others_posts` | free | Fetch a single preset by slug. |
| `POST` | `/` | `PresetController@store` | `manage_options` | **(Pro)** | Create a preset. |
| `PUT` | `{slug}` | `PresetController@update` | `manage_options` | **(Pro)** | Update a preset. |
| `DELETE` | `{slug}` | `PresetController@delete` | `manage_options` | **(Pro)** | Delete a preset. |

::: warning Two different capabilities on one prefix
- **Reads** run under the free `PresetPolicy`, which calls `current_user_can(Helper::authoringCapability())` → `edit_others_posts` (`app/Http/Policies/PresetPolicy.php:21`). Presets are read while authoring media in the block editor, so an Editor can list them.
- **Writes** run under Pro's own `PresetPolicy`, which requires `manage_options` (Pro `app/Http/Policies/PresetPolicy.php:17`). Group declared at Pro `app/Http/Routes/api.php:149`, routes at `:150-152`.

An Editor who can read presets will get a permission error when writing one. Do not infer write access from a successful `GET`.
:::

## Response shapes

::: tip This is the only free group that returns unwrapped responses
Every other free group wraps success in an envelope (`{"media": …}`, `{"settings": …}`, `{"smartcodes": …}`). `PresetController` returns bare values.
:::

### `GET /` — list presets

Returns a **bare JSON array**, not an object. `PresetController.php:11-14`:

```php
return array_values(PresetService::all());
```

```json
[
  { "slug": "modern", "title": "Modern", "settings": {} },
  { "slug": "course", "title": "Course", "settings": {} }
]
```

### `GET {slug}` — fetch one preset

Returns the **bare preset object** — no wrapper key (`PresetController.php:16-23`):

```json
{ "slug": "modern", "title": "Modern", "settings": {} }
```

Unknown slug → `404 {"message": "Preset not found"}` (`:20`).

::: info Pro write responses
`POST /`, `PUT {slug}` and `DELETE {slug}` are implemented in `FluentPlayerPro\App\Http\Controllers\PresetController`. Their payloads and response shapes are Pro-owned and are not documented here — see [Pro REST surface](/rest-api/pro#presets-writes).
:::
