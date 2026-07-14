---
title: "Architecture"
description: "How the FluentPlayer plugin is structured, and where the developer surface lives."
---

# Architecture

FluentPlayer is a WordPress plugin built on the **WPFluent** framework — a Laravel-style application layer (router, models, request lifecycle) inside WordPress. The frontend player wraps **Vidstack** (with hls.js for HLS streaming); the admin UI is Vue 3; blocks are React (Gutenberg apiVersion 3).

## Directory map

The extension points you care about live in a few predictable places:

```
fluent-player/
├── app/
│   ├── Http/
│   │   ├── Controllers/     # REST controllers (Media, Preset, Settings, Layer, …)
│   │   ├── Policies/        # Auth gate per route group (MediaPolicy, SettingsPolicy, …)
│   │   └── Routes/          # api.php + routes.php — the REST route definitions
│   ├── EmailProviders/      # AbstractEmailProvider + bundled providers (FluentCRMProvider)
│   ├── Integrations/        # AbstractIntegration
│   ├── Services/            # MediaRenderer, DynamicMediaSourceResolver, Progression, Smartcode, …
│   ├── Models/              # Media, EmailCollection
│   ├── Hooks/Handlers/      # Where many actions/filters fire
│   └── Blocks/              # Gutenberg block registration
└── resources/
    ├── js/                  # FluentPlayer.js, LayersManager.js, AnalyticsTracker.js, progression/
    ├── admin/               # Vue 3 admin app
    └── blocks/              # React block sources
```

## The developer surface at a glance

| Surface | Where | Reference |
|---|---|---|
| **Actions** (12) | `do_action('fluent_player/…')` across `app/` | [Actions](/hooks/actions) |
| **Filters** (62) | `apply_filters('fluent_player/…')` across `app/` | [Hooks overview](/hooks/) |
| **REST API** | `app/Http/Routes/{api,routes}.php`, guarded by `app/Http/Policies/` | [REST API](/rest-api/) |
| **Email providers** | `app/EmailProviders/AbstractEmailProvider.php` | [Custom Email Provider](/extending/custom-email-provider) |
| **Dynamic sources** | `app/Services/DynamicMediaSourceResolver.php` | [Dynamic Media Sources](/hooks/dynamic-sources) |
| **Progression** | `app/Services/Progression/*` + `resources/js/progression/*` | [JS API](/js-api/) |

## Free vs Pro

This documentation covers the **free** plugin surface. FluentPlayer Pro is a separate plugin that adds analytics, interactive layers, timed content, playlists, media tags, custom presets, and hosted streaming (Mux, BunnyCDN, HLS) — each contributing its own hooks and routes. Pro-only items are marked **(Pro)**.

## Discovering everything in your installed version

The references here are curated. For the exhaustive list in the exact version you run, grep the plugin:

```bash
grep -rnE "do_action\(\s*['\"]fluent_player/"    wp-content/plugins/fluent-player/app
grep -rnE "apply_filters\(\s*['\"]fluent_player/" wp-content/plugins/fluent-player/app
```
