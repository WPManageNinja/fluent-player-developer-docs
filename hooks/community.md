---
title: "FluentCommunity Hooks"
description: "Filters for embedding and rendering FluentPlayer media inside FluentCommunity posts and portal content."
---

# FluentCommunity Hooks

These filters control how FluentPlayer media renders inside **FluentCommunity** — which blocks are allowed, the variables and assets passed to the community iframe, and the portal payload. They fire only when FluentCommunity is active.

## `fluent_player/fluent_community_allowed_blocks`

**Type:** filter · **Source:** `app/Blocks/FluentCommunityMediaBlock.php:168`

Filters the block types allowed inside FluentCommunity content.

| Arg | Type | Description |
|---|---|---|
| `$allowedBlockTypes` | `array` | Allowed block type names. |

```php
add_filter('fluent_player/fluent_community_allowed_blocks', function ($types) {
    $types[] = 'fluent-player/my-block';
    return $types;
});
```

## `fluent_player/fluent_community_block_vars`

**Type:** filter · **Source:** `app/Blocks/FluentCommunityMediaBlock.php:485`

Filters the player variables passed to a community-embedded block.

| Arg | Type | Description |
|---|---|---|
| `$mediaBlockVars` | `array` | Variables localized to the player. |
| `$defaultSettings` | `array` | Resolved default settings. |

## `fluent_player/fluent_community_iframe_assets`

**Type:** filter · **Source:** `app/Blocks/FluentCommunityMediaBlock.php:375`

Filters the asset settings for the community player iframe.

| Arg | Type | Description |
|---|---|---|
| `$settings` | `array` | Iframe asset settings. |
| `$isDevMode` | `bool` | Whether dev-mode assets are used. |
| `$ver` | `string` | Asset version string. |

## `fluent_player/fluent_community_layers`

**Type:** filter · **Source:** `app/Services/LayerService.php:125`

Filters the interactive layers shown on a community-embedded player.

| Arg | Type | Description |
|---|---|---|
| `$layers` | `array` | Resolved layers. |
| `$settings` | `array` | Player settings. |

## `fluent_player/fluent_community_portal_data`

**Type:** filter · **Source:** `app/Blocks/FluentCommunityMediaBlock.php:595`

Filters the data payload sent to the FluentCommunity portal.

| Arg | Type | Description |
|---|---|---|
| `$data` | `array` | Portal data payload. |

## `fluent_player/media_data_rate_limit`

**Type:** filter · **Source:** `app/Blocks/FluentCommunityMediaBlock.php:774`

Filters how many **failed private-media fetch attempts** an IP may make within the window on the **public, `nopriv` media-data AJAX endpoint** that the community player uses to hydrate itself. Default `60`. Cast to `int` by the caller.

::: warning This is not a request quota
Ordinary traffic never touches this counter. The limiter sits **inside the failure branch** — it runs only after `isPrivateFetchAllowed()` has already rejected the request (`app/Blocks/FluentCommunityMediaBlock.php:768-778`). The source comment is explicit about why:

> Only FAILED private-access attempts are the brute-force surface, so only those count toward the per-IP brake. Valid fetches and ordinary published loads never count — a shared classroom/office IP can watch freely; only someone guessing tokens gets throttled.

So a request is counted **only** when the media is `private`, the visitor cannot `read_post` it, and the supplied `access_key` is missing or fails HMAC validation (`app/Blocks/FluentCommunityMediaBlock.php:813-824`). A published media load, a valid access-token fetch, and a logged-in editor's request are all free — a whole office behind one NAT address will never hit this ceiling by watching video.

Over the limit returns `429 Too many requests`; under it, the same rejected request still returns `403` with a generic "Media not found" so the two outcomes leak nothing about which IDs exist.
:::

The bucket is keyed on the IP alone — `'flp_md_rl_' . md5($ip)` in the `flp_media` cache group — with a **60-second window** (`Helper::hitRateLimit()`'s default `$window`, `app/Helpers/Helper.php:1432`). Unlike the [unlock limiter](/hooks/unlock#fluent-player-unlock-rate-limit), the media ID is *not* part of the key, so guesses across different media share one budget.

| Arg | Type | Description |
|---|---|---|
| `$limit` | `int` | Maximum failed private-fetch attempts per IP per 60-second window. Default `60`. |

Because the endpoint is reachable by logged-out visitors, this is what stops it being used to enumerate private media by ID. Raise it only if you have a concrete reason — legitimate traffic is not what consumes it.

```php
add_filter('fluent_player/media_data_rate_limit', function ($limit) {
    return 120;
});
```

## Related

- `fluent_player/fluent_community_enqueue_block_assets` (action, 0 args) — `app/Blocks/FluentCommunityMediaBlock.php:449`, fires while community block assets are enqueued.

::: tip `fluent_player/player_settings` is a core render hook, not a FluentCommunity one
It fires at four sites in the free plugin — the core render path `app/Services/MediaRenderer.php:191`, the REST controller (`app/Http/Controllers/MediaController.php:105` and `:367`), and the community media-data endpoint (`app/Blocks/FluentCommunityMediaBlock.php:796`) — plus Pro's playlist shortcode (`fluent-player-pro/app/Hooks/Handlers/PlaylistShortcodeHandler.php:460`). Pro's Mux, BunnyCDN, Gumlet, R2 and Cloudflare Stream services all attach to it.

It is documented under **Media rendering** in the [hook reference](/hooks/reference). A callback registered for FluentCommunity will also run on every other render path, so branch on the settings you actually recognise.

Note also that `FluentCommunityMediaBlock.php:775` — a line this page used to cite for `player_settings` — is now inside the `media_data_rate_limit` block above. Verify against `:796`.
:::

::: danger `fluent_player/global_vars` also fires here — with a different array
`fluent_player/global_vars` is not on this page (it is documented under [Media Rendering](/hooks/media-rendering#fluent-player-global-vars) and listed in the [hook reference](/hooks/reference#media-rendering)), but **one of its two dispatch sites is the FluentCommunity block**: `getFluentPlayerConfig()` at `app/Blocks/FluentCommunityMediaBlock.php:532`. The other is the standard render path, `app/Services/MediaRenderer.php:339`.

The two sites do **not** pass the same array. Each builds its own literal, and they share only four keys:

| | `MediaRenderer.php:306-339` (standard render) | `FluentCommunityMediaBlock.php:532-541` (community) |
|---|---|---|
| Common | `ajax_url`, `nonce`, `serverLang`, `audio_extensions` | `ajax_url`, `nonce`, `serverLang`, `audio_extensions` |
| Only here | `has_pro`, `show_powered_by`, `trans`, `resume_playback`, `youtube`, `locked_message`, `external_tracked_media` — plus `analytics` and `google_analytics` when Pro is active | `rest_url`, `rest_nonce`, `context` (always the literal `'fluent-community'`), `version` |

A callback written against the render-path array will read missing keys on the community pass — `$vars['trans']['play']` is an undefined-index notice there, and `$vars['has_pro']` is simply absent, so a truthiness test on it silently reports "no Pro" inside FluentCommunity.

Branch on `$vars['context']`, which exists **only** on the community pass, or use `isset()` / `Arr::get()` on every key you touch:

```php
add_filter('fluent_player/global_vars', function ($vars) {
    $isCommunity = isset($vars['context']) && $vars['context'] === 'fluent-community';

    $vars['my_flag'] = $isCommunity ? 'portal' : 'standard';

    return $vars;
});
```
:::
