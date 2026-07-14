# FluentPlayer — Developer Surface Map

The developer-facing API of the FluentPlayer plugin at
`/Volumes/Projects/work/forms/wp-content/plugins/fluent-player`.
Always loaded by `fluentplayer-dev-code-to-docs` before extracting or diffing.

Counts are a **snapshot** for orientation — the extractor scripts are the source of truth per release.
Hook prefix is `fluent_player/`. REST is the WPFluent router (`app/Http/Routes/`), each group guarded by a policy.

**Latest extraction (free tree):** 10 actions, 66 filters (`npm run extract:hooks`); 9 route groups, 45 routes (`npm run extract:routes`). Regenerate into `_generated/` before each sync.

> **Free vs Pro.** This is the **free** plugin tree. Pro adds more hooks/routes (analytics, layers, playlists,
> Mux/Bunny, timed content). Mark Pro-only hooks/endpoints and verify against the Pro build or the user before
> documenting them as available.

---

## 1. Action hooks — `do_action('fluent_player/…')`  (12 in free tree)

| Action | Fired from | Doc group |
|---|---|---|
| `before_save_media` / `after_save_media` | media CRUD (`MediaService`, `MediaController`) | Media lifecycle |
| `before_delete_media` / `after_delete_media` | media delete | Media lifecycle |
| `before_render_media` | render pipeline (`MediaRenderer`) | Rendering |
| `email_collected` | email capture submit (`EmailCollectionService`) | Email capture |
| `email_collection_hooks` | email capture wiring | Email capture |
| `register_email_providers` | provider registry (`EmailProviderService`) | Extension point |
| `register_media_taxonomies` | taxonomy registration | Media / taxonomy |
| `watch_recorded` | watch tracking (`Progression`, `MediaWatchTracker`) | Progression / analytics |
| `fluent_community_enqueue_block_assets` | FluentCommunity integration | Community |

**Verify live:** `grep -rhoE "do_action\(\s*['\"]fluent_player/[a-z0-9_/]+" app | sort -u`

---

## 2. Filter hooks — `apply_filters('fluent_player/…')`  (62 in free tree)

Groups (for the hooks-reference IA):

- **Media output & rendering** — `block_media_output`, `block_media_inner` / `media_block_inner`, `block_media_attributes`, `media_block_vars`, `media_default_settings`, `default_preload`, `allowed_media_providers`, `audio_extensions`, `allowed_html_tags`, `link_new_tab`.
- **Access control & gating** — `access_denied_html`, `access_denied_message`, `media_locked_html`, `media_locked_message`.
- **Dynamic media sources** — `dynamic_source_overrides`, `dynamic_source_post_id`, `dynamic_source_meta_key_allowed`, `external_tracked_media`.
- **Email providers & export** — `email_providers`, `email_provider_meta`, `email_provider_placeholder_meta`, `email_data`, `email_export_columns`, `email_template`, `email_styles`.
- **Integrations** — `integrations`.
- **FluentCommunity** — `fluent_community_allowed_blocks`, `fluent_community_block_vars`, `fluent_community_iframe_assets`, `fluent_community_layers`, `fluent_community_portal_data`.
- **Playlist** — `frontend_playlist_settings`.
- **Admin / i18n** — `admin_notices`, `admin_translations`, `frontend_translations`, `media_bulk_action`, `media_paginate_query`.
- **Page builders** — `divi/is_visual_builder_request`.

**Verify live:** `grep -rhoE "apply_filters\(\s*['\"]fluent_player/[a-z0-9_/]+" app | sort -u`

---

## 3. REST API — WPFluent router (`app/Http/Routes/{api,routes}.php`)  (~45 routes)

Route groups (prefix → policy → controller):

| Prefix | Policy | Controller | Doc page |
|---|---|---|---|
| `media` | `MediaPolicy` | `MediaController` | `rest-api/media` |
| `presets` | `PresetPolicy` | `PresetController` | `rest-api/presets` |
| `settings` | `SettingsPolicy` | `SettingsController` | `rest-api/settings` |
| `integrations` | `SettingsPolicy` | `IntegrationController` | `rest-api/integrations` |
| `email-providers` | `SettingsPolicy` | `EmailProviderController` | `rest-api/email-providers` |
| `youtube` | `SettingsPolicy` | `YouTubeController` | `rest-api/youtube` |
| `layer` | `LayerPolicy` | `LayerController` | `rest-api/layers` |
| `smartcodes` | `SettingsPolicy` | `SmartcodeController` | `rest-api/smartcodes` |
| `migration` | `MigrationPolicy` | `MigrationController` | `rest-api/migration` |

- Base namespace is registered by WPFluent (confirm the exact `wp-json/<slug>/vN` base with the extractor — do not hard-code a version).
- Every endpoint requires the group's policy (a `current_user_can`-style gate). Document the required capability per group.
- **Verify live:** parse `$router->prefix(...)->...->group(...)` blocks and the `->get/post/put/delete(` lines within.

---

## 4. Extension points (base classes / registries)

| Point | Source | Registered via | Doc guide |
|---|---|---|---|
| Custom email provider | `app/EmailProviders/AbstractEmailProvider.php` (ref impl `FluentCRMProvider.php`) | `do_action('fluent_player/register_email_providers')` + `email_providers` filter | `extending/custom-email-provider` |
| Custom integration | `app/Integrations/AbstractIntegration.php` | `integrations` filter / `IntegrationService` | `extending/custom-integration` |
| Dynamic media source | `app/Services/DynamicMediaSourceResolver.php` | `dynamic_source_*` filters | `extending/dynamic-media-sources` |
| Custom smartcodes | `app/Services/Smartcode/*`, `SmartcodeController` | smartcode registry | `extending/custom-smartcodes` |
| Progression / completion | `app/Services/Progression/*`, `resources/js/progression/*`, `resources/progression/conformance.json` | mirrored PHP+JS evaluator + `watch_recorded` | `extending/progression` |

---

## 5. Frontend / JS API

| Surface | Source | Doc page |
|---|---|---|
| Player instance & events | `resources/js/FluentPlayer.js`, `fluent-player.js` | `js-api/player-events` |
| Layers manager | `resources/js/LayersManager.js` | `js-api/layers` |
| Analytics events | `resources/js/AnalyticsTracker.js` | `js-api/analytics-events` |
| Watch/progression | `resources/js/MediaWatchTracker.js`, `resources/js/progression/*` | `js-api/watch-tracking` |
| Playlist | `resources/js/FluentPlaylist.js` | `js-api/playlist` |

The player is **Vidstack 1.12.5 + hls.js**. Document events FluentPlayer emits/consumes, not Vidstack internals — link out to Vidstack for the underlying element.

---

## How to update this map
- **Per release:** re-run the extractors; update counts and add/flag new/changed/removed hooks and routes.
- **When a new base class / registry ships:** add it to §4 and point to the matching `extending/` guide.
- Keep this in sync with `fluentplayer-user-docs/.claude/plugin-memory/CATALOG.md` (the user-facing module map) — they describe the same plugin from two angles.
