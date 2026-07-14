---
title: "Unlock & Access Token Hooks"
description: "Filters that tune FluentPlayer's unlock tokens, rate limiting, and which post types are unlockable."
---

# Unlock & Access Token Hooks

FluentPlayer issues short-lived **unlock tokens** to grant access to gated media, with rate limiting to prevent abuse. These filters tune the token lifetime, the rate limits, and which post types can be unlocked. They live in `app/Services/UnlockService.php` and `app/Hooks/Handlers/UnlockHandler.php`.

## `fluent_player/unlock_token_ttl`

**Type:** filter · **Source:** `app/Services/UnlockService.php:22`

Filters the time-to-live (seconds) of an unlock token.

| Arg | Type | Description |
|---|---|---|
| `$ttl` | `int` | Default token TTL. |

```php
add_filter('fluent_player/unlock_token_ttl', fn ($ttl) => 3600); // 1 hour
```

## `fluent_player/unlock_rate_limit`

**Type:** filter · **Source:** `app/Services/UnlockService.php:90`

Filters the maximum unlock attempts allowed within the rate-limit window (default 8).

| Arg | Type | Description |
|---|---|---|
| `$max` | `int` | Maximum attempts. |

```php
add_filter('fluent_player/unlock_rate_limit', fn ($max) => 20);
```

## `fluent_player/unlock_rate_key`

**Type:** filter · **Source:** `app/Services/UnlockService.php:103`

Filters the key (default: client IP) used to bucket unlock rate limiting.

| Arg | Type | Description |
|---|---|---|
| `$ip` | `string` | The rate-limit key (client IP by default). |
| `$id` | `int` | The media ID being unlocked. |

## `fluent_player/unlockable_post_types`

**Type:** filter · **Source:** `app/Hooks/Handlers/UnlockHandler.php:36`

Filters which post types can hold unlockable FluentPlayer media (default: the media CPT).

| Arg | Type | Description |
|---|---|---|
| `$types` | `array` | Unlockable post-type names. |

```php
add_filter('fluent_player/unlockable_post_types', function ($types) {
    $types[] = 'lesson';
    return $types;
});
```
