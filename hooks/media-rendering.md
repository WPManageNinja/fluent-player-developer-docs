---
title: "Media Rendering Hooks"
description: "Filters that shape how FluentPlayer builds and outputs the player block — variables, default settings, and final markup."
---

# Media Rendering Hooks

These filters run while FluentPlayer builds the player: the JS variables passed to the frontend, the resolved default settings, and the final block output. All are **filters** — always `return` the first argument.

## `fluent_player/block_media_output`

**Type:** filter · **Source:** `app/Blocks/MediaBlock.php:285`

Filters the final rendered HTML of a media block.

| Arg | Type | Description |
|---|---|---|
| `$output` | `string` | The rendered player markup. |
| `$attributes` | `array` | The block attributes. |
| `$media_id` | `int` | The media ID. |

```php
add_filter('fluent_player/block_media_output', function ($output, $attributes, $media_id) {
    return $output . '<div class="after-player" data-media="' . $media_id . '"></div>';
}, 10, 3);
```

## `fluent_player/media_block_vars`

**Type:** filter · **Source:** `app/Blocks/MediaBlock.php:211`

Filters the variables handed to the frontend player script for a block.

| Arg | Type | Description |
|---|---|---|
| `$mediaBlockVars` | `array` | The variables localized to the player JS. |
| `$defaultSettings` | `array` | The resolved default settings for this media. |

```php
add_filter('fluent_player/media_block_vars', function ($vars, $defaultSettings) {
    $vars['myFlag'] = true;
    return $vars;
}, 10, 2);
```

## `fluent_player/media_default_settings`

**Type:** filter · **Source:** `app/Services/SettingsService.php:466`

Filters the resolved default settings for a media item (global merged with per-media).

| Arg | Type | Description |
|---|---|---|
| `$defaultSettings` | `array` | The merged settings about to apply. |
| `$mediaSettings` | `array` | Per-media settings. |
| `$globalSettings` | `array` | Global settings. |

```php
add_filter('fluent_player/media_default_settings', function ($settings, $mediaSettings, $globalSettings) {
    $settings['autoplay'] = false; // force autoplay off everywhere
    return $settings;
}, 10, 3);
```

## `fluent_player/default_preload`

**Type:** filter · **Source:** `app/Services/SettingsService.php:481`

Filters the `preload` strategy applied to the player.

| Arg | Type | Description |
|---|---|---|
| `$defaultPreload` | `string` | The default preload value (`none` / `metadata` / `auto`). |
| `$mediaSettings` | `array` | Per-media settings. |
| `$globalSettings` | `array` | Global settings. |

```php
add_filter('fluent_player/default_preload', fn ($v, $m, $g) => 'metadata', 10, 3);
```

## Other media-rendering filters

Verified names, types, and arg counts (see the [full reference](/hooks/reference) for source lines; read the call site to name the args):

| Filter | Callback args |
|---|---|
| `fluent_player/block_media_attributes` | 2 |
| `fluent_player/media_block_inner` | 4 |
| `fluent_player/pre_render_block_media` | 3 |
| `fluent_player/should_register_media_block` | 1 |
| `fluent_player/allowed_media_providers` | 1 |
| `fluent_player/audio_extensions` | 1 |
| `fluent_player/allowed_html_tags` | 1 |
| `fluent_player/link_new_tab` | 1 |
| `fluent_player/media_bulk_action` | 4 |
| `fluent_player/media_paginate_query` | 2 |
| `fluent_player/before_render_media` *(action)* | 1 |
