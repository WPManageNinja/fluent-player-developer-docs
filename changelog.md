---
title: "Developer Changelog"
description: "Developer-facing changes to FluentPlayer — hooks, routes, and extension points added, changed, or removed per release."
---

# Developer Changelog

Tracks changes to the **developer surface** (hooks, REST routes, extension base classes) per plugin release. This is distinct from the [user-facing changelog](https://docs.fluentplayer.com/changelog).

Maintained by the `fluentplayer-dev-code-to-docs` skill: on each release it diffs the extracted hook/route sets against the previous tag and records additions, changes, and removals here.

## Unreleased — documentation accuracy pass

Verified against **FluentPlayer 1.3.0** (free) and **FluentPlayer Pro 1.3.0**. No plugin code changed; this entry records corrections to the documentation itself, several of which were shipping broken snippets.

**Corrected**

- **REST namespace** — endpoints are `/wp-json/fluent-player/v2/`, not `v1` (`config/app.php:10-11`). Capability notes on the route pages now match the policies that actually guard them.
- **Surface counts** — the free plugin dispatches **15 actions** (12 literal `do_action`, the `fluent_player/daily_cleanup` cron hook, and the two dynamically dispatched behavior actions) and **77 filters**; Pro adds **8** actions and **12** filters of its own — **112 distinct hook names**. Previously stated as 12 and 62, then briefly as 13 actions / 110 distinct. Route totals are **45 free + 102 Pro = 147**.
- **The hook extractor under-reported the action surface by two.** `fluent_player/media_milestone` and `fluent_player/layer_event` are dispatched through a variable — `do_action($this->eventName(), $ctx)` at `app/Hooks/Handlers/AbstractBehaviorHandler.php:156` — so a literal-name scan never saw them. Both are now carried as verified manual entries in `bin/extract-hooks.mjs`, appear in the [Full Reference](/hooks/reference), and are documented in full on the [Actions](/hooks/actions#fluent-player-media-milestone) page. The extractor now also fails outright on any dynamic dispatch site no entry accounts for, so the same gap cannot reopen silently.
- **`fluent_player/daily_cleanup` edition** — emitted as `free`, not `both`. Pro only *subscribes* (`fluent-player-pro/app/Hooks/actions.php:59-60`); it never re-dispatches. There are exactly four `both` hooks: `admin_notices`, `can_view_media`, `integrations`, `player_settings`.
- **Callback-argument counts are the minimum across dispatch sites**, not the maximum — the maximum would promise arguments some sites do not pass. No hook currently varies between its sites, so no published number changed.
- **Removed a phantom hook** that never existed in either tree.
- **`fluent_player/watch_recorded`** — the LMS recipe read `$payload['complete']`, a key the action never passes. Completion is nested: `$payload['verdict']['complete']` (`app/Services/Progression/ProgressionService.php:187-194`). The old snippet was a silent no-op.
- **`fluent_player/dynamic_source_overrides`** — the fallback-poster recipe wrote `$overrides['poster']`. The resolver's key is `posterSrc` (`app/Services/DynamicMediaSourceResolver.php:185-189`); the old snippet set a key nothing reads.
- **`fluent_player/email_providers`** — the email guide used `str_ends_with()`, which is PHP 8.0 and **fatals** on the declared PHP 7.4 floor, inside an AJAX request. Rewritten 7.4-safe, with the real shape of `$providers` (a per-entry `['enabled','type','config']` config list, `app/Services/EmailCollectionService.php:318-324`) and the returning-visitor branch that skips the filter entirely.
- **`fluent_player/access_denied_html`** — no longer presented as the paywall hook. It only fires for media hidden by a non-public status; published and private media return an empty curtain before reaching it (`app/Models/Media.php:314-337`).
- **JS API** — `AnalyticsTracker` does not emit events. It listens to native Vidstack events and POSTs `fluent_player_track_event` to `admin-ajax.php`. Analytics is now marked **(Pro)** because that AJAX action is registered only in Pro (`fluent-player-pro/app/Hooks/Handlers/AnalyticsHandler.php:56-57`).
- **Tech stack** — the four JS dependency versions are now all **lockfile-resolved** (`package-lock.json`), not the declared ranges from `package.json`: Vidstack `1.12.13`, hls.js `1.6.15`, Vue `3.5.13`, Element Plus `2.8.8`. Element Plus was previously given as `2.2.17` — that is the declared range (`^2.2.17`), six minors behind what actually ships. Gutenberg `apiVersion: 3`.
- **Hook discovery commands** — the old grep scoped to `app/` (missing `boot/app.php:34`'s `fluent_player/loaded`) and matched only `apply_filters(` (missing `$app->applyFilters(...)` at `app/Hooks/Handlers/AdminMenuHandler.php:382`). Both dispatch forms and both directories are now covered, and `npm run extract` is the preferred path.

**Added**

- [Pro REST routes](/rest-api/pro) — the 102 routes that only exist with Pro active.
- [AJAX actions](/rest-api/ajax) — the `admin-ajax.php` surface the frontend player uses.
- [Shortcode reference](/reference/shortcodes), [Data model](/reference/data-model), [Capabilities](/reference/capabilities).
- [Custom Integration](/extending/custom-integration) guide.
- [JS API](/js-api/) expanded from a placeholder to the full surface: five `window` globals, eight custom events split into frontend-runtime and editor groups, the inbound `InitSingleFluentPlayer` / `FComMediaReady` events, and the six PHP-localized config objects.
- [Recipes](/recipes/) gained a working block-paywall recipe (`fluent_player/pre_render_block_media`) and a submission short-circuit recipe (`fluent_player/pre_process_email_submit`).
- [DOM attributes](/reference/dom-attributes) — the `data-*` contract between the PHP renderer and the frontend runtime (`data-var_name`, `data-media-id`, `data-access-key`, `data-flp-ref`, `data-fp-config`), plus which attributes are Vidstack's rather than FluentPlayer's (`data-ended`, `data-error`).

**Known limitation documented, not fixed**

- There is no supported way to reach a running player instance from outside. `window.FluentPlayer` is the constructor; live instances sit in a module-private `Map` (`resources/js/fluent-player.js:21`) with no exported accessor. The documented workaround is `container.querySelector('media-player')` for the Vidstack API.

## 1.3.0 — 22 July 2026 (free) · 23 July 2026 (Pro)

Developer surface only. For the user-facing feature list see the plugin `readme.txt` changelogs.

Derived by diffing the full `fluent_player/*` name set in `app/` + `boot/` between the `v1.2.0` tag and the 1.3.0 tree in each repo. **Sixteen** hook names were added to free and **three** to Pro; **none were removed or renamed** in either tree.

### Added — free actions

| Hook | Where | Notes |
|---|---|---|
| `fluent_player/media_status_changed` | `app/Hooks/actions.php:38` · 3 args | Fires on a `fluent_player_media` post transition. `$post_id`, `$new_status`, `$old_status`. |

Two further actions are dispatched **dynamically**, which is why an earlier literal-name extraction missed them and put the action total at 13. Both are now extracted and documented, and the free action total is **15**:

| Hook | Where | Notes |
|---|---|---|
| `fluent_player/media_milestone` | `app/Hooks/Handlers/AbstractBehaviorHandler.php:156` via `do_action($this->eventName(), $ctx)` | Name constant at `app/Integrations/FluentCrm/BehaviorRegistry.php:17`. Emitted by the milestone behavior endpoint. 1 arg — see [Actions](/hooks/actions#fluent-player-media-milestone). |
| `fluent_player/layer_event` | same dispatch site | Name constant at `BehaviorRegistry.php:18`. Emitted by the layer behavior endpoint. 1 arg — see [Actions](/hooks/actions#fluent-player-layer-event). |

### Added — free filters

| Hook | Where | Notes |
|---|---|---|
| `fluent_player/authoring_capability` | `app/Helpers/Helper.php:1113` | Default `'edit_others_posts'`. The single gate that opened media/layer/preset authoring to editors. See [Capabilities](/reference/capabilities). |
| `fluent_player/can_view_media` | `app/Models/Media.php:302` | Per-media visibility veto. Also consumed by Pro's playlist shortcode (`fluent-player-pro/app/Hooks/Handlers/PlaylistShortcodeHandler.php:292`). |
| `fluent_player/default_media_status` | `app/Http/Controllers/MediaController.php:296` | Default `'draft'`. |
| `fluent_player/media_discoverable` | `app/Hooks/Handlers/FluentPlayerMediaCPT.php:107` | Default `false` — this is why media pages are excluded from search and sitemaps by default. |
| `fluent_player/media_page_noindex` | `app/Hooks/Handlers/FluentPlayerMediaCPT.php:120` | Default `true`. |
| `fluent_player/global_vars` | `app/Blocks/FluentCommunityMediaBlock.php:532` | Also applied on the standard render path at `app/Services/MediaRenderer.php:339`. The supported way to add a key to the `window.fluent_player` config object. |
| `fluent_player/page_builders` | `app/Services/PageBuilderService.php:72` | The Elementor/Divi adapter registry. See [Blocks & Page-Builder Widgets](/reference/blocks#the-registry-is-extensible). |
| `fluent_player/divi/is_visual_builder_request` | `app/PageBuilders/Divi/DiviPageBuilder.php:61` | Overrides Divi 5 Visual Builder detection. |
| `fluent_player/allowed_media_providers` | `app/Services/MediaService.php:21` | Whitelist behind `MediaService::ALLOWED_PROVIDERS`. |
| `fluent_player/audio_extensions` | `app/Helpers/Helper.php:115` | Extensions that make a source render as audio. Also read by Pro. |
| `fluent_player/behavior_can_report` | `app/Hooks/Handlers/AbstractBehaviorHandler.php:46` · 2 args | Per-visitor consent veto over **all** behavior reporting (automation and timeline). Default `true`. |
| `fluent_player/fluentcrm_timeline_event_payload` | `app/Integrations/FluentCrm/TimelineBridge.php:232` · 2 args | Last chance to reshape a FluentCRM contact-timeline entry before it is written. |
| `fluent_player/media_data_rate_limit` | `app/Blocks/FluentCommunityMediaBlock.php:774` | Default `60` requests. Guards the `nopriv` media-data AJAX action. |

### Added — Pro filters

| Hook | Where | Notes |
|---|---|---|
| `fluent_player/default_playlist_status` | `fluent-player-pro/app/Http/Controllers/PlaylistController.php:169` · 2 args | Default `'publish'`. **Create-only** — the update branch never rewrites status (`:164-165`), the filter runs only when the request carries no explicit `post_status`, and the result is accepted only if it is `publish`, `private`, or `draft` (`:171`). |
| `fluent_player/playlist_discoverable` | `fluent-player-pro/app/Hooks/Handlers/FluentPlaylistCPT.php:213` | Default `false` — the playlist mirror of `media_discoverable`. |
| `fluent_player/playlist_page_noindex` | `fluent-player-pro/app/Hooks/Handlers/FluentPlaylistCPT.php:226` · 2 args | Default `true`. |

### Not new in 1.3.0

The unlock filters — `fluent_player/unlock_token_ttl`, `unlock_rate_key`, `unlock_rate_limit`, `unlockable_post_types` — all landed in **1.0.9** (commit `5e039e6f`, 25 June 2026), not 1.3.0. They are documented on [Unlock hooks](/hooks/unlock).

### Changed

- **Text domains diverged.** Pro moved every string to its own `fluent-player-pro` text domain in **1.0.7** ("Fix: Use the fluent-player-pro text domain for all Pro strings"). At 1.3.0 Pro's `app/` uses `'fluent-player-pro'` 807 times and `'fluent-player'` 4 times. Free remains `fluent-player`. See [i18n](/getting-started/architecture#i18n-and-text-domains).

_Add the next entry above this line, newest first, keyed by plugin version and date._
