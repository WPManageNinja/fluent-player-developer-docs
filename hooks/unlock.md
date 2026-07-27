---
title: "Unlock & Access Token Hooks"
description: "Filters that tune FluentPlayer's unlock tokens, rate limiting, and which post types are unlockable."
---

# Unlock & Access Token Hooks

FluentPlayer issues short-lived **unlock tokens** to grant access to gated media, with rate limiting to prevent abuse. These filters tune the token lifetime, the rate limits, and which post types can be unlocked. They live in `app/Services/UnlockService.php` and `app/Hooks/Handlers/UnlockHandler.php`.

`UnlockService` also mints a second, unrelated credential — the **access token** — which has no filters at all but is documented under [Access tokens](#access-tokens) at the end of this page, because everyone who reads this file eventually goes looking for it.

## Two different tokens

They share a class and a signing helper shape, and are otherwise unrelated. Mixing them up is the most common mistake on this surface:

| | **Unlock token** | **Access token** |
|---|---|---|
| Answers | "This visitor typed the right password" | "This media reference came from a page we rendered" |
| Issued by | `UnlockService::issueToken()` (`app/Services/UnlockService.php:34`) | `UnlockService::issueAccessToken()` (`:123`) |
| Signed with | `wp_salt('auth')` **+ the post's `post_password`** (`:108-111`) | `wp_salt('auth')` + `fluent_player_access_key_version` (`:155-159`) |
| Expires | Yes — `exp` claim, `unlock_token_ttl` (`:41`) | **No — deliberately.** See below |
| Delivered as | HttpOnly cookie `fp_unlock_<mediaId>` (`:52-58`) | `access_key` printed into the player markup (`app/Services/MediaRenderer.php:216`) |
| Revoked by | Changing the post password | Bumping the `fluent_player_access_key_version` option |
| Filters | The four on this page | **None** |

## The endpoint these filters run inside

Every filter on this page fires during one request: the **`fluent_player_unlock` AJAX action**, registered for both logged-in and logged-out visitors (`app/Hooks/Handlers/UnlockHandler.php:21-22`).

| | |
|---|---|
| Action | `wp_ajax_fluent_player_unlock` / `wp_ajax_nopriv_fluent_player_unlock` |
| Nonce action | `fluent_player_frontend`, in the `nonce` field (`app/Hooks/Handlers/UnlockHandler.php:29`) — a bad nonce returns `403 bad_nonce` |
| On success | Sets an **HttpOnly, `SameSite=Lax`, per-media cookie** `fp_unlock_<mediaId>` holding the token (`app/Services/UnlockService.php:52-58`). No token or player HTML is returned in the response body. |

See the [AJAX endpoint reference](/rest-api/ajax) for the full request/response contract.

## `fluent_player/unlock_token_ttl`

**Type:** filter · **Source:** `app/Services/UnlockService.php:22`

Filters the time-to-live (seconds) of an unlock token.

| Arg | Type | Description |
|---|---|---|
| `$ttl` | `int` | Default token TTL — `UnlockService::DEFAULT_TTL`, 7200 seconds (2 hours). Cast to `int` by the caller. |

```php
add_filter('fluent_player/unlock_token_ttl', fn ($ttl) => 3600); // 1 hour
```

## `fluent_player/unlock_rate_limit`

**Type:** filter · **Source:** `app/Services/UnlockService.php:90`

Filters the maximum **failed** unlock attempts allowed within the rate-limit window (default 8). The window itself is a fixed `5 * MINUTE_IN_SECONDS` transient TTL and is not filterable (`app/Services/UnlockService.php:97`).

| Arg | Type | Description |
|---|---|---|
| `$max` | `int` | Maximum failed attempts per bucket per window. Default `8`. Cast to `int` by the caller. |

::: tip Only wrong passwords count, and the bucket is per-IP **and** per-media
Two properties that are easy to assume wrongly:

**1. The counter only advances on failure.** `UnlockHandler` calls `UnlockService::bumpRateLimit()` exclusively in the `!verifyPassword()` branch (`app/Hooks/Handlers/UnlockHandler.php:55-56`). A correct password, an unprotected post, an empty-password `400`, and a `404` all return without touching the counter. So this is a brute-force brake, not a request quota — a visitor who types the password correctly can unlock as often as they like.

**2. The bucket is keyed on IP *and* media ID.** `rateKey()` returns `'fp_unlock_' . md5($ip . '|' . (int) $id)` (`app/Services/UnlockService.php:100-105`). Each media gets its own independent counter per IP, so 8 wrong guesses at lesson A do not lock the same visitor out of lesson B. Conversely, an attacker enumerating many media items gets a fresh budget for each one. You cannot remove the per-media split — [`unlock_rate_key`](#fluent-player-unlock-rate-key) replaces only the IP half of the key, and `(int) $id` is always concatenated after it.

The check itself is `>= $max` before the attempt is verified (`:88-92`), so `$max` is the number of failures that fit in the window.
:::

```php
add_filter('fluent_player/unlock_rate_limit', fn ($max) => 20);
```

## `fluent_player/unlock_rate_key`

**Type:** filter · **Source:** `app/Services/UnlockService.php:103`

Filters the **client-identity half** of the rate-limit bucket key (default: `REMOTE_ADDR`).

| Arg | Type | Description |
|---|---|---|
| `$ip` | `string` | The rate-limit key (client IP by default). Cast to `string` by the caller. |
| `$id` | `int` | The media ID being unlocked. |

The final transient key is `'fp_unlock_' . md5($ip . '|' . (int) $id)` (`app/Services/UnlockService.php:100-105`), so whatever you return is still combined with the media ID — this filter changes *who* shares a bucket, never *which media* share one.

Use it when `REMOTE_ADDR` is not a useful identity: behind a proxy or CDN where every request carries the same address, or when you want to bucket by subnet or logged-in user instead.

```php
add_filter('fluent_player/unlock_rate_key', function ($ip, $id) {
    $userId = get_current_user_id();

    return $userId ? 'user:' . $userId : $ip;
}, 10, 2);
```

## `fluent_player/unlockable_post_types`

**Type:** filter · **Source:** `app/Hooks/Handlers/UnlockHandler.php:36`

Filters which post types the unlock endpoint will accept an ID for. A request whose post is not of a listed type is rejected with `404 not_found` (`app/Hooks/Handlers/UnlockHandler.php:38-40`).

| Arg | Type | Description |
|---|---|---|
| `$types` | `array` | Unlockable post-type names. Cast to `array` by the caller. |

**The default is `[Media::$postType]`** — the `fluent_player_media` CPT alone. But **Pro appends `fluent_playlist`** at boot (`fluent-player-pro/app/Hooks/filters.php:164-167`):

```php
$app->addFilter('fluent_player/unlockable_post_types', function ($types) {
    $types[] = 'fluent_playlist';
    return $types;
});
```

So on a Pro site the array you receive already has two entries, and a whole password-protected playlist is unlockable through the same endpoint (that is what backs Pro's playlist gate, whose message comes from `fluent_player/playlist_password_message` — see the [playlist-gate note on Access & Gating](/hooks/access-gating#fluent-player-media-locked-message)). Always append to `$types`; never return a hand-written list, or you will silently break playlist unlocking on Pro.

::: danger There is no capability check — the password is the only gate
Adding a post type here makes **every post of that type** unlockable by anyone who can reach `admin-ajax.php`, logged in or not. The endpoint is registered for `nopriv` (`app/Hooks/Handlers/UnlockHandler.php:21-22`) and the handler runs no `current_user_can()` check at any point — it verifies the nonce, the post type, `post_password_required()`, the rate limit, and then the password itself (`:27-62`).

That is by design for media: the password *is* the authorization. But it means the only thing protecting a post type you add is `post_password_required()` returning `true` for it. Consequences to weigh before adding one:

- A post type whose items mostly have **no** `post_password` is unaffected — `post_password_required()` is false and the handler returns success early (`:42-44`) without checking anything. That success response is itself an existence oracle for the ID.
- Passwords are stored **plaintext** in `post_password` (WordPress's design) and compared with `hash_equals()` (`app/Services/UnlockService.php:25-32`). Do not add a post type whose password doubles as a credential anywhere else.
- A successful unlock sets an HttpOnly cookie scoped to that post ID and nothing more. It grants no capability and does not log the visitor in.

If you need role- or membership-based access rather than a shared password, gate the media with [`fluent_player/can_view_media`](/hooks/access-gating#fluent-player-can-view-media) instead — that is the access-control filter; this one is only a post-type allowlist.
:::

```php
add_filter('fluent_player/unlockable_post_types', function ($types) {
    $types[] = 'lesson'; // append — Pro has already added 'fluent_playlist'
    return $types;
});
```

## Access tokens

The other credential in `UnlockService`. No filter touches this surface; it is documented here because it lives in the same service and is easily confused with the unlock token above.

An **access token** is an unguessable, stateless per-media reference that proves a media ID came from a page FluentPlayer rendered, rather than being guessed. It exists to stop sequential-ID enumeration on the public media-data route.

| | |
|---|---|
| Issued | `UnlockService::issueAccessToken($postId)` (`app/Services/UnlockService.php:123-131`) |
| Issued when | Only during a gated render, and only for media whose `post_status` is `private` (`app/Services/MediaRenderer.php:202-207`) — the source calls this "the only trusted place to hand out the fetch token" |
| Carried as | The `access_key` view variable printed into the player markup (`app/Services/MediaRenderer.php:216`) |
| Verified | `UnlockService::validateAccessToken($postId, $token)` (`:140-152`), called from `FluentCommunityMediaBlock::isPrivateFetchAllowed()` (`app/Blocks/FluentCommunityMediaBlock.php:813-824`) on the `nopriv` `fluent_player_get_media_data` route |
| Bypassed when | The media is not `private`, or the current user passes `current_user_can('read_post', $id)` (`app/Blocks/FluentCommunityMediaBlock.php:815-817`) |
| Shape | `base64url(json {"id": <int>}) . '.' . hash_hmac('sha256', payload, accessSecret())` |

::: warning Access tokens never expire — and that is deliberate
The payload carries an `id` and **no `exp` claim**. The in-source rationale (`app/Services/UnlockService.php:113-121`): the token is printed into markup that may sit in a page cache, so an expiring token would start failing under the cache while the page still looked fresh.

The revocation lever is therefore not time but a **site-wide version bump**. `accessSecret()` mixes the `fluent_player_access_key_version` option into the HMAC key (`:155-159`, default `'1'`):

```php
// Invalidate every outstanding access token on the site at once.
update_option('fluent_player_access_key_version', (string) (time()));
```

Every previously rendered `access_key` stops validating immediately. Cached pages holding an old key will fail the private-media fetch until they are regenerated, so pair a bump with a cache purge.
:::

A failed access-token check does **not** return a distinguishing error: the route answers `403` with the generic "Media not found" string, and only those failed attempts feed the rate limiter — see [`media_data_rate_limit`](/hooks/community#fluent-player-media-data-rate-limit).
