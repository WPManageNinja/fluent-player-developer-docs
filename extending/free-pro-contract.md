---
title: "Free → Pro Hook Contract"
description: "The 27 free-plugin hooks FluentPlayer Pro itself binds — the de-facto public API — plus the version guards and what stability actually guarantees."
---

# Free → Pro Hook Contract

The [hooks overview](/hooks/) warns that names and signatures can change between releases. True — but not equally true of every hook. Every hook FluentPlayer Pro **binds** is one WPManageNinja cannot change without breaking their own product in the same release.

That makes those hooks the **de-facto public API**. This page lists them.

::: danger Hooks are the documented seam — they are not the only coupling
Do not read this page as "Pro talks to free only through hooks". It does not. Pro calls free PHP classes directly and pervasively, by fully-qualified name:

| Free class | Used by Pro for | Example |
|---|---|---|
| `FluentPlayer\App\Http\Policies\MediaPolicy` | authorization on Pro's own REST routes | `fluent-player-pro/app/Http/Routes/api.php:11`, `:25` |
| `FluentPlayer\App\Http\Policies\SettingsPolicy` | same, for infrastructure routes | `fluent-player-pro/app/Http/Routes/api.php:97` |
| `FluentPlayer\App\Services\SettingsService` | reading settings sections | `fluent-player-pro/app/Services/SubtitleService.php:73` |
| `FluentPlayer\App\Services\EmailProviderService` | registering providers, statically | `fluent-player-pro/app/Hooks/actions.php:24`, `:29`, `:83`, `:86` |
| `FluentPlayer\App\Integrations\AbstractIntegration` | every hosted-streaming integration extends it | `fluent-player-pro/app/Integrations/GumletIntegration.php:5`, `:9` |
| `FluentPlayer\App\Models\Media`, `FluentPlayer\App\Helpers\Helper` | throughout Pro's services and controllers |  |

The one `@deprecated` shim in the free plugin exists precisely because of this. Its docblock (`app/EmailProviders/FluentCRMProvider.php:10-16`) says so outright: *"Kept because released Fluent Player Pro (ConditionService) references this class path and its identity statics — remove once `FLUENT_PLAYER_MIN_PRO_VERSION` guarantees the new imports."* That is a class-path dependency, not a hook dependency.

So the hooks are the **supported, documented** extension surface for third parties — but "Pro binds it" is evidence of stability, not evidence that hooks are the whole interface. Your own add-on should still stay on the hooks plus the two documented base classes (see [Practical guidance](#practical-guidance)).
:::

::: warning What this page is, and is not
This is an **observation about the source**, not a documented guarantee. FluentPlayer ships no deprecation policy: there is no `_deprecated_hook()`, no `apply_filters_deprecated()`, and no `do_action_deprecated()` anywhere in the free plugin, and exactly one `@deprecated` docblock in the whole codebase (`app/EmailProviders/FluentCRMProvider.php:11`). Nothing promises you a migration window.

What it does mean: a change to one of these 27 hooks requires a coordinated free + Pro release, so it is far less likely to happen quietly, and far more likely to be called out in the changelog. Verified against free `1.3.0` and Pro `1.3.0`.
:::

## Stability tiers

| Tier | What it covers | Practical risk |
|---|---|---|
| **Tier 1 — Pro-bound** | The 27 hooks below. Dispatched by free, subscribed to by Pro. | Lowest. Breaking one breaks Pro. |
| **Tier 2 — free-only, documented** | Hooks with a curated page under [Hooks & Filters](/hooks/). | Moderate. Signatures verified per release, but nothing in-repo depends on them. |
| **Tier 3 — free-only, undocumented** | Everything else in the [Full Reference](/hooks/reference). | Highest. Some exist for one internal caller and may be refactored away. |
| **Tier 4 — Pro-dispatched** | Hooks fired only by Pro (marked **(Pro)**). | Depends on your Pro version, and Pro moves faster than free. |

Pin your tested versions regardless of tier.

## The 27 Pro-bound hooks

Derived by scanning the Pro repo for `add_action` / `add_filter` / `addAction` / `addFilter` on a `fluent_player/` name, then intersecting with the names the **free** plugin dispatches. The [reproduce script](#reproduce-the-list-yourself) below is the exact procedure; it is not `_generated/hooks.json` — see the warning under it for why.

Free paths are relative to `fluent-player-dev/`, Pro paths to `fluent-player-pro/`.

| Hook | Type | Args | Dispatched (free) | Bound (Pro) |
|---|---|---|---|---|
| `fluent_player/loaded` | action | 1 | `boot/app.php:34` | `boot/app.php:13` |
| `fluent_player/admin_vars` | filter | 1 | `app/Hooks/Handlers/AdminMenuHandler.php:382` | `app/Hooks/filters.php:147`, `app/Hooks/Handlers/FluentPlaylistCPT.php:95` |
| `fluent_player/admin_notices` | filter | 1 | `app/Hooks/Handlers/AdminMenuHandler.php:375` | `boot/app.php:37` |
| `fluent_player/player_settings` | filter | 1 | `app/Services/MediaRenderer.php:191`, `app/Http/Controllers/MediaController.php:105`, `:367`, `app/Blocks/FluentCommunityMediaBlock.php:796` | `app/Hooks/filters.php:32`, `:37`, `:42`, `:47`, `:48` |
| `fluent_player/media_block_vars` | filter | 2 | `app/Blocks/MediaBlock.php:211` | `app/Hooks/filters.php:92`, `:109`, `:145` |
| `fluent_player/media_block_inner` | filter | 4 | `app/Blocks/MediaBlock.php:291` | `app/Hooks/filters.php:50` |
| `fluent_player/before_render_media` | action | 1 | `app/Services/MediaRenderer.php:175` | `app/Hooks/Handlers/CustomCssHandler.php:22` |
| `fluent_player/after_save_media` | action | 2 | `app/Http/Controllers/MediaController.php:116`, `:145` | `app/Hooks/actions.php:36` |
| `fluent_player/before_delete_media` | action | 2 | `app/Hooks/actions.php:138` | `app/Hooks/actions.php:63` |
| `fluent_player/after_delete_media` | action | 1 | `app/Hooks/actions.php:156` | `app/Hooks/actions.php:74` |
| `fluent_player/media_paginate_query` | filter | 2 | `app/Services/MediaService.php:361` | `app/Hooks/actions.php:43` |
| `fluent_player/media_bulk_action` | filter | 4 | `app/Services/MediaService.php:417` | `app/Hooks/filters.php:169` |
| `fluent_player/media_tags_request` | filter | 3 | `app/Http/Controllers/MediaController.php:392` | `app/Hooks/filters.php:55` |
| `fluent_player/register_media_taxonomies` | action | 0 | `app/Hooks/Handlers/FluentPlayerMediaCPT.php:75` | `app/Hooks/actions.php:35` |
| `fluent_player/register_email_providers` | action | 0 | `app/Services/EmailProviderService.php:35` | `app/Hooks/actions.php:22`, `:82` |
| `fluent_player/integrations` | filter | 1 | `app/Services/IntegrationService.php:41` | `app/Hooks/filters.php:19` |
| `fluent_player/daily_cleanup` | action (cron) | 0 | `app/Hooks/Handlers/ScheduledCleanupHandler.php:9` | `app/Hooks/actions.php:59`, `:60` |
| `fluent_player/watch_recorded` | action | 3 | `app/Services/Progression/ProgressionService.php:187` | `app/Hooks/Handlers/WatchProgressBridge.php:23`, `app/Integrations/LearnDash/LearnDashIntegration.php:55` |
| `fluent_player/progression/policy` | filter | 4 | `app/Services/Progression/ProgressionService.php:165` | `app/Integrations/LearnDash/LearnDashIntegration.php:53` |
| `fluent_player/external_tracked_media` | filter | 1 | `app/Services/MediaRenderer.php:335` | `app/Integrations/LearnDash/LearnDashIntegration.php:54` |
| `fluent_player/unlockable_post_types` | filter | 1 | `app/Hooks/Handlers/UnlockHandler.php:36` | `app/Hooks/filters.php:164` |
| `fluent_player/fluent_community_portal_data` | filter | 1 | `app/Blocks/FluentCommunityMediaBlock.php:595` | `app/Hooks/Handlers/FluentCommunityPlaylistBlock.php:27` |
| `fluent_player/fluent_community_allowed_blocks` | filter | 1 | `app/Blocks/FluentCommunityMediaBlock.php:168` | `app/Hooks/Handlers/FluentCommunityPlaylistBlock.php:28` |
| `fluent_player/fluent_community_enqueue_block_assets` | action | 0 | `app/Blocks/FluentCommunityMediaBlock.php:449` | `app/Hooks/Handlers/FluentCommunityPlaylistBlock.php:29` |
| `fluent_player/fluent_community_iframe_assets` | filter | 3 | `app/Blocks/FluentCommunityMediaBlock.php:375` | `app/Hooks/Handlers/FluentCommunityPlaylistBlock.php:30` |
| `fluent_player/fluent_community_block_vars` | filter | 2 | `app/Blocks/FluentCommunityMediaBlock.php:485` | `app/Hooks/filters.php:93`, `:110` |
| `fluent_player/settings_section/subtitle_service` | filter | 2 | `app/Services/SettingsService.php:141` (interpolated — see below) | `app/Hooks/filters.php:157-158` |

### Re-dispatched, not bound

One hook is easy to mistake for a member of the list and is **not** one:

| Hook | Dispatched (free) | What Pro actually does |
|---|---|---|
| `fluent_player/can_view_media` | `app/Models/Media.php:302` | **Re-dispatches** it at `app/Hooks/Handlers/PlaylistShortcodeHandler.php:292` so per-item playlist gating uses the same rule. Pro registers no callback on it in production code — the only `add_filter` for this name in the Pro repo is in a test (`dev/wp-browser/tests/Integration/Hooks/PlaylistAccessFilterTest.php:155`). |

The practical difference matters: because Pro *fires* it rather than *listening* to it, a filter **you** add runs on both the single-media and the playlist paths, and can run more than once per request. It is not protected by the "breaking it breaks Pro" argument in the same way — Pro would keep working if free stopped dispatching it, it would just stop gating.

### Reproduce the list yourself

```bash
FREE=wp-content/plugins/fluent-player-dev
PRO=wp-content/plugins/fluent-player-pro

# Both sides need -A1: the hook name is frequently on the line AFTER the call,
# e.g. Pro app/Hooks/filters.php:157-158 and free ProgressionService.php:165-166.

# What Pro subscribes to
grep -rhA1 -E "(addAction|addFilter|add_action|add_filter)\(" "$PRO/app" "$PRO/boot" \
  | grep -oE "fluent_player/[a-z_/]+" | sort -u > /tmp/pro-bound.txt

# What free dispatches
grep -rhA1 -E "(do_action|doAction|apply_filters|applyFilters)\(" "$FREE/app" "$FREE/boot" \
  | grep -oE "fluent_player/[a-z_/]+" | sort -u > /tmp/free-dispatched.txt

comm -12 /tmp/pro-bound.txt /tmp/free-dispatched.txt   # → 25 names
comm -23 /tmp/pro-bound.txt /tmp/free-dispatched.txt   # → 3 names needing a decision
```

Run against free `1.3.0` / Pro `1.3.0` this yields **25** names directly, plus **2** of the 3 in the second list — **27**, exactly the table above.

::: danger Do not derive this list from `_generated/hooks.json`
An earlier version of this page told you to keep the entries with `"free": true` **and** `"pro": true`. That is wrong and returns **5 names**, not 27. Those flags mean *"dispatched somewhere in free"* and *"dispatched somewhere in Pro"* — neither one means *"bound by Pro"*. Row 1 of the table above is the counter-example: `fluent_player/loaded` is `free: true, pro: false` yet Pro's entire bootstrap hangs off it.
:::

The second command lists the three names Pro binds that the free-side grep does not see. Two of them belong in the contract, one does not:

- **`fluent_player/daily_cleanup` — include it.** A WP-Cron hook has no literal dispatch site: it is a `const CRON_HOOK` handed to `wp_schedule_event()` (`app/Hooks/Handlers/ScheduledCleanupHandler.php:9`). `add_action()` works normally; grep simply cannot find the firing.
- **`fluent_player/settings_section/subtitle_service` — include it.** Free dispatches it **interpolated**, as <code v-pre>apply_filters("fluent_player/settings_section/{$section}", $sectionSettings, $settings)</code> at `app/Services/SettingsService.php:141`, so the literal name only ever appears on the Pro side (`app/Hooks/filters.php:157-158`). `_generated/hooks.json` records it under the placeholder <code v-pre>fluent_player/settings_section/{$section}</code> with `pro: false` — searching that file for the real name finds nothing, which is exactly how this hook went undocumented. `subtitle_service` is a real free settings section (`app/Services/SettingsService.php:59`); any other section name produces its own filter by the same rule.
- **`fluent_player/playlist_layout_classes` — exclude it.** Pro both dispatches (`fluent-player-pro/app/Layouts/BasePlaylistLayout.php:355`) and binds (`fluent-player-pro/app/Blocks/PlaylistBlock.php:171`) it. Free never fires it, so it is Tier 4, not Tier 1.

`fluent_player/can_view_media` drops out of the intersection on its own, and correctly — see [Re-dispatched, not bound](#re-dispatched-not-bound).

## The high-traffic contract points

### `fluent_player/loaded`

**Action · 1 arg · `boot/app.php:34`.** Fired inside `plugins_loaded`, with the WPFluent application as the argument. Pro's entire bootstrap hangs off it (`boot/app.php:13`) — this is where a companion plugin starts.

```php
add_action('fluent_player/loaded', function ($app) {
    // FluentPlayer is fully booted here. Register your hooks now.
});
```

### `fluent_player/admin_vars`

**Filter · 1 arg · `app/Hooks/Handlers/AdminMenuHandler.php:382`.** The last thing that touches the array before `wp_localize_script()` puts it on the page as `window.fluentFrameworkAdmin`. Pro adds licensing state (`app/Hooks/filters.php:147`) and playlist CPT data (`app/Hooks/Handlers/FluentPlaylistCPT.php:95`). This is the seam for pushing config into the Vue admin.

### `fluent_player/can_view_media` *(re-dispatched, not Tier 1)*

**Filter · 2 args (`$visible`, `$media`) · `app/Models/Media.php:302`.** The access decision for a single media item, applied on top of `isStatusEmbeddable()`. Listed here because it is high-traffic, **not** because Pro binds it — Pro **re-dispatches** it (`app/Hooks/Handlers/PlaylistShortcodeHandler.php:292`) so per-item playlist gating uses the same rule. A filter you add is therefore consulted on both the single-media and the playlist paths — return `false` to hide, and never assume it runs only once per request.

### `fluent_player/player_settings`

**Filter · 1 arg · four dispatch sites.** The final settings payload handed to the frontend runtime, and the most heavily subscribed hook in the contract: Pro binds it **five times**, once per hosted-streaming service that has to rewrite a URL at render time.

| Pro binding | Service | Does |
|---|---|---|
| `app/Hooks/filters.php:32` | `MuxService::filterPlayerSettings` | Signed playback URLs, DRM tokens, Mux Data env key |
| `:37` | `BunnyCDNService::filterPlayerSettings` | Signed/tokenized Stream and Storage URLs |
| `:42` | `GumletService::filterPlayerSettings` | Signed URLs for private Gumlet assets |
| `:47` | `R2Service::filterPlayerSettings` | Public playback URL for Cloudflare R2 |
| `:48` | `CloudflareStreamService::filterPlayerSettings` | Public playback URL for Cloudflare Stream |

Because it fires on the REST, block-render, and FluentCommunity paths, anything you add here reaches every surface. Five callbacks also run at the same priority (`10`), so ordering between them is registration order — do not depend on running after a specific one.

### `fluent_player/settings_section/subtitle_service`

**Filter · 2 args (`$sectionSettings`, `$settings`) · `app/Services/SettingsService.php:141`.** The only member of the contract whose name is built by interpolation, and therefore the only one you cannot find by grepping the free plugin. Pro binds it at `app/Hooks/filters.php:157-158` to merge subtitle-service state into the section that `SettingsService::getSection('subtitle_service')` returns.

The interpolation means **every** settings section has a filter of this shape. The seven sections are `general`, `youtube`, `performance`, `analytics`, `google_analytics`, `branding` and `subtitle_service` (`app/Services/SettingsService.php:25-65`):

```php
// Fires as fluent_player/settings_section/branding, /youtube, /analytics, …
add_filter('fluent_player/settings_section/branding', function ($sectionSettings, $allSettings) {
    return $sectionSettings;
}, 10, 2);
```

Only the `subtitle_service` variant is part of the Pro contract; the rest are Tier 3.

### `fluent_player/daily_cleanup`

**Action (WP-Cron) · 0 args · `app/Hooks/Handlers/ScheduledCleanupHandler.php:9`.** There is no `do_action()` for this name anywhere — it is a `const CRON_HOOK` scheduled with `wp_schedule_event()`, so `add_action()` works normally but grep never finds a dispatch site. Pro attaches analytics and playlist cleanup (`app/Hooks/actions.php:59-60`); the behavior-handler lock sweep also rides on it (`app/Integrations/FluentCrm/FluentCrmBehaviorModule.php:53`).

### `fluent_player/register_media_taxonomies`

**Action · 0 args · `app/Hooks/Handlers/FluentPlayerMediaCPT.php:75`.** Fired immediately after `register_post_type()` for `fluent_player_media`, and it exists for exactly one reason: so Pro can attach the `flp_media_tag` taxonomy at the right moment (`app/Hooks/actions.php:35` → `TagService::registerTaxonomy`). Register your own media taxonomies here and the ordering against the CPT is guaranteed.

### `fluent_player/media_tags_request`

**Filter · 3 args (`$response`, `$action`, `$request`) · `app/Http/Controllers/MediaController.php:392`.** The REST-side counterpart of the taxonomy hook — Pro implements the actual tag CRUD behind it (`app/Hooks/filters.php:55`). Free dispatches, Pro answers. If you register a taxonomy on the previous hook, this is where you serve it.

### `fluent_player/register_email_providers` and `fluent_player/integrations`

The two registration seams, documented in full in [Build a Custom Email Provider](/extending/custom-email-provider) and [Build a Custom Integration](/extending/custom-integration). Both are Tier 1: Pro registers Webhook and Mailchimp on the first (`app/Hooks/actions.php:22`, `:82`) and all six hosted-streaming providers on the second (`app/Hooks/filters.php:19`).

## Version guards

The two plugins check each other, in both directions.

### Free → Pro

`FLUENT_PLAYER_MIN_PRO_VERSION` is defined in `fluent-player.php:23` (currently `1.0.7`). If Pro is active but older, free prints a dismissible-free admin error for users with `activate_plugins` — `app/Hooks/actions.php:43-59`, comparison at `:48`:

```php
if (version_compare(FLUENT_PLAYER_PRO_VERSION, FLUENT_PLAYER_MIN_PRO_VERSION, '>=')) {
    return;
}
```

This is a **notice only** — Pro still loads. It marks the floor below which free no longer guarantees the hook contract holds.

### Pro → Free

`FLUENT_PLAYER_PRO_MIN_CORE_VERSION` is defined in Pro's `fluent-player-pro.php:22` (currently `1.0.9`). If free is older, Pro registers an "outdated core" notice and **returns without booting** (`fluent-player-pro/boot/app.php:14-17`). This one is a hard stop.

### Detecting Pro from your own code

```php
// The free plugin's own test — app/Helpers/Helper.php:1093-1096
if (defined('FLUENT_PLAYER_PRO_VERSION')) {
    // Pro is active; FLUENT_PLAYER_PRO_VERSION holds its version string.
}
```

Free uses `Helper::hasPro()` internally to trim Pro-only providers out of the settings blob (`app/Services/EmailProviderService.php:95-101`) and to swap in upgrade placeholders (`:201-208`).

## Practical guidance

- **Prefer a Tier 1 hook when two options exist.** Bootstrapping on `fluent_player/loaded` is safer than on `plugins_loaded` with a `class_exists()` race.
- **Pin and test.** Free `1.3.0` and Pro `1.3.0` are what this page was verified against. Re-run the [reproduce script](#reproduce-the-list-yourself) after any major upgrade, and re-check the three manual decisions under it — a newly interpolated hook name will not show up on its own.
- **Match the argument count exactly.** Every hook above lists its `callbackArgs`; a filter registered with too few will silently receive fewer arguments than you expect.
- **Return the first argument from every filter**, modified or not.
- **Do not reach past the hooks.** Calling a `FluentPlayer\App\Services\*` internal, or anything under `FluentPlayer\Framework\*` (whose namespace the WPFluent prefixer rewrites per build), is outside the contract at any tier. The supported PHP surface is the hooks plus the two documented base classes and their service registries.

## See also

- [Hooks & Filters overview](/hooks/) — how to discover every hook in your installed version
- [Full Reference](/hooks/reference) — all 112 hook names with edition and dispatch site
- [Extending FluentPlayer](/extending/) — the base classes and registries
