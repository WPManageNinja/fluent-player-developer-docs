---
title: "DOM Attributes"
description: "The data-* contract between FluentPlayer's PHP renderer and its frontend runtime — who writes each attribute, who reads it, and its value shape."
---

# DOM Attributes

The rendered player is not self-describing markup: the PHP renderer stamps a small set of `data-*` attributes that the frontend runtime uses to find its config, identify the media, authorize a fetch, and resolve deep links. **This is the PHP ↔ JS contract.** If you generate FluentPlayer markup yourself, re-render it through a page builder, or move it around the DOM, these are the attributes that must survive.

Every claim below carries a `file:line` citation against **1.3.0**. Pro paths are prefixed `fluent-player-pro/`.

::: danger Not all `data-*` on the player is FluentPlayer's
`<media-player>` is a **Vidstack** custom element. Vidstack reflects its own state onto that element as `data-*` attributes — `data-ended`, `data-error`, `data-paused`, `data-can-play`, `data-started`, `data-view-type`, `data-media-provider`. FluentPlayer reads and styles them but, with one exception, does not write them. Their semantics are Vidstack's, not FluentPlayer's, and they can change when Vidstack is upgraded. See [Vidstack state attributes](#vidstack-state-attributes).
:::

## The player container

Two nested elements carry everything. Rendered by `app/Views/player.php`:

```html
<div class="fluent-player"
     id="fluent_player_{mediaId}_{n}"
     data-var_name="fluent_player_{mediaId}_{n}"
     data-skin="{skin}"
     data-flp-ref="fpm_{mediaId}_{mediaId}_{n}"
     role="region" aria-label="Media player">
  <div class="fluent-player-container"
       data-media-id="{mediaId}"
       data-access-key="{token}">   <!-- private media only -->
    <media-player …>…</media-player>
  </div>
</div>
```

| Attribute | Element | Written by | Read by | Value shape |
|---|---|---|---|---|
| `data-var_name` | `.fluent-player` | `app/Views/player.php:148` | `resources/js/fluent-player.js:64` (bulk init), `:113` (orphan cleanup) | `fluent_player_{mediaID}_{instanceCounter}` — built at `app/Services/MediaRenderer.php:186-187`. **The lookup key for `window[varName]`**, the per-instance config that `wp_localize_script` wrote (`MediaRenderer.php:198`). |
| `data-media-id` | `.fluent-player-container` | `app/Views/player.php:151` | `resources/js/fluent-player.js:136` | The media post ID as a decimal string. Preferred over parsing the container id because it is the *real* numeric ID. |
| `data-access-key` | `.fluent-player-container` | `app/Views/player.php:151` — **emitted only when non-empty** | `resources/js/fluent-player.js:144` | An opaque signed token, issued by `UnlockService::issueAccessToken()` and only for a media whose `post_status` is `private` (`MediaRenderer.php:203-206`). Sent with the media-data AJAX fetch so an unlisted private embed can hydrate. |
| `data-flp-ref` | `.fluent-player` | `app/Views/player.php:149`; value computed at `:106` | `resources/js/FluentPlayer.js:642` (build share URL), `:1557` (resolve inbound deep link) | Always `'fpm_' . absint($media_id) . '_' . sanitize_key($instance_id)` — nothing in either tree passes a `player_ref` to the view, so the `??` branch at `:106` never takes the supplied value today. Matching is case-insensitive against `^[a-z0-9_-]{1,80}$` (`resources/js/utils/urlPlaybackTarget.js:8-19`). |
| `data-skin` | `.fluent-player` | `app/Views/player.php:148-149` | *(nothing in the shipped runtime)* | The preset skin name. **Write-only today** — no CSS selector and no JS module in either tree reads it. Useful as a theming hook of your own; do not assume the plugin will react to changing it. |

::: warning `data-var_name` uses an underscore, not a hyphen
It is `data-var_name`, so the JS property is `container.dataset.var_name` — not `varName`. This is deliberate and load-bearing; renaming it breaks initialization silently, because `fluent-player.js:64` simply gets `undefined` and falls through to the AJAX fetch path.
:::

### How the three combine at init

`initFluentPlayers()` walks every `.fluent-player`, reads `data-var_name`, and looks up `window[varName]` (`resources/js/fluent-player.js:64-66`). If that global is missing or malformed it falls back to `fetchMediaData(container)` (`:132`), which reads `data-media-id` from a descendant (`:135-136`) and `data-access-key` alongside it (`:144`), then POSTs for the config. On success the fetched config is written **back** to `window[varName]` (`:78`), so a second pass is cheap.

That fallback is why the FluentCommunity portal and AJAX-injected content work at all: there is no localized script for markup that arrived after the page load, so the DOM attributes are the only input.

## Deep-link targeting

`data-flp-ref` is the anchor for the "copy link at current time" feature. The URL side of the contract lives in `resources/js/utils/urlPlaybackTarget.js:76-79`:

| Query parameter | Meaning |
|---|---|
| `flp_r` | Player ref — matched against a container's `data-flp-ref`. |
| `flp_v` | Media ref — matched against a playlist item's `data-flp-ref`. |
| `flp_t` | Start time in whole seconds. Non-negative integers only (`:21-30`). |

Refs are sanitized on the way in: anything that is not `^[a-z0-9_-]{1,80}$` after trimming and lower-casing is discarded (`:8-19`). The parsed target is cached on `window.__flpUrlPlaybackTarget` for the page's lifetime (`:82`).

Playlist items carry the same attribute so an item can be targeted directly — Pro writes it in `fluent-player-pro/app/Views/playlist/grid/grid-item.php:29`, `playlist/standard/sidebar-item.php:22`, and `playlist/learning/lesson-item.php:24`; free's grid manager stamps it client-side for dynamically built items (`resources/js/managers/GridPlaylistManager.js:297`).

## The playlist container **(Pro render, free runtime)**

| Attribute | Element | Written by | Read by | Value shape |
|---|---|---|---|---|
| `data-var_name` | `.fluent-playlist` | `fluent-player-pro/app/Layouts/BasePlaylistLayout.php:73`; also the layout views (`playlist/layouts/{grid,standard,learning}.php:18-21`) | `resources/js/fluent-playlist.js:63` | Same role as on the player — the `window[varName]` key. |
| `data-fp-config` | `.fluent-playlist` | `fluent-player-pro/app/Layouts/BasePlaylistLayout.php:73` | `resources/js/fluent-playlist.js:36-38` | **The whole playlist config as an HTML-escaped JSON string.** Parsed with `JSON.parse`, cached to `window[varName]`, and preferred over the legacy `<script type="application/json" id="fp-playlist-config-{varName}">` element that is still supported as a fallback (`:44-45`). |
| `data-flp-ref` | `.fluent-playlist` and each item | Pro layout views (above) | `resources/js/fluent-playlist.js:69-70`, `FluentPlaylist.js:216`, `:308`, `:330`, `:1221` | Deep-link ref. If the container has none, the runtime backfills it from `config.playlist.deep_link_ref` (`fluent-playlist.js:69-70`). |
| `data-media-index` | playlist item | Pro layout views | `resources/js/FluentPlaylist.js:808-809`, `managers/GridPlaylistManager.js:296`, `:332` | Zero-based index into `config.medias`. |

## Overlay and layer attributes

These are read by the overlay controllers rather than the player core. They are stable but narrower in scope.

| Attribute | Element | Written by | Read by |
|---|---|---|---|
| `data-nonce` | email-capture and layer submit forms | `app/Views/player/email-capture.php:62`, `app/Views/Layers/LayerRenderer.php:148` | `resources/js/FluentPlaylist.js:1985` and the email-capture submit path |
| `data-type` | same forms | `app/Views/player/email-capture.php:61` (`"preset"`), `LayerRenderer.php:147` (`"layer"`) | `resources/js/FluentPlaylist.js:1984` — selects which nonce action the server verifies |
| `data-preset-slug` | same forms, action bar, CTA overlay | `email-capture.php:60`, `action-bar-overlay.php:59`, `:73`, `cta-overlay.php:36` | `resources/js/FluentPlaylist.js:1982` |
| `data-layer-id` | layer template + form | `LayerRenderer.php:30`, `:146` | `resources/js/LayersManager.js` |
| `data-action` | layer ad links, hotspots, skip button | `LayerRenderer.php:199` (`ad-click`), `:264` / `:278` (`hotspot-click`), `:369` (`skip`) | `resources/js/LayersManager.js:416`, `:479`, `:891`, `:899` |
| `data-confirmation-message` · `data-confirmation-countdown` · `data-confirmation-dismiss-text` | `.media-email-capture-overlay` | `app/Views/player/email-capture.php:42`, `LayerRenderer.php:130` | `resources/js/utils/emailCapture.js:44-45` — countdown parsed with `parseInt`, defaulting to `10` |
| `data-media-id` | `.fp-media-locked` wrapper | `app/Services/MediaRenderer.php:371` | `resources/js/utils/unlock.js:52` — the password-unlock form submit delegate |
| `data-media-id` | `.fp-media-block` block wrapper | `app/Services/MediaRenderer.php:224` | `resources/js/timed-content-frontend.js:13` |

## Timed content

`.fp-timed-content` with `data-start` / `data-end` is a **cross-plugin contract** owned jointly by free (which saves the markup and ships the runtime) and Pro (which injects it). It is documented in full, with all three consumers, in the "free → Pro markup contract" section of [Blocks & Page-Builder Widgets](/reference/blocks). Do not rename either attribute.

## Vidstack state attributes

FluentPlayer's own E2E suite asserts on two of these, which makes them a de-facto public signal even though the plugin does not author them:

| Attribute | On | Written by | Meaning |
|---|---|---|---|
| `data-ended` | `<media-player>` | **Vidstack** | Playback reached the end. Asserted by `dev/e2e/player-state.spec.js:39`, `:43`. |
| `data-error` | `<media-player>` | **Vidstack** | The underlying `MediaError` fired. Asserted by `dev/e2e/error.spec.js:32`, `:36`, `:44`. |
| `data-paused` | `<media-player>` | **Vidstack** | Styled by `resources/scss/components/player/_buttons.scss:74`, `_player.scss:398`. |
| `data-can-play` | `<media-player>` | **Vidstack** | Gates the player's fade-in (`app/Views/player.php:142`). |
| `data-view-type` | `<media-player>` | **Vidstack** | `"audio"` selects the audio layout (`app/Views/player.php:131`). |
| `data-started` | `<media-player>` | **Vidstack**, *and* FluentPlayer | The one exception. FluentPlayer force-sets it (and clears `data-ended`) after a successful YouTube resume seek, because a programmatic seek does not mark a YouTube player as started and the poster would stay on top — `resources/js/FluentPlayer.js:1373-1374`. |

::: tip Listen to events, don't poll attributes
For playback state, the native Vidstack / `HTMLMediaElement` events (`play`, `pause`, `ended`, `timeupdate`) are the supported API — see the [JS API](/js-api/#custom-events). The attributes above are reflections of that state, convenient for CSS and for test assertions, not an event channel.
:::

## Stability

- **Stable, treat as public:** `data-var_name`, `data-media-id`, `data-flp-ref`, `data-fp-config`, `data-start` / `data-end`. Free and Pro both depend on these across the plugin boundary.
- **Stable but conditional:** `data-access-key` — present only for `private` media, absent otherwise. Never assume it exists.
- **Owned by Vidstack:** everything in the table above. Pin your Vidstack expectations to the version the plugin ships (`1.12.13`).
- **Unused today:** `data-skin`. Read it if you want, but nothing in the plugin does.
