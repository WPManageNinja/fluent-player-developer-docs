---
title: "Dynamic Media Source Hooks"
description: "Filters for resolving a FluentPlayer media source at render time from a URL, post meta, or override."
---

# Dynamic Media Source Hooks

A **dynamic source** is resolved when the player renders, rather than being a fixed stored value. These filters let you override the resolved source, allow-list a protected meta key, or change which post the meta is read from. They power the dynamic shortcode documented in the [user docs](https://docs.fluentplayer.com/shortcode).

Everything on this page lives in `app/Services/DynamicMediaSourceResolver.php`.

## `fluent_player/dynamic_source_overrides`

**Type:** filter · **Source:** `app/Services/DynamicMediaSourceResolver.php:194`

Filters the resolved source overrides before they are applied, at the end of `DynamicMediaSourceResolver::resolve()`.

### The override keys

The array is built at `DynamicMediaSourceResolver.php:185-189` and documented on the `resolve()` docblock at `:166`. It has exactly three keys:

| Key | Type | Description |
|---|---|---|
| `src` | `string` | The playable URL. For YouTube this is the canonicalised `https://www.youtube.com/watch?v=<id>` form (or the `youtube-nocookie.com` host), because `?list=` / `&start_radio=` params hang Vidstack's iframe. |
| `provider` | `string` | Provider detected from the host. |
| `posterSrc` | `string` | Poster image URL — the explicit poster if given, otherwise a YouTube-derived thumbnail. |

::: danger There is no `url` or `poster` key
The keys are **`src`** and **`posterSrc`**. Writing `$overrides['url']` or `$overrides['poster']` sets a key nothing downstream reads, so the override silently does nothing.
:::

| Arg | Type | Description |
|---|---|---|
| `$overrides` | `array` | The resolved override set: `src`, `provider`, `posterSrc`. |
| `$url` | `string` | The raw URL that was resolved (from `sourceUrl`, or read out of post meta). |
| `$sourceUrl` | `string` | The explicit URL from the shortcode/block, if any. |
| `$sourceMeta` | `string` | The post-meta key the source is read from, if any. |
| `$sourcePoster` | `string` | The explicit poster URL, if any. |

```php
add_filter('fluent_player/dynamic_source_overrides', function ($overrides, $url, $sourceUrl, $sourceMeta, $sourcePoster) {
    if (empty($overrides['posterSrc'])) {
        $overrides['posterSrc'] = 'https://example.com/fallback-poster.webp';
    }

    return $overrides;
}, 10, 5);
```

### Return semantics

Listeners **may return `null` to discard the default entirely** (`DynamicMediaSourceResolver.php:191-194`). The caller treats `null` as "no override" and falls back to the media's saved source — so `null` is the way to abandon dynamic resolution, not a way to blank the player.

```php
add_filter('fluent_player/dynamic_source_overrides', function ($overrides, $url) {
    // Refuse anything not on our CDN — fall back to the saved media instead.
    if (strpos($url, 'https://cdn.example.com/') !== 0) {
        return null;
    }

    return $overrides;
}, 10, 2);
```

`resolve()` also returns `null` before ever reaching the filter when the URL is empty or is not `http`/`https` (`:171-173`, via `isPlayableUrl()` at `:230-239`, which requires a parseable host **and** an `http`/`https` scheme). Protocol-relative, `data:` and `file:` URLs are rejected.

## `fluent_player/dynamic_source_meta_key_allowed`

**Type:** filter · **Source:** `app/Services/DynamicMediaSourceResolver.php:211`

The **only** way to read an underscore-prefixed meta key as a dynamic source. WordPress treats leading-underscore keys (`_thumbnail_id`, `_edit_lock`, …) as protected, so `pickUrl()` refuses them unless this filter opts the key in (`:208-213`).

| Arg | Type | Description |
|---|---|---|
| `$allowed` | `bool` | Default `false`. |
| `$sourceMeta` | `string` | The meta key being requested. |

```php
add_filter('fluent_player/dynamic_source_meta_key_allowed', function ($allowed, $sourceMeta) {
    // Opt in one specific protected key — never blanket-allow.
    if ($sourceMeta === '_my_lesson_video_url') {
        return true;
    }

    return $allowed;
}, 10, 2);
```

::: warning Two further constraints apply, filter or not
1. The meta key is rejected outright — before this filter runs — unless it matches `/^[A-Za-z0-9_.:\/\-]+$/` (`:205-207`). Keys with spaces or other punctuation resolve to an empty source.
2. The resolved meta **value** must be scalar (`:223-225`). An array or object value yields an empty source, so serialized/repeater meta will not work directly.
:::

## `fluent_player/dynamic_source_post_id`

**Type:** filter · **Source:** `app/Services/DynamicMediaSourceResolver.php:217`

Changes which post a `meta_key` source is read from. Defaults to the current post (`get_the_ID()`); a falsy result aborts resolution.

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

## `fluent_player/external_tracked_media`

**Type:** filter · **Source:** `app/Services/MediaRenderer.php:335`

::: tip This one is analytics, not source resolution
Despite being grouped here historically, this filter has nothing to do with `DynamicMediaSourceResolver`. It is read once while building the globally-localized player settings (`app/Services/MediaRenderer.php:335`), and the [hook reference](/hooks/reference#analytics-progression) files it under Analytics & progression.
:::

::: danger "External tracked" means the beacon **skips** these media
The name reads like an opt-*in* to tracking. It is the opposite: listing a media ID here **turns FluentPlayer's own analytics beacon off** for that media, because you are declaring that something else already records the watch. The in-source comment is unambiguous (`app/Services/MediaRenderer.php:331-333`):

> Media whose watch analytics are recorded by another flow (e.g. an LMS progression tracker) so the frontend analytics beacon skips them and the same watch is never counted as two visits. LMS-agnostic seam.

Read it as *"tracked externally — hands off"*, not *"track this externally-hosted media"*. It has nothing to do with where the media file is hosted.

So: adding an ID **removes** its plays from FluentPlayer's own analytics. If you add IDs expecting more tracking, you will silently lose their visit rows instead. Only add a media ID when another flow — an LMS progression tracker hooking [`watch_recorded`](/hooks/progression#fluent-player-watch-recorded), or your own beacon — is definitely recording that same watch.
:::

| Arg | Type | Description |
|---|---|---|
| `$mediaIds` | `array` | Default `[]`. Must be a **list of integer media IDs** — the media to exclude from the frontend analytics beacon. |

The return value is coerced at `app/Services/MediaRenderer.php:336`:

```php
array_values(array_unique(array_map('absint', (array) $externalTracked)))
```

so a non-numeric entry (a URL, a slug, an object) collapses to `0` rather than being dropped — and a `0` in the list will not match any media. Return integers.

```php
// Our LMS records these two lessons' watch time itself, so suppress
// FluentPlayer's beacon for them and avoid double-counting.
add_filter('fluent_player/external_tracked_media', function ($mediaIds) {
    $mediaIds[] = 1234;
    $mediaIds[] = 5678;

    return $mediaIds;
});
```
