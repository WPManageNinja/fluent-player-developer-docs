---
title: "Dynamic Media Source Hooks"
description: "Filters for resolving a FluentPlayer media source at render time from a URL, post meta, or override."
---

# Dynamic Media Source Hooks

A **dynamic source** is resolved when the player renders, rather than being a fixed stored value. These filters let you override the resolved source or change which post its meta is read from. They power the dynamic shortcode documented in the [user docs](https://docs.fluentplayer.com/shortcode).

## `fluent_player/dynamic_source_overrides`

**Type:** filter · **Source:** `app/Services/DynamicMediaSourceResolver.php:194`

Filters the resolved source overrides (URL, provider, poster) before they are applied.

| Arg | Type | Description |
|---|---|---|
| `$overrides` | `array` | The resolved override set (e.g. `url`, `provider`, `poster`). |
| `$url` | `string` | The raw URL value being resolved. |
| `$sourceUrl` | `string` | The configured source URL, if any. |
| `$sourceMeta` | `string` | The post-meta key the source is read from, if any. |
| `$sourcePoster` | `string` | The configured poster source, if any. |

```php
add_filter('fluent_player/dynamic_source_overrides', function ($overrides, $url, $sourceUrl, $sourceMeta, $sourcePoster) {
    if (empty($overrides['poster'])) {
        $overrides['poster'] = 'https://example.com/fallback-poster.webp';
    }
    return $overrides;
}, 10, 5);
```

## `fluent_player/dynamic_source_post_id`

**Type:** filter · **Source:** `app/Services/DynamicMediaSourceResolver.php:217`

Changes which post a `meta_key` source is read from. Defaults to the current post.

| Arg | Type | Description |
|---|---|---|
| `$postId` | `int` | The post ID the source meta is read from. |
| `$sourceMeta` | `string` | The meta key being resolved. |

```php
add_filter('fluent_player/dynamic_source_post_id', function ($postId, $sourceMeta) {
    // read the source from a linked "lesson" post instead of the current one
    return (int) get_post_meta($postId, 'linked_lesson_id', true) ?: $postId;
}, 10, 2);
```

## Related

- `fluent_player/dynamic_source_meta_key_allowed` — allow-list a meta key for dynamic resolution.
- `fluent_player/external_tracked_media` — register externally hosted media for analytics tracking.
