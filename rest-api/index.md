---
title: "REST API"
description: "FluentPlayer's WPFluent REST route groups, authentication model, and conventions."
---

# REST API

FluentPlayer's admin REST API is defined with the **WPFluent router** in `app/Http/Routes/api.php` and `routes.php`. Routes are grouped by a URL **prefix**, each guarded by a **policy** (an authorization class) and handled by a controller. These are **authenticated admin endpoints**, not public APIs.

## Authentication

Every route group runs its policy before the controller. In the free build each policy requires the `manage_options` capability (verify per policy in `app/Http/Policies/`). Requests from the admin app carry the standard WordPress REST nonce:

```
X-WP-Nonce: <wp_rest nonce>
```

A request that fails the policy returns a permission error (HTTP 401/403). Read the specific policy class to confirm the exact capability before relying on it.

## Route groups

45 routes across 9 groups:

| Prefix | Policy | Controller | Page |
|---|---|---|---|
| `media` | `MediaPolicy` | `MediaController` | [Media](/rest-api/media) |
| `presets` | `PresetPolicy` | `PresetController` | [Presets](/rest-api/presets) |
| `settings` | `SettingsPolicy` | `SettingsController` | [Settings](/rest-api/settings) |
| `integrations` | `SettingsPolicy` | `IntegrationController` | [Integrations](/rest-api/integrations) |
| `email-providers` | `SettingsPolicy` | `EmailProviderController` | [Email Providers](/rest-api/email-providers) |
| `youtube` | `SettingsPolicy` | `YouTubeController` | [YouTube](/rest-api/youtube) |
| `layer` | `LayerPolicy` | `LayerController` | [Layers](/rest-api/layers) |
| `smartcodes` | `SettingsPolicy` | `SmartcodeController` | [Smartcodes](/rest-api/smartcodes) |
| `migration` | `MigrationPolicy` | `MigrationController` | [Migration](/rest-api/migration) |

Groups using `SettingsPolicy` require `manage_options` (verified in `SettingsPolicy.php`); confirm `MediaPolicy`, `PresetPolicy`, `LayerPolicy`, and `MigrationPolicy` capabilities in their respective classes under `app/Http/Policies/`. To list every route in your installed version:

```bash
grep -rnE "\\\$router->(get|post|put|delete)\(" \
  wp-content/plugins/fluent-player/app/Http/Routes/
```

## Base namespace

The REST base (`wp-json/<namespace>/vN/`) is registered by WPFluent from the plugin slug. Confirm the exact base in your install from the admin app's network requests, or from the plugin's bootstrap — it is intentionally not hard-coded here to avoid drift across versions.

## Conventions

- **IDs** are WordPress post IDs (media are a custom post type).
- **Responses** are JSON; list endpoints typically return the collection plus pagination metadata.
- **Mutations** use `POST` (create), `PUT` (update/restore), `DELETE` (trash/force-delete).
