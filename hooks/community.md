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

**Type:** filter · **Source:** `app/Blocks/FluentCommunityMediaBlock.php:591`

Filters the data payload sent to the FluentCommunity portal.

| Arg | Type | Description |
|---|---|---|
| `$data` | `array` | Portal data payload. |

## Related

- `fluent_player/player_settings` (filter, 1 arg) — `app/Blocks/FluentCommunityMediaBlock.php:775`.
- `fluent_player/fluent_community_enqueue_block_assets` (action, 0 args) — `app/Blocks/FluentCommunityMediaBlock.php:449`, fires while community block assets are enqueued.
