---
name: fluentplayer-rest-reference
description: Specialist template for FluentPlayer REST API reference pages under rest-api/ in the developer docs. Use when documenting the plugin's WPFluent REST routes (media, presets, settings, integrations, email-providers, youtube, layer, smartcodes, migration). Produces verified endpoint entries with method, path, required policy/capability, params, and a sample response. Always pair with fluentplayer-dev-doc-writer and load DEV-SURFACE.md.
---

# FluentPlayer REST API Reference Template

FluentPlayer's REST API is the **WPFluent router** in `app/Http/Routes/{api,routes}.php`: ~45 routes across nine `prefix(...)->withPolicy(...)->group(...)` blocks. Each group maps to a controller and a policy (auth gate).

## Page organization

One page per route group (matches `DEV-SURFACE.md` §3):
- `rest-api/index.md` — base namespace, auth model (nonce + policy/capability), request/response conventions, error shape.
- `rest-api/media.md` (`MediaPolicy` → `MediaController`)
- `rest-api/presets.md` (`PresetPolicy` → `PresetController`)
- `rest-api/settings.md` (`SettingsPolicy` → `SettingsController`)
- `rest-api/integrations.md`, `rest-api/email-providers.md`, `rest-api/youtube.md`, `rest-api/smartcodes.md` (all `SettingsPolicy`)
- `rest-api/layers.md` (`LayerPolicy` → `LayerController`)
- `rest-api/migration.md` (`MigrationPolicy` → `MigrationController`)

## Required page structure

```
---
title: "<Group> Endpoints"
description: "<one line>"
---
# <Group> Endpoints

Base: `<wp-json/{namespace}/vN>/<prefix>` · Auth: **<PolicyName>** (requires capability `<cap>`).

<One paragraph: what this group manages.>

## `GET <prefix>`

**Auth:** `<PolicyName>` · **Controller:** `<Controller>@<method>` · **Source:** `app/Http/Routes/api.php:<line>`

<What it returns.>

**Query params**

| Param | Type | Required | Description |
|---|---|---|---|
| `per_page` | int | no | ... |

**Sample response**

​```json
{ "media": [ /* ... */ ], "total": 0 }
​```

## `POST <prefix>`
...
```

### Rules
- **Determine the base namespace from source, don't hard-code a version.** WPFluent registers the REST base; confirm the `wp-json/<slug>/vN` prefix with the extractor before writing it. State it once on `rest-api/index.md`.
- **Every endpoint lists its policy and the capability that policy checks.** Read the policy class in `app/Http/Policies/` to get the real capability — don't write "admin only" generically.
- **Method + path come from the route line** (`$router->get('...')` inside a `prefix(...)` group). Cite `file:line`.
- **Params come from the controller method** — read what it pulls from the request (`$request->get(...)`, validation rules). Don't guess.
- **Auth section on the index page** must cover: the WordPress nonce header (`X-WP-Nonce`) requirement, that these are admin/authenticated routes (not public), and the standard error shape.
- **Mark Pro-only groups/endpoints** (e.g. analytics, playlists live in Pro) and verify.
- Sample responses are **representative and trimmed**, with placeholder IDs — never a real dump with customer data.

## Generating entries (hybrid workflow)
Use the `fluentplayer-dev-code-to-docs` route extractor to list every `prefix + method + path + controller@method + policy` with `file:line`. That gives the correct endpoint set; you then read each controller method to fill params and response, and each policy for the capability.

## Sidebar entry
```js
{ text: 'Media', link: 'rest-api/media' }
```

## Common pitfalls
- **Documenting a route that moved/renamed** — re-extract per release.
- **Wrong or vague capability** — read the policy, name the exact check.
- **Omitting the nonce/auth requirement** — every reader will hit a 401 without it.
- **Pasting an untrimmed real response** — trim and use placeholder IDs.
