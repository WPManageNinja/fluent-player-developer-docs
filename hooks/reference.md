---
title: "Full Hooks Reference"
description: "The complete set of FluentPlayer actions and filters across free and Pro, with type, callback argument count, edition, and source location."
---

# Full Hooks Reference

Every action and filter dispatched by FluentPlayer, across both plugin trees:

| Edition | Actions | Filters | Total |
|---|---|---|---|
| Free (`fluent-player`) | 15 | 77 | 92 |
| Pro-only (`fluent-player-pro`) | 8 | 12 | 20 |
| **Distinct hook names** | **23** | **89** | **112** |

Generated from source (`npm run extract:hooks`) and verified with `file:line`. "Args" is the number of arguments passed to your callback (add `, N` as the `accepted_args` in `add_action` / `add_filter`). It is the **minimum across every dispatch site** of that hook — the contract a callback can rely on no matter which site fired it. No hook in either tree currently disagrees between its sites.

The **Edition** column tells you which tree dispatches the hook:

- **free** — dispatched by the free plugin only. Pro may still *subscribe* to it with `add_action()` / `addFilter()`; that does not change the edition, because the hook still fires exactly once from one tree.
- **both** — dispatched by the free plugin *and re-dispatched by Pro*, so a callback can fire **more than once per request**. There are exactly four: `admin_notices`, `can_view_media`, `player_settings`, and `integrations`. Write these callbacks to be idempotent.
- **(Pro)** — only exists when FluentPlayer Pro is active. Guard with `defined('FLUENT_PLAYER_PRO_VERSION')` or a `function_exists()` check before you depend on it.

::: warning
Signatures can change between releases. Regenerate this table against your installed version with `node bin/extract-hooks.mjs` (see [Regenerating](#regenerating)).
:::

The extractor covers all four dispatch forms — `do_action()`, `apply_filters()`, and the WPFluent wrappers `$app->doAction()` / `$app->applyFilters()` — across `app/` and `boot/` in both repos. Hooks such as `fluent_player/admin_vars` and `fluent_player/base_url` are dispatched *only* through `applyFilters()` and are invisible to an `apply_filters`-only search.

Three free actions have **no literal hook name at their dispatch site** and are carried as verified manual entries, each checked against source: the cron hook `fluent_player/daily_cleanup`, and the two behavior actions `fluent_player/media_milestone` and `fluent_player/layer_event`, dispatched through a variable at `fluent-player-dev/app/Hooks/Handlers/AbstractBehaviorHandler.php:156`. The extractor fails rather than skip a dynamic dispatch it cannot account for, so the table below is the whole surface, not the greppable part of it.

For argument names and runnable examples on the most-used hooks, see the curated pages: [Actions](/hooks/actions), [Access & Gating](/hooks/access-gating), [Dynamic Sources](/hooks/dynamic-sources), [Email Providers](/hooks/email), [Media Rendering](/hooks/media-rendering), [Progression](/hooks/progression), [Unlock & Tokens](/hooks/unlock), [Smartcodes](/hooks/smartcodes), [FluentCommunity](/hooks/community).

## Bootstrap & admin

| Hook | Type | Args | Edition | Source |
|---|---|---|---|---|
| `fluent_player/admin_notices` | filter | 1 | both | `fluent-player-dev/app/Hooks/Handlers/AdminMenuHandler.php:375`, `fluent-player-pro/app/Http/Controllers/LicenseController.php:103` |
| `fluent_player/admin_vars` | filter | 1 | free | `fluent-player-dev/app/Hooks/Handlers/AdminMenuHandler.php:382` |
| `fluent_player/base_url` | filter | 1 | free | `fluent-player-dev/app/Hooks/Handlers/AdminMenuHandler.php:253` |
| `fluent_player/daily_cleanup` | action | 0 | free | `fluent-player-dev/app/Hooks/Handlers/ScheduledCleanupHandler.php:9` |
| `fluent_player/loaded` | action | 1 | free | `fluent-player-dev/boot/app.php:34` |
| `fluent_player/settings_section/{$section}` | filter | 2 | free | `fluent-player-dev/app/Services/SettingsService.php:141` |

### `settings_section/{$section}` is a dynamic hook

`{$section}` is not a literal — it is interpolated at dispatch time (`fluent-player-dev/app/Services/SettingsService.php:141`):

```php
return apply_filters("fluent_player/settings_section/{$section}", $sectionSettings, $settings);
```

`$section` is the dot-notation top-level settings key passed to `SettingsService::getSection()`. In the shipped tree those keys are `general`, `youtube`, `performance`, `analytics`, `google_analytics`, `branding`, and `subtitle_service` (the last is read by Pro at `fluent-player-pro/app/Services/SubtitleService.php:73`). So the hook you register is, for example:

```php
// CORRECT — the section name is baked into the hook name.
add_filter('fluent_player/settings_section/youtube', function ($sectionSettings, $allSettings) {
    $sectionSettings['nocookie'] = true;
    return $sectionSettings;
}, 10, 2);
```

::: danger Do not register the literal
`add_filter('fluent_player/settings_section/{$section}', ...)` is a valid `add_filter()` call that will **never fire** — nothing dispatches that literal name. It fails silently.
:::

### `daily_cleanup` is a cron hook

`fluent_player/daily_cleanup` is never dispatched by a literal `do_action()`. It is the WP-Cron hook name (`fluent-player-dev/app/Hooks/Handlers/ScheduledCleanupHandler.php:9`), scheduled daily at `fluent-player-dev/app/Hooks/actions.php:109`. WP-Cron fires it, so `add_action()` works normally — but you will not find a dispatch site by grepping for `do_action`.

The extractor emits its edition as **free**, not **both**, even though Pro is involved: `fluent-player-pro/app/Hooks/actions.php:59-60` are `$app->addAction(...)` calls — Pro **subscribes** its analytics and playlist cleanup to the event, it never re-dispatches it. The hook still fires exactly once per cron run, from the schedule the free plugin registered, so a callback of yours runs once. Contrast the four genuine **both** hooks, where Pro dispatches the same name again and your callback runs more than once per request.

## Access & gating

| Hook | Type | Args | Edition | Source |
|---|---|---|---|---|
| `fluent_player/access_denied_html` | filter | 3 | free | `fluent-player-dev/app/Models/Media.php:352` |
| `fluent_player/access_denied_message` | filter | 3 | free | `fluent-player-dev/app/Models/Media.php:344` |
| `fluent_player/authoring_capability` | filter | 1 | free | `fluent-player-dev/app/Helpers/Helper.php:1113` |
| `fluent_player/behavior_can_report` | filter | 2 | free | `fluent-player-dev/app/Hooks/Handlers/AbstractBehaviorHandler.php:46` |
| `fluent_player/can_view_media` | filter | 2 | both | `fluent-player-dev/app/Models/Media.php:302`, `fluent-player-pro/app/Hooks/Handlers/PlaylistShortcodeHandler.php:292` |
| `fluent_player/media_locked_html` | filter | 2 | free | `fluent-player-dev/app/Services/MediaRenderer.php:376` |
| `fluent_player/media_locked_message` | filter | 2 | free | `fluent-player-dev/app/Services/MediaRenderer.php:329`, `fluent-player-dev/app/Services/MediaRenderer.php:359` |

::: warning `media_locked_message` fires twice with different second arguments
At `MediaRenderer.php:329` it is applied while building the **global** JS string, and the media ID argument is a literal `0`. At `MediaRenderer.php:359` it is applied for a **specific** item and receives the real `$mediaId`. A callback that branches on the ID must handle the `0` pass — see [Access & Gating](/hooks/access-gating#fluent-player-media-locked-message).

The `:359` site is also **conditional**: it is wrapped in `if ($message === '')` (`fluent-player-dev/app/Services/MediaRenderer.php:357`), so a caller that already has a message skips the filter. Pro's whole-playlist gate always supplies its own (`fluent-player-pro/app/Hooks/Handlers/PlaylistShortcodeHandler.php:113-114`), so `media_locked_message` never fires on the playlist path — use `fluent_player/playlist_password_message` there.
:::

::: warning `media_locked_html` can receive a **playlist** ID
`MediaRenderer::renderLockedForm()` is shared by the media gate and Pro's whole-playlist gate, which passes a `fluent_playlist` post ID (`fluent-player-pro/app/Hooks/Handlers/PlaylistShortcodeHandler.php:114`). A `media_locked_html` callback that resolves the second argument as a `fluent_player_media` post gets `null`. Branch on `get_post_type($mediaId)`.
:::

`behavior_can_report` defaults to **`true`** and is read through a negation at both call sites, so returning **`false`** is what disables FluentCRM behavior reporting. Its second argument is a three-key context array whose `ip` is empty at the print-time call site. See [Three inverted defaults](/hooks/access-gating#three-inverted-defaults).

## Media lifecycle

| Hook | Type | Args | Edition | Source |
|---|---|---|---|---|
| `fluent_player/after_delete_media` | action | 1 | free | `fluent-player-dev/app/Hooks/actions.php:156` |
| `fluent_player/after_save_media` | action | 2 | free | `fluent-player-dev/app/Http/Controllers/MediaController.php:116`, `fluent-player-dev/app/Http/Controllers/MediaController.php:145` |
| `fluent_player/before_delete_media` | action | 2 | free | `fluent-player-dev/app/Hooks/actions.php:138` |
| `fluent_player/default_media_status` | filter | 2 | free | `fluent-player-dev/app/Http/Controllers/MediaController.php:296` |
| `fluent_player/media_discoverable` | filter | 1 | free | `fluent-player-dev/app/Hooks/Handlers/FluentPlayerMediaCPT.php:107` |
| `fluent_player/media_page_noindex` | filter | 2 | free | `fluent-player-dev/app/Hooks/Handlers/FluentPlayerMediaCPT.php:120` |
| `fluent_player/media_status_changed` | action | 3 | free | `fluent-player-dev/app/Hooks/actions.php:38` |
| `fluent_player/media_tags_request` | filter | 3 | free | `fluent-player-dev/app/Http/Controllers/MediaController.php:392` |
| `fluent_player/register_media_taxonomies` | action | 0 | free | `fluent-player-dev/app/Hooks/Handlers/FluentPlayerMediaCPT.php:75` |

::: danger `media_discoverable` and `media_page_noindex` have inverted defaults
`media_discoverable` defaults to **`false`** — the locked-down state. Returning `true` is the permissive move: it site-wide un-hides every dedicated media page from `wp_robots`, WP core sitemaps, Yoast and Rank Math at once.

`media_page_noindex` defaults to **`true`** and is consumed through a negation (`if (!apply_filters(...)) return $robots;`), so returning **`false` is what makes a page indexable**.

Getting either polarity backwards publishes media you meant to keep unlisted. Both are explained with their consumers at [Access & Gating](/hooks/access-gating#three-inverted-defaults).
:::

## Media rendering

| Hook | Type | Args | Edition | Source |
|---|---|---|---|---|
| `fluent_player/allowed_html_tags` | filter | 1 | free | `fluent-player-dev/app/Helpers/Helper.php:1062`, `fluent-player-dev/boot/globals.php:547` |
| `fluent_player/allowed_media_providers` | filter | 1 | free | `fluent-player-dev/app/Services/MediaService.php:21` |
| `fluent_player/audio_extensions` | filter | 1 | free | `fluent-player-dev/app/Helpers/Helper.php:115` |
| `fluent_player/before_render_media` | action | 1 | free | `fluent-player-dev/app/Services/MediaRenderer.php:175` |
| `fluent_player/before_render_playlist` | action | 1 | **(Pro)** | `fluent-player-pro/app/Hooks/Handlers/PlaylistShortcodeHandler.php:58` |
| `fluent_player/block_media_attributes` | filter | 2 | free | `fluent-player-dev/app/Blocks/MediaBlock.php:253` |
| `fluent_player/block_media_output` | filter | 3 | free | `fluent-player-dev/app/Blocks/MediaBlock.php:301` |
| `fluent_player/default_preload` | filter | 3 | free | `fluent-player-dev/app/Services/SettingsService.php:481` |
| `fluent_player/global_vars` | filter | 1 | free | `fluent-player-dev/app/Blocks/FluentCommunityMediaBlock.php:532`, `fluent-player-dev/app/Services/MediaRenderer.php:339` |
| `fluent_player/link_new_tab` | filter | 1 | free | `fluent-player-dev/app/Helpers/Helper.php:1405` |
| `fluent_player/media_block_inner` | filter | 4 | free | `fluent-player-dev/app/Blocks/MediaBlock.php:291` |
| `fluent_player/media_block_vars` | filter | 2 | free | `fluent-player-dev/app/Blocks/MediaBlock.php:211` |
| `fluent_player/media_bulk_action` | filter | 4 | free | `fluent-player-dev/app/Services/MediaService.php:417` |
| `fluent_player/media_default_settings` | filter | 3 | free | `fluent-player-dev/app/Services/SettingsService.php:466` |
| `fluent_player/media_paginate_query` | filter | 2 | free | `fluent-player-dev/app/Services/MediaService.php:361` |
| `fluent_player/player_settings` | filter | 1 | both | `fluent-player-dev/app/Blocks/FluentCommunityMediaBlock.php:796` _(+4 more)_ |
| `fluent_player/pre_render_block_media` | filter | 3 | free | `fluent-player-dev/app/Blocks/MediaBlock.php:256` |
| `fluent_player/should_register_media_block` | filter | 1 | free | `fluent-player-dev/app/Blocks/MediaBlock.php:26` |

### `player_settings` — all five call sites

`fluent_player/player_settings` filters the per-media settings array (one argument). It is the widest seam in the render path — it runs on the main front-end render *before* the settings are handed to `wp_localize_script`, which is what lets Pro swap in signed CDN / DRM URLs:

| Call site | Context |
|---|---|
| `fluent-player-dev/app/Services/MediaRenderer.php:191` | **Primary** — main front-end render, before localization. |
| `fluent-player-dev/app/Http/Controllers/MediaController.php:105` | REST: single-media read. |
| `fluent-player-dev/app/Http/Controllers/MediaController.php:367` | REST: media data endpoint. |
| `fluent-player-dev/app/Blocks/FluentCommunityMediaBlock.php:796` | FluentCommunity embed render. |
| `fluent-player-pro/app/Hooks/Handlers/PlaylistShortcodeHandler.php:460` | **(Pro)** playlist item render. |

Because it fires on both render *and* REST paths, keep the callback cheap and idempotent. See [Media Rendering](/hooks/media-rendering#fluent-player-player-settings).

### `global_vars` — the frontend runtime config

`fluent_player/global_vars` is the only filter over the global JS config object shared by every player on the page. Dispatched at `fluent-player-dev/app/Services/MediaRenderer.php:339` (standard render) and `fluent-player-dev/app/Blocks/FluentCommunityMediaBlock.php:532` (FluentCommunity embed). See [Media Rendering](/hooks/media-rendering#fluent-player-global-vars).

::: warning The two call sites pass different array shapes
This is **not** one array filtered twice. Each site builds its own literal, and they share only `ajax_url`, `nonce`, `serverLang` and `audio_extensions`.

`MediaRenderer.php:306-339` additionally carries `has_pro`, `show_powered_by`, `trans`, `resume_playback`, `youtube`, `locked_message`, `external_tracked_media` (plus `analytics` / `google_analytics` under Pro). `FluentCommunityMediaBlock.php:532-541` instead carries `rest_url`, `rest_nonce`, `context` (always `'fluent-community'`) and `version`, and **none** of the render-path extras.

Guard every key you read with `isset()`, or branch on `$vars['context']`, which exists only on the community pass. Full comparison table on the [FluentCommunity page](/hooks/community).
:::

## Dynamic sources

| Hook | Type | Args | Edition | Source |
|---|---|---|---|---|
| `fluent_player/dynamic_source_meta_key_allowed` | filter | 2 | free | `fluent-player-dev/app/Services/DynamicMediaSourceResolver.php:211` |
| `fluent_player/dynamic_source_overrides` | filter | 5 | free | `fluent-player-dev/app/Services/DynamicMediaSourceResolver.php:194` |
| `fluent_player/dynamic_source_post_id` | filter | 2 | free | `fluent-player-dev/app/Services/DynamicMediaSourceResolver.php:217` |

## Analytics & progression

| Hook | Type | Args | Edition | Source |
|---|---|---|---|---|
| `fluent_player/external_tracked_media` | filter | 1 | free | `fluent-player-dev/app/Services/MediaRenderer.php:335` |
| `fluent_player/media_milestone` | action | 1 | free | `fluent-player-dev/app/Hooks/Handlers/AbstractBehaviorHandler.php:156` |
| `fluent_player/progression/policy` | filter | 4 | free | `fluent-player-dev/app/Services/Progression/ProgressionService.php:165` |
| `fluent_player/progression/verdict` | filter | 4 | free | `fluent-player-dev/app/Services/Progression/ProgressionService.php:185` |
| `fluent_player/watch_recorded` | action | 3 | free | `fluent-player-dev/app/Services/Progression/ProgressionService.php:187` |

### The two behavior actions are dispatched through a variable

`fluent_player/media_milestone` (here) and `fluent_player/layer_event` (under [Other](#other)) share **one** dispatch site — `fluent-player-dev/app/Hooks/Handlers/AbstractBehaviorHandler.php:156`:

```php
do_action($this->eventName(), $ctx);
```

`eventName()` is abstract (`:53`); each subclass returns a class constant, so **neither literal hook name appears at the dispatch site** and grepping the source for the string finds only the constant declarations:

| Hook | Returned by | Constant |
|---|---|---|
| `fluent_player/media_milestone` | `MediaMilestoneHandler::eventName()` (`fluent-player-dev/app/Hooks/Handlers/MediaMilestoneHandler.php:15-18`) | `BehaviorRegistry::TRIGGER_MILESTONE` (`fluent-player-dev/app/Integrations/FluentCrm/BehaviorRegistry.php:17`) |
| `fluent_player/layer_event` | `LayerEventHandler::eventName()` (`fluent-player-dev/app/Hooks/Handlers/LayerEventHandler.php:16-19`) | `BehaviorRegistry::TRIGGER_LAYER` (`fluent-player-dev/app/Integrations/FluentCrm/BehaviorRegistry.php:18`) |

Both are **free**, both take **one** argument, and both only exist on a site running FluentCRM — the handlers refuse to register otherwise (`AbstractBehaviorHandler.php:31-33`). Full payload shapes and consumers on the [Actions page](/hooks/actions#fluent-player-media-milestone).

## Email providers & export

| Hook | Type | Args | Edition | Source |
|---|---|---|---|---|
| `fluent_player/email_collected` | action | 4 | free | `fluent-player-dev/app/Hooks/Handlers/EmailCollectionHandler.php:92`, `fluent-player-dev/app/Hooks/Handlers/EmailCollectionHandler.php:122` |
| `fluent_player/email_collection_hooks` | action | 1 | free | `fluent-player-dev/app/Hooks/Handlers/EmailCollectionHandler.php:61` |
| `fluent_player/email_data` | filter | 3 | free | `fluent-player-dev/app/Services/EmailCollectionService.php:163` |
| `fluent_player/email_export_columns` | filter | 1 | free | `fluent-player-dev/app/Services/EmailProviderService.php:305` |
| `fluent_player/email_provider_meta` | filter | 1 | free | `fluent-player-dev/app/Services/EmailProviderService.php:210` |
| `fluent_player/email_provider_placeholder_meta` | filter | 1 | free | `fluent-player-dev/app/Services/EmailProviderService.php:202` |
| `fluent_player/email_providers` | filter | 3 | free | `fluent-player-dev/app/Hooks/Handlers/EmailCollectionHandler.php:103` |
| `fluent_player/email_styles` | filter | 1 | free | `fluent-player-dev/app/Services/EmailCollectionService.php:268` |
| `fluent_player/email_submission_rate_limit_max_attempts` | filter | 2 | free | `fluent-player-dev/app/Hooks/Handlers/EmailCollectionHandler.php:342` |
| `fluent_player/email_submission_rate_limit_window` | filter | 2 | free | `fluent-player-dev/app/Hooks/Handlers/EmailCollectionHandler.php:347` |
| `fluent_player/email_template` | filter | 3 | free | `fluent-player-dev/app/Services/EmailCollectionService.php:134` |
| `fluent_player/post_process_email_collection` | filter | 4 | free | `fluent-player-dev/app/Services/EmailCollectionService.php:340` |
| `fluent_player/post_process_email_provider` | filter | 4 | free | `fluent-player-dev/app/Services/EmailCollectionService.php:92` |
| `fluent_player/pre_process_email_collection` | filter | 4 | free | `fluent-player-dev/app/Services/EmailCollectionService.php:311` |
| `fluent_player/pre_process_email_provider` | filter | 4 | free | `fluent-player-dev/app/Services/EmailCollectionService.php:46` |
| `fluent_player/pre_process_email_submit` | filter | 2 | free | `fluent-player-dev/app/Hooks/Handlers/EmailCollectionHandler.php:77` |
| `fluent_player/provider_config` | filter | 4 | free | `fluent-player-dev/app/Services/EmailCollectionService.php:327` |
| `fluent_player/raw_request_data` | filter | 1 | free | `fluent-player-dev/app/Hooks/Handlers/EmailCollectionHandler.php:247` |
| `fluent_player/register_email_providers` | action | 0 | free | `fluent-player-dev/app/Services/EmailProviderService.php:35` |
| `fluent_player/submission_data` | filter | 3 | free | `fluent-player-dev/app/Hooks/Handlers/EmailCollectionHandler.php:116` |
| `fluent_player/validate_email_submission` | filter | 2 | free | `fluent-player-dev/app/Hooks/Handlers/EmailCollectionHandler.php:259` |

## Unlock & access tokens

| Hook | Type | Args | Edition | Source |
|---|---|---|---|---|
| `fluent_player/unlock_rate_key` | filter | 2 | free | `fluent-player-dev/app/Services/UnlockService.php:103` |
| `fluent_player/unlock_rate_limit` | filter | 1 | free | `fluent-player-dev/app/Services/UnlockService.php:90` |
| `fluent_player/unlock_token_ttl` | filter | 1 | free | `fluent-player-dev/app/Services/UnlockService.php:22` |
| `fluent_player/unlockable_post_types` | filter | 1 | free | `fluent-player-dev/app/Hooks/Handlers/UnlockHandler.php:36` |

The section title mentions access tokens because `UnlockService` mints two different credentials, but **the access-token surface has no hooks** — `issueAccessToken()` / `validateAccessToken()` are revoked site-wide through the `fluent_player_access_key_version` option instead. See [Access tokens](/hooks/unlock#access-tokens).

::: warning `unlockable_post_types` is dispatched by free but **modified by Pro**
Edition is `free` because the free plugin is the only tree that dispatches it. Pro nonetheless changes what you receive: `fluent-player-pro/app/Hooks/filters.php:164-167` appends `'fluent_playlist'`, so on a Pro site the array arrives with two entries rather than the `[fluent_player_media]` default. Always append; never return a hand-written list. There is also **no capability check** behind this filter — see [Unlock & Access Tokens](/hooks/unlock#fluent-player-unlockable-post-types).
:::

Both unlock rate-limit hooks count **failed** attempts only, in a bucket keyed on IP *and* media ID — see [`unlock_rate_limit`](/hooks/unlock#fluent-player-unlock-rate-limit).

## Smartcodes

| Hook | Type | Args | Edition | Source |
|---|---|---|---|---|
| `fluent_player/parse_smartcodes` | filter | 2 | free | `fluent-player-dev/app/Services/MediaService.php:698` |
| `fluent_player/smartcode_groups` | filter | 1 | free | `fluent-player-dev/app/Http/Controllers/SmartcodeController.php:30` |
| `fluent_player/smartcodes` | filter | 1 | free | `fluent-player-dev/app/Services/Smartcode/SmartcodeRegistry.php:21` |

## Playlist

| Hook | Type | Args | Edition | Source |
|---|---|---|---|---|
| `fluent_player/default_playlist_status` | filter | 2 | **(Pro)** | `fluent-player-pro/app/Http/Controllers/PlaylistController.php:169` |
| `fluent_player/frontend_playlist_settings` | filter | 3 | free | `fluent-player-dev/app/Services/SettingsService.php:569` |
| `fluent_player/playlist_discoverable` | filter | 1 | **(Pro)** | `fluent-player-pro/app/Hooks/Handlers/FluentPlaylistCPT.php:213` |
| `fluent_player/playlist_layout_classes` | filter | 1 | **(Pro)** | `fluent-player-pro/app/Layouts/BasePlaylistLayout.php:354` |
| `fluent_player/playlist_page_noindex` | filter | 2 | **(Pro)** | `fluent-player-pro/app/Hooks/Handlers/FluentPlaylistCPT.php:226` |
| `fluent_player/playlist_password_message` | filter | 2 | **(Pro)** | `fluent-player-pro/app/Hooks/Handlers/PlaylistShortcodeHandler.php:113` |
| `fluent_player/playlist_shortcode_defaults` | filter | 2 | **(Pro)** | `fluent-player-pro/app/Hooks/Handlers/PlaylistShortcodeHandler.php:46` |
| `fluent_player/playlist_video_text` | filter | 3 | **(Pro)** | `fluent-player-pro/app/Layouts/StandardPlaylistLayout.php:90` |

## FluentCommunity

| Hook | Type | Args | Edition | Source |
|---|---|---|---|---|
| `fluent_player/fluent_community_allowed_blocks` | filter | 1 | free | `fluent-player-dev/app/Blocks/FluentCommunityMediaBlock.php:168` |
| `fluent_player/fluent_community_block_vars` | filter | 2 | free | `fluent-player-dev/app/Blocks/FluentCommunityMediaBlock.php:485` |
| `fluent_player/fluent_community_enqueue_block_assets` | action | 0 | free | `fluent-player-dev/app/Blocks/FluentCommunityMediaBlock.php:449` |
| `fluent_player/fluent_community_iframe_assets` | filter | 3 | free | `fluent-player-dev/app/Blocks/FluentCommunityMediaBlock.php:375` |
| `fluent_player/fluent_community_layers` | filter | 2 | free | `fluent-player-dev/app/Services/LayerService.php:125` |
| `fluent_player/fluent_community_portal_data` | filter | 1 | free | `fluent-player-dev/app/Blocks/FluentCommunityMediaBlock.php:595` |

## Integrations

| Hook | Type | Args | Edition | Source |
|---|---|---|---|---|
| `fluent_player/fluentcrm_timeline_event_payload` | filter | 2 | free | `fluent-player-dev/app/Integrations/FluentCrm/TimelineBridge.php:232` |
| `fluent_player/integrations` | filter | 1 | both | `fluent-player-dev/app/Services/IntegrationService.php:41` _(+6 more)_ |
| `fluent_player/learndash/completed` | action | 4 | **(Pro)** | `fluent-player-pro/app/Integrations/LearnDash/LearnDashIntegration.php:518` |
| `fluent_player/webhook_data` | filter | 2 | **(Pro)** | `fluent-player-pro/app/Utils/Provider/Webhook.php:252` |
| `fluent_player/webhook_headers` | filter | 2 | **(Pro)** | `fluent-player-pro/app/Utils/Provider/Webhook.php:268` |

`fluent_player/integrations` is dispatched once by free (`fluent-player-dev/app/Services/IntegrationService.php:41`) and six more times by Pro services: `fluent-player-pro/app/Services/BunnyCDNService.php:17`, `:832`, `:927`, `fluent-player-pro/app/Services/BunnyCDNStorageService.php:46`, `fluent-player-pro/app/Services/GumletService.php:34`, and `fluent-player-pro/app/Services/MuxService.php:24`. A callback registered on it will run on every one of those passes.

## Hosted streaming

| Hook | Type | Args | Edition | Source |
|---|---|---|---|---|
| `fluent_player/mux_asset_errored` | action | 3 | **(Pro)** | `fluent-player-pro/app/Services/MuxService.php:1123` |
| `fluent_player/mux_asset_ready` | action | 3 | **(Pro)** | `fluent-player-pro/app/Services/MuxService.php:1095` |
| `fluent_player/mux_data` | filter | 2 | **(Pro)** | `fluent-player-pro/app/Services/MuxService.php:1407` |
| `fluent_player/mux_data_viewer_id` | filter | 2 | **(Pro)** | `fluent-player-pro/app/Services/MuxService.php:1389` |
| `fluent_player/mux_static_rendition_ready` | action | 2 | **(Pro)** | `fluent-player-pro/app/Services/MuxService.php:1227` |
| `fluent_player/mux_track_ready` | action | 3 | **(Pro)** | `fluent-player-pro/app/Services/MuxService.php:1212` |
| `fluent_player/mux_upload_asset_created` | action | 3 | **(Pro)** | `fluent-player-pro/app/Services/MuxService.php:1155` |
| `fluent_player/mux_webhook` | action | 2 | **(Pro)** | `fluent-player-pro/app/Services/MuxService.php:1039` |

## Page builders

| Hook | Type | Args | Edition | Source |
|---|---|---|---|---|
| `fluent_player/divi/is_visual_builder_request` | filter | 1 | free | `fluent-player-dev/app/PageBuilders/Divi/DiviPageBuilder.php:61` |
| `fluent_player/page_builders` | filter | 1 | free | `fluent-player-dev/app/Services/PageBuilderService.php:72` |

## Admin & i18n

| Hook | Type | Args | Edition | Source |
|---|---|---|---|---|
| `fluent_player/admin_translations` | filter | 2 | free | `fluent-player-dev/app/Services/Translations/TransStrings.php:12` |
| `fluent_player/frontend_translations` | filter | 2 | free | `fluent-player-dev/app/Services/Translations/TransStrings.php:18` |

## Other

| Hook | Type | Args | Edition | Source |
|---|---|---|---|---|
| `fluent_player/email_attachment_allowed_types` | filter | 1 | free | `fluent-player-dev/app/Http/Controllers/EmailProviderController.php:46` |
| `fluent_player/get_country_code_by_ip` | filter | 2 | **(Pro)** | `fluent-player-pro/app/Services/AnalyticsService.php:44` |
| `fluent_player/layer_event` | action | 1 | free | `fluent-player-dev/app/Hooks/Handlers/AbstractBehaviorHandler.php:156` |
| `fluent_player/media_data_rate_limit` | filter | 1 | free | `fluent-player-dev/app/Blocks/FluentCommunityMediaBlock.php:774` |
| `fluent_player/media_shortcode_defaults` | filter | 2 | free | `fluent-player-dev/app/Hooks/Handlers/MediaShortcodeHandler.php:80` |

`fluent_player/layer_event` lands in this residual bucket only because of the extractor's keyword grouping — it is the layer half of the FluentCRM behavior pair described under [Analytics & progression](#the-two-behavior-actions-are-dispatched-through-a-variable), and is documented in full on the [Actions page](/hooks/actions#fluent-player-layer-event).

`fluent_player/media_data_rate_limit` is not a request quota: the limiter runs only inside the failure branch of the media-data endpoint, so it counts **failed private-media fetch attempts** and nothing else (`fluent-player-dev/app/Blocks/FluentCommunityMediaBlock.php:768-778`). Valid fetches and ordinary published loads never advance it. Bucket is per-IP over a 60-second window — see [FluentCommunity](/hooks/community#fluent-player-media-data-rate-limit).

`fluent_player/media_shortcode_defaults` filters the attribute defaults for the `[fluentplayer]` shortcode (and its backward-compatible alias `[fluentmedia]`, registered at `fluent-player-dev/app/Hooks/actions.php:179-180`) — see the [Shortcode reference](/reference/shortcodes) for the attributes it seeds.

## Regenerating

This table is produced by the extractor, which walks `app/` and `boot/` in **both** plugin trees and matches all four dispatch forms (`do_action`, `apply_filters`, `$app->doAction`, `$app->applyFilters`):

```bash
# Defaults to the sibling fluent-player-dev + fluent-player-pro checkouts.
node bin/extract-hooks.mjs                     # writes _generated/hooks.{json,md}

# Or point it at explicit trees:
node bin/extract-hooks.mjs [freePath] [proPath]
```

`_generated/hooks.json` carries **every** occurrence of each hook, not just the first — use it when you need the secondary call sites. Test trees (`dev/`, `tests/`), `vendor/`, and build output are excluded so the counts reflect the shipped surface.

The extractor guarantees the **set**, the **edition**, and the **argument counts**; descriptions and examples on the group pages above are curated by hand. Grouping follows the extractor's keyword buckets, with one refinement: the unlock hooks are lifted out of its residual `Other` bucket into their own section here.

