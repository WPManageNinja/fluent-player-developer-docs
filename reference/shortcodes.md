---
title: "Shortcodes"
description: "Every FluentPlayer shortcode tag, its attributes, defaults, precedence rules, and the render-path trap that silently disables timed content."
---

# Shortcodes

Shortcodes are how non-Gutenberg sites embed the player. FluentPlayer registers **four** tags — three in free, one in Pro.

::: warning `add_shortcode` is not in the source
Registration goes through **`$app->addShortCode()`**, the WPFluent wrapper, not the WordPress function directly. A `grep -rn "add_shortcode"` over `app/` finds nothing. Search for `addShortCode` instead:

```bash
P=wp-content/plugins/fluent-player
grep -rn "addShortCode(" "$P/app" "$P/boot"
```
:::

## Registered tags

| Tag | Handler | Registered at | Edition |
|---|---|---|---|
| `[fluentplayer]` | `MediaShortcodeHandler::handle` | `app/Hooks/actions.php:179` | Free |
| `[fluentmedia]` | `MediaShortcodeHandler::handle` (same handler) | `app/Hooks/actions.php:180` | Free |
| `[fluentplayer_timestamp]` | inline closure | `app/Hooks/actions.php:204` | Free |
| `[fluentplaylist]` **(Pro)** | `PlaylistShortcodeHandler::handle` | pro `app/Hooks/actions.php:33` | Pro |

`[fluentmedia]` is a **back-compat alias** — identical behavior, kept so older content keeps rendering. `[fluentplayer]` is the preferred tag.

## `[fluentplayer]`

Sixteen attributes, all enumerated in the `$defaults` array at `app/Hooks/Handlers/MediaShortcodeHandler.php:60-78`.

### Source attributes

| Attribute | Type | Default | Accepted values |
|---|---|---|---|
| `id` | int | `null` | A `fluent_player_media` post ID. Renders that saved media. |
| `video_id` | int | `null` | A media post ID used as a config/chrome template. Same render behavior as `id`. |
| `source_url` | URL | `''` | An explicit `http`/`https` URL. Passed through `esc_url_raw()` (`:84`). |
| `source_meta` | string | `''` | A post-meta key read from the post currently being rendered. |
| `source_poster` | URL | `''` | An explicit poster URL. `esc_url_raw()` (`:86`). |

### Playback / appearance overrides

Each value is validated and cast in `MediaShortcodeHandler::normalizeOverrides()` (`:187-263`). **Invalid values are dropped**, never written into the settings array.

| Attribute | Type | Default | Accepted values | Maps to setting |
|---|---|---|---|---|
| `preset` | string | `''` | Any resolvable preset **slug or name** (`PresetService::resolveRef()`). An unresolvable ref is silently ignored — see the note below. | `preset_slug` (`:198`) |
| `autoplay` | string | `''` | `muted` → muted autoplay; any truthy token → autoplay with sound | `mutedAutoplay` / `autoplay` (`:205`, `:207`) |
| `muted` | string | `''` | truthy token | `muted` (`:211`) |
| `loop` | string | `''` | truthy token | `video_end_option = 'loop'` (`:216`) |
| `plays_inline` | string | `''` | truthy token | `playsInline` (`:220`) |
| `preload` | string | `''` | exactly `none`, `metadata`, or `auto` — anything else ignored | `preload` (`:225`) |
| `ratio` | string | `''` | `W:H`, 1–2 digits per side, **both > 0** (`/^(\d{1,2}):(\d{1,2})$/`) | `aspectRatio` (`:235`) |
| `aspect_ratio` | string | `''` | Alias for `ratio`. Read **only** when `ratio` is empty (`:231-233`). | `aspectRatio` |
| `controls` | string | `''` | Present **and falsey** → hides all three control bars. `1` / absent leaves the saved control config untouched. | `behaviors.hide_top_controls`, `.hide_center_controls`, `.hide_bottom_controls` (`:244-248`) |
| `start` | numeric | `''` | Whole seconds, must be `> 0` | `startTime` (`:254`) |
| `class` | string | `''` | Space-separated class tokens; each sanitized individually | wrapper class (`:259-260`) |

::: tip Truthy tokens are a closed set
`isTruthy()` (`:273-279`) accepts only `1`, `true`, `yes`, `on` (lower-cased, trimmed). Everything else — including `0`, `no`, `false`, `off`, and the empty string — is false. `autoplay="TRUE"` works; `autoplay="enabled"` does not.
:::

::: tip Multiple classes survive
`class="promo hero"` is split on whitespace and each token run through `sanitize_html_class()` before being re-joined (`:259-260`). `sanitize_html_class()` alone would have collapsed it into `promohero`.
:::

### Precedence

Two independent chains, both documented in the handler's docblock (`:41-42`):

**Source precedence** — `source_url` → `source_meta` on the current post → the saved media's own `src`.

**Setting precedence** — `preset` (the base) → the saved media's settings → the inline attributes (highest).

### Render paths

`handle()` (`:58-135`) picks exactly one of four paths:

| Condition | Path | Result |
|---|---|---|
| `id` present | `renderSavedMedia()` (`:99`) | That saved media; `source_*` override its src |
| else `video_id` present | `renderSavedMedia()` (`:110`) | Identical behavior — a clearer-named handle for using a media purely as a config/chrome template |
| else the source resolves | `MediaRenderer::renderFromSource()` (`:130`) | An id-less ad-hoc player configured by `preset` (or the site default preset) |
| else | — | Empty string (`:134`) |

If `id` / `video_id` points at a media the current visitor cannot see, `Media::findVisible()` returns null and the shortcode emits the **access-denied curtain** instead (`:97`, `:108`), not an empty string.

::: danger The big trap: overrides disable timed content
Whenever **any** source or playback override is present, rendering takes the player-only `render()` path instead of `do_blocks()`. **Timed-content InnerBlocks do NOT render for that embed** (`:166-175`).

```
[fluentplayer id="42"]                    ← do_blocks(): timed content renders
[fluentplayer id="42" class="promo"]      ← do_blocks(): timed content renders
[fluentplayer id="42" autoplay="1"]       ← player-only: timed content DOES NOT render
[fluentplayer id="42" start="30"]         ← player-only: timed content DOES NOT render
```

A **`class`-only** shortcode is the one exception: `renderForPageBuilder()` keeps `do_blocks()` and wraps the output in the class, so timed content survives. Add a single playback attribute and it stops.
:::

::: warning `preset="ambient"` silently downgrades on free
The ambient preset is Pro-only. On a free build `Media::mergePresetSettings()` downgrades it to the minimal preset, so `preset="ambient"` renders without error and **without any Pro-exclusive behavior** (`:45-47`). An entirely unresolvable slug is dropped instead of written, because `mergePresetSettings()` treats an unknown `preset_slug` as "no preset" and would strip the media's own (`:195-200`).
:::

### Changing the defaults

**`fluent_player/media_shortcode_defaults`** — filter · `MediaShortcodeHandler.php:80` · 2 args

Runs on the `$defaults` array **before** `shortcode_atts()`, so it both changes fallback values and defines which attributes are accepted at all.

| Arg | Type | Description |
|---|---|---|
| `$defaults` | `array` | The 16-key default map. |
| `$atts` | `array` | The raw attributes as authored. |

```php
add_filter('fluent_player/media_shortcode_defaults', function ($defaults, $atts) {
    $defaults['preload'] = 'metadata'; // site-wide preload floor
    return $defaults;
}, 10, 2);
```

Note that adding a *new* key here makes `shortcode_atts()` accept it, but `normalizeOverrides()` will not map it to a setting — you would also need `fluent_player/media_default_settings` or `fluent_player/block_media_attributes` to act on it.

### Dynamic source filters

`source_url` / `source_meta` / `source_poster` are handed to `DynamicMediaSourceResolver::resolve()` (consumed at `MediaShortcodeHandler.php:83-87`), which exposes three filters:

| Filter | Source | Args | Purpose |
|---|---|---|---|
| `fluent_player/dynamic_source_overrides` | `app/Services/DynamicMediaSourceResolver.php:194` | 5 | The final `{src, provider, posterSrc}` override array. Return `null` to discard it and fall back to the saved media. |
| `fluent_player/dynamic_source_meta_key_allowed` | `:211` | 2 | Underscore-prefixed meta keys (`_my_video_url`) are **blocked by default** as WordPress-protected. Return `true` to opt one in. |
| `fluent_player/dynamic_source_post_id` | `:217` | 2 | Which post `source_meta` is read from. Defaults to `get_the_ID()`. |

`source_meta` keys are also rejected outright if they contain anything outside `[A-Za-z0-9_.:/-]` (`:205`). See [Dynamic Media Sources](/hooks/dynamic-sources) for full signatures.

### Examples

```
[fluentplayer id="42"]
[fluentplayer id="42" class="lesson-video"]
[fluentplayer id="42" preset="course" start="90" controls="0"]
[fluentplayer video_id="42" source_url="https://cdn.example.com/promo.mp4"]
[fluentplayer source_url="https://youtu.be/dQw4w9WgXcQ" preset="minimal" ratio="16:9"]
[fluentplayer video_id="42" source_meta="acf_lesson_video"]
```

## `[fluentplayer_timestamp]`

An inline closure (`app/Hooks/actions.php:204-217`) that emits a clickable seek link inside your content.

| Attribute | Type | Default | Notes |
|---|---|---|---|
| `time` | string | `''` | **Must be `MM:SS` or `HH:MM:SS`** — the runtime parser rejects anything without a colon (`resources/js/FluentPlayer.js:2431-2450`). |
| `media_id` | int-ish string | `''` | The media whose player should seek. Matched against the player's own `mediaId`. |

The shortcode's enclosed content is run through `wp_kses_post()` (`:215`) and both attributes through `esc_attr()` (`:212-213`). It outputs a **custom element**, not a link (`:216`):

```html
<fluentplayer-timestamp time='01:23' media_id='42'>Jump to the demo</fluentplayer-timestamp>
```

`FluentPlayer.setupTimestamps()` (`resources/js/FluentPlayer.js:2420`, called from `:503`) binds `click` and `keydown` on every matching element, parses `MM:SS` / `HH:MM:SS` into seconds, and — after validating the value is non-negative and within the loaded duration — sets `player.currentTime`, calls `play()` (retrying muted on `NotAllowedError`), and `scrollIntoView()`s the player.

```
Watch the setup at [fluentplayer_timestamp time="01:23" media_id="42"]1:23[/fluentplayer_timestamp].
```

## `[fluentplaylist]` **(Pro)**

Handled by `PlaylistShortcodeHandler::handle` (pro `app/Hooks/Handlers/PlaylistShortcodeHandler.php:36-54`). Six attributes:

| Attribute | Type | Default | Notes |
|---|---|---|---|
| `id` | int | `null` | A `fluent_playlist` post ID. Ignored when `tags` is set. |
| `tags` | string / array | `''` | Comma-separated `flp_media_tag` term **names**. When non-empty, the handler switches to the **tag-playlist** path (`:49-51`) and builds a virtual playlist. |
| `settings` | array | `''` | Inline playlist settings; sanitized by `PlaylistSettingsHelper::sanitizeAndValidate()` and stripped of `medias` (`:165-166`). Tag path only. |
| `limit` | int | `20` | Tag path only. **Hard-capped at 100** (`:176`). |
| `orderby` | string | `date` | Tag path only. One of `date`, `title`, `modified`, `rand` — anything else falls back to `date` (`:23`, `:168-171`). |
| `order` | string | `DESC` | Tag path only. `ASC` (case-insensitive) or `DESC`; anything else becomes `DESC` (`:178`). |

**`fluent_player/playlist_shortcode_defaults`** — filter **(Pro)** · pro `PlaylistShortcodeHandler.php:46` · 2 args (`$defaults`, `$atts`). Same shape as the media equivalent.

Both paths respect access control: `filterAccessibleMedias()` (`:267-303`) drops status-hidden media, applies `fluent_player/can_view_media` per item (`:292`), and for password-protected items **strips every source and provider-token key** (`stripLockedMediaSource()`, `:332-342`) so a signed CDN URL never reaches the browser for media the viewer has not unlocked. A password-protected *playlist* renders the locked form instead (`:111-115`).

```
[fluentplaylist id="88"]
[fluentplaylist tags="onboarding,week-1" limit="10" orderby="title" order="ASC"]
```
