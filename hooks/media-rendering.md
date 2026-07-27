---
title: "Media Rendering Hooks"
description: "The hooks that shape how FluentPlayer builds and outputs the player — player settings, global runtime vars, default settings, and final markup."
---

# Media Rendering Hooks

These hooks run while FluentPlayer builds the player: the settings and JS variables passed to the frontend, the resolved defaults, and the final block output.

Most of them are **filters** — always `return` the (possibly modified) first argument. Two on this page are **actions** and must not return anything: `fluent_player/before_render_media` (`app/Services/MediaRenderer.php:175`) and, with Pro active, `fluent_player/before_render_playlist`. Each entry below states its type explicitly; check it before writing the callback.

## `fluent_player/player_settings`

**Type:** filter · **Source:** `app/Services/MediaRenderer.php:191` (also `app/Http/Controllers/MediaController.php:105`, `:367`, `app/Blocks/FluentCommunityMediaBlock.php:796`, and **(Pro)** `fluent-player-pro/app/Hooks/Handlers/PlaylistShortcodeHandler.php:460`)

The widest seam in the render path. It filters the per-media settings array on **every** front-end render, and it runs *before* those settings are handed to `wp_localize_script` — which is exactly why Pro can use it to swap plain source URLs for signed CDN / DRM URLs. If you need to rewrite anything the player JS will see, this is the hook.

| Arg | Type | Description |
|---|---|---|
| `$settings` | `array` | The media's resolved settings array, about to be localized. |

```php
add_filter('fluent_player/player_settings', function ($settings) {
    // Same shape Pro's CDN services use: bail on anything that isn't yours,
    // then rewrite the playback source.
    if (empty($settings['provider']) || 'my_cdn' !== $settings['provider']) {
        return $settings;
    }

    $settings['src'] = myplugin_sign_url($settings['src']);

    return $settings;
}, 10, 1);
```

::: warning One argument, five call sites
The callback receives **one** argument — do not declare a media ID parameter. And because the hook also fires on the two REST read paths and the FluentCommunity embed path, keep the callback cheap and idempotent; it is not a render-only hook.
:::

## `fluent_player/global_vars`

**Type:** filter · **Source:** `app/Services/MediaRenderer.php:339` (also `app/Blocks/FluentCommunityMediaBlock.php:532`)

The only filter over the frontend runtime's **global** JS config object — the settings shared by every player on the page, as opposed to the per-media array filtered by `player_settings`. Use it for site-wide runtime defaults and for anything your own frontend script needs to read off the global object.

| Arg | Type | Description |
|---|---|---|
| `$globalPlayerSettings` | `array` | The global config object about to be localized. |

```php
add_filter('fluent_player/global_vars', function ($globalVars) {
    $globalVars['myAnalyticsEndpoint'] = home_url('/wp-json/myplugin/v1/track');
    return $globalVars;
}, 10, 1);
```

## `fluent_player/block_media_output`

**Type:** filter · **Source:** `app/Blocks/MediaBlock.php:301`

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
| `$defaultPreload` | `string` | The incoming default, always the literal `'metadata'` (`app/Services/SettingsService.php:478`). |
| `$mediaSettings` | `array` | Per-media settings. |
| `$globalSettings` | `array` | Global settings. |

```php
// Stop the browser fetching anything until the viewer presses play.
add_filter('fluent_player/default_preload', fn ($v, $m, $g) => 'none', 10, 3);
```

::: warning Only three values survive
The return value is validated against `['none', 'metadata', 'auto']`; anything else is silently discarded and the default `'metadata'` is used instead (`app/Services/SettingsService.php:483`). There is no warning and no error — a typo just reverts to `metadata`. Note also that returning `'metadata'` is a no-op, since that is already the hardcoded incoming value.
:::

## The locked-media hooks live on another page

`fluent_player/media_locked_message` and `fluent_player/media_locked_html` also fire from `MediaRenderer`, but they belong to the gating surface — see [Access & Gating](/hooks/access-gating). Note in particular that `media_locked_message` is dispatched from **two** call sites with different second arguments (`app/Services/MediaRenderer.php:329` passes a literal `0`; `:359` passes the real `$mediaId`), which is a trap for any callback that branches on the ID. That page documents the guard.

## Other media-rendering hooks

Verified names, types, and arg counts (see the [full reference](/hooks/reference#media-rendering) for source lines; read the call site to name the args):

| Hook | Type | Callback args |
|---|---|---|
| `fluent_player/block_media_attributes` | filter | 2 |
| `fluent_player/media_block_inner` | filter | 4 |
| `fluent_player/pre_render_block_media` | filter | 3 |
| `fluent_player/should_register_media_block` | filter | 1 |
| `fluent_player/allowed_media_providers` | filter | 1 |
| `fluent_player/audio_extensions` | filter | 1 |
| `fluent_player/allowed_html_tags` | filter | 1 |
| `fluent_player/link_new_tab` | filter | 1 |
| `fluent_player/media_bulk_action` | filter | 4 |
| `fluent_player/media_paginate_query` | filter | 2 |
| `fluent_player/before_render_media` | **action** — returns nothing | 1 |
| `fluent_player/before_render_playlist` **(Pro)** | action — returns nothing | 1 |
