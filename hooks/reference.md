---
title: "Full Hooks Reference"
description: "The complete set of FluentPlayer actions and filters, with type, callback argument count, and source location."
---

# Full Hooks Reference

Every action and filter in the free plugin tree: **10 actions, 66 filters**. Generated from source (`npm run extract:hooks`) and verified with `file:line`. "Args" is the number of arguments passed to your callback (add `, N` as the `accepted_args` in `add_action` / `add_filter`).

::: warning
Signatures can change between releases. Regenerate this table against your installed version with `node bin/extract-hooks.mjs` (see the [extractor scripts](#regenerating)).
:::

For argument names and runnable examples on the most-used hooks, see the curated pages: [Actions](/hooks/actions), [Access & Gating](/hooks/access-gating), [Dynamic Sources](/hooks/dynamic-sources), [Email Providers](/hooks/email), [Media Rendering](/hooks/media-rendering), [Progression](/hooks/progression).

## Access & gating

| Hook | Type | Args | Source |
|---|---|---|---|
| `fluent_player/access_denied_html` | filter | 3 | `app/Models/Media.php:335` |
| `fluent_player/access_denied_message` | filter | 3 | `app/Models/Media.php:327` |
| `fluent_player/media_locked_html` | filter | 2 | `app/Services/MediaRenderer.php:285` |
| `fluent_player/media_locked_message` | filter | 2 | `app/Services/MediaRenderer.php:241` |

## Media lifecycle

| Hook | Type | Args | Source |
|---|---|---|---|
| `fluent_player/before_delete_media` | action | 2 | `app/Hooks/actions.php:128` |
| `fluent_player/after_delete_media` | action | 1 | `app/Hooks/actions.php:146` |
| `fluent_player/after_save_media` | action | 2 | `app/Http/Controllers/MediaController.php:116` |
| `fluent_player/register_media_taxonomies` | action | 0 | `app/Hooks/Handlers/FluentPlayerMediaCPT.php:74` |

## Media rendering

| Hook | Type | Args | Source |
|---|---|---|---|
| `fluent_player/before_render_media` | action | 1 | `app/Services/MediaRenderer.php:95` |
| `fluent_player/block_media_output` | filter | 3 | `app/Blocks/MediaBlock.php:285` |
| `fluent_player/block_media_attributes` | filter | 2 | `app/Blocks/MediaBlock.php:253` |
| `fluent_player/media_block_vars` | filter | 2 | `app/Blocks/MediaBlock.php:211` |
| `fluent_player/media_block_inner` | filter | 4 | `app/Blocks/MediaBlock.php:275` |
| `fluent_player/pre_render_block_media` | filter | 3 | `app/Blocks/MediaBlock.php:256` |
| `fluent_player/should_register_media_block` | filter | 1 | `app/Blocks/MediaBlock.php:26` |
| `fluent_player/media_default_settings` | filter | 3 | `app/Services/SettingsService.php:466` |
| `fluent_player/default_preload` | filter | 3 | `app/Services/SettingsService.php:481` |
| `fluent_player/allowed_media_providers` | filter | 1 | `app/Services/MediaService.php:21` |
| `fluent_player/audio_extensions` | filter | 1 | `app/Helpers/Helper.php:115` |
| `fluent_player/allowed_html_tags` | filter | 1 | `app/Helpers/Helper.php:1024` |
| `fluent_player/link_new_tab` | filter | 1 | `app/Helpers/Helper.php:1349` |
| `fluent_player/media_bulk_action` | filter | 4 | `app/Services/MediaService.php:407` |
| `fluent_player/media_paginate_query` | filter | 2 | `app/Services/MediaService.php:351` |

## Dynamic sources

| Hook | Type | Args | Source |
|---|---|---|---|
| `fluent_player/dynamic_source_overrides` | filter | 5 | `app/Services/DynamicMediaSourceResolver.php:194` |
| `fluent_player/dynamic_source_post_id` | filter | 2 | `app/Services/DynamicMediaSourceResolver.php:217` |
| `fluent_player/dynamic_source_meta_key_allowed` | filter | 2 | `app/Services/DynamicMediaSourceResolver.php:211` |
| `fluent_player/external_tracked_media` | filter | 1 | `app/Services/MediaRenderer.php:247` |

## Email providers & export

| Hook | Type | Args | Source |
|---|---|---|---|
| `fluent_player/email_collected` | action | 4 | `app/Hooks/Handlers/EmailCollectionHandler.php:92` |
| `fluent_player/email_collection_hooks` | action | 1 | `app/Hooks/Handlers/EmailCollectionHandler.php:61` |
| `fluent_player/register_email_providers` | action | 0 | `app/Services/EmailProviderService.php:35` |
| `fluent_player/email_providers` | filter | 3 | `app/Hooks/Handlers/EmailCollectionHandler.php:103` |
| `fluent_player/email_data` | filter | 3 | `app/Services/EmailCollectionService.php:163` |
| `fluent_player/email_template` | filter | 3 | `app/Services/EmailCollectionService.php:134` |
| `fluent_player/email_styles` | filter | 1 | `app/Services/EmailCollectionService.php:268` |
| `fluent_player/email_export_columns` | filter | 1 | `app/Services/EmailProviderService.php:305` |
| `fluent_player/email_provider_meta` | filter | 1 | `app/Services/EmailProviderService.php:210` |
| `fluent_player/email_provider_placeholder_meta` | filter | 1 | `app/Services/EmailProviderService.php:202` |
| `fluent_player/pre_process_email_provider` | filter | 4 | `app/Services/EmailCollectionService.php:46` |
| `fluent_player/post_process_email_provider` | filter | 4 | `app/Services/EmailCollectionService.php:92` |
| `fluent_player/pre_process_email_collection` | filter | 4 | `app/Services/EmailCollectionService.php:311` |
| `fluent_player/post_process_email_collection` | filter | 4 | `app/Services/EmailCollectionService.php:340` |
| `fluent_player/provider_config` | filter | 4 | `app/Services/EmailCollectionService.php:327` |
| `fluent_player/pre_process_email_submit` | filter | 2 | `app/Hooks/Handlers/EmailCollectionHandler.php:77` |
| `fluent_player/submission_data` | filter | 3 | `app/Hooks/Handlers/EmailCollectionHandler.php:116` |
| `fluent_player/raw_request_data` | filter | 1 | `app/Hooks/Handlers/EmailCollectionHandler.php:247` |
| `fluent_player/validate_email_submission` | filter | 2 | `app/Hooks/Handlers/EmailCollectionHandler.php:259` |
| `fluent_player/email_submission_rate_limit_max_attempts` | filter | 2 | `app/Hooks/Handlers/EmailCollectionHandler.php:342` |
| `fluent_player/email_submission_rate_limit_window` | filter | 2 | `app/Hooks/Handlers/EmailCollectionHandler.php:347` |
| `fluent_player/email_attachment_allowed_types` | filter | 1 | `app/Http/Controllers/EmailProviderController.php:46` |

## Progression

| Hook | Type | Args | Source |
|---|---|---|---|
| `fluent_player/progression/policy` | filter | 4 | `app/Services/Progression/ProgressionService.php:165` |
| `fluent_player/progression/verdict` | filter | 4 | `app/Services/Progression/ProgressionService.php:185` |
| `fluent_player/watch_recorded` | action | 3 | `app/Services/Progression/ProgressionService.php:187` |

## Unlock / access tokens

| Hook | Type | Args | Source |
|---|---|---|---|
| `fluent_player/unlock_token_ttl` | filter | 1 | `app/Services/UnlockService.php:22` |
| `fluent_player/unlock_rate_limit` | filter | 1 | `app/Services/UnlockService.php:90` |
| `fluent_player/unlock_rate_key` | filter | 2 | `app/Services/UnlockService.php:103` |
| `fluent_player/unlockable_post_types` | filter | 1 | `app/Hooks/Handlers/UnlockHandler.php:36` |

## Smartcodes

| Hook | Type | Args | Source |
|---|---|---|---|
| `fluent_player/smartcodes` | filter | 1 | `app/Services/Smartcode/SmartcodeRegistry.php:21` |
| `fluent_player/smartcode_groups` | filter | 1 | `app/Http/Controllers/SmartcodeController.php:30` |
| `fluent_player/parse_smartcodes` | filter | 2 | `app/Services/MediaService.php:688` |

## Integrations

| Hook | Type | Args | Source |
|---|---|---|---|
| `fluent_player/integrations` | filter | 1 | `app/Services/IntegrationService.php:41` |

## FluentCommunity

| Hook | Type | Args | Source |
|---|---|---|---|
| `fluent_player/fluent_community_allowed_blocks` | filter | 1 | `app/Blocks/FluentCommunityMediaBlock.php:168` |
| `fluent_player/fluent_community_block_vars` | filter | 2 | `app/Blocks/FluentCommunityMediaBlock.php:485` |
| `fluent_player/fluent_community_iframe_assets` | filter | 3 | `app/Blocks/FluentCommunityMediaBlock.php:375` |
| `fluent_player/fluent_community_portal_data` | filter | 1 | `app/Blocks/FluentCommunityMediaBlock.php:591` |
| `fluent_player/fluent_community_layers` | filter | 2 | `app/Services/LayerService.php:125` |
| `fluent_player/fluent_community_enqueue_block_assets` | action | 0 | `app/Blocks/FluentCommunityMediaBlock.php:449` |
| `fluent_player/player_settings` | filter | 1 | `app/Blocks/FluentCommunityMediaBlock.php:775` |

## Playlist

| Hook | Type | Args | Source |
|---|---|---|---|
| `fluent_player/frontend_playlist_settings` | filter | 3 | `app/Services/SettingsService.php:569` |

## Settings, shortcode & page builders

| Hook | Type | Args | Source |
|---|---|---|---|
| `fluent_player/settings_section/{$section}` | filter | 2 | `app/Services/SettingsService.php:141` |
| `fluent_player/media_shortcode_defaults` | filter | 2 | `app/Hooks/Handlers/MediaShortcodeHandler.php:39` |
| `fluent_player/media_tags_request` | filter | 3 | `app/Http/Controllers/MediaController.php:388` |
| `fluent_player/page_builders` | filter | 1 | `app/Services/PageBuilderService.php:45` |
| `fluent_player/divi/is_visual_builder_request` | filter | 1 | `app/PageBuilders/Divi/DiviPageBuilder.php:42` |

## Admin & i18n

| Hook | Type | Args | Source |
|---|---|---|---|
| `fluent_player/admin_notices` | filter | 1 | `app/Hooks/Handlers/AdminMenuHandler.php:375` |
| `fluent_player/admin_translations` | filter | 2 | `app/Services/Translations/TransStrings.php:12` |
| `fluent_player/frontend_translations` | filter | 2 | `app/Services/Translations/TransStrings.php:18` |

## Regenerating

This table is produced by the extractor, which walks the plugin's `app/` for `do_action` / `apply_filters` calls:

```bash
node bin/extract-hooks.mjs [pluginPath]   # writes _generated/hooks.{json,md}
```

The extractor guarantees the **set** and **argument counts**; curate names and examples on the group pages above.
