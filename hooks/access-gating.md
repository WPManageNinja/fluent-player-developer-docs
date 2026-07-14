---
title: "Access & Gating Hooks"
description: "Filters that control the markup and messages shown when FluentPlayer media is locked or access is denied."
---

# Access & Gating Hooks

These filters let you customize what a viewer sees when a media item is password-protected or access is denied. Each is a **filter** — always `return` the (possibly modified) first argument.

## `fluent_player/media_locked_message`

**Type:** filter · **Source:** `app/Services/MediaRenderer.php:241` (also `:268`)

Filters the message shown for a password-protected media item.

| Arg | Type | Description |
|---|---|---|
| `$message` | `string` | Default message (`This media is password protected.`). |
| `$mediaId` | `int` | The media ID (`0` in the global-settings context). |

```php
add_filter('fluent_player/media_locked_message', function ($message, $mediaId) {
    return 'Enter the password to watch this lesson.';
}, 10, 2);
```

## `fluent_player/media_locked_html`

**Type:** filter · **Source:** `app/Services/MediaRenderer.php:285`

Filters the full HTML rendered in place of a locked media item.

| Arg | Type | Description |
|---|---|---|
| `$html` | `string` | Default locked-state markup. |
| `$mediaId` | `int` | The locked media ID. |

```php
add_filter('fluent_player/media_locked_html', function ($html, $mediaId) {
    return '<div class="my-lock">Members only — please log in.</div>';
}, 10, 2);
```

## `fluent_player/access_denied_message`

**Type:** filter · **Source:** `app/Models/Media.php:327`

Filters the message shown when a viewer is not allowed to access a media item.

| Arg | Type | Description |
|---|---|---|
| `$message` | `string` | Default access-denied message. |
| `$id` | `int` | The media ID. |
| `$post` | `WP_Post` | The media post object. |

```php
add_filter('fluent_player/access_denied_message', function ($message, $id, $post) {
    return 'This video is available to subscribers only.';
}, 10, 3);
```

## `fluent_player/access_denied_html`

**Type:** filter · **Source:** `app/Models/Media.php:335`

Filters the full HTML shown when access is denied.

| Arg | Type | Description |
|---|---|---|
| `$html` | `string` | Default access-denied markup. |
| `$id` | `int` | The media ID. |
| `$post` | `WP_Post` | The media post object. |

```php
add_filter('fluent_player/access_denied_html', function ($html, $id, $post) {
    return '<div class="paywall">Upgrade to watch.</div>';
}, 10, 3);
```
