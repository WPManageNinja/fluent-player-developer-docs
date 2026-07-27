---
title: "Action Hooks"
description: "FluentPlayer do_action lifecycle hooks — plugin boot, media save/delete, status changes, email collected, watch recorded, and provider registration."
---

# Action Hooks

Actions fire at points in the plugin lifecycle. They return nothing — you use them to run side effects (logging, syncing, enqueuing). The free build ships **15 actions**; the highest-signal ones are documented below. See the [Full Reference](/hooks/reference) for all of them, plus the 8 Pro-only actions.

## `fluent_player/loaded`

**Type:** action · **Source:** `boot/app.php:34`

Fires once per request from inside WordPress's `plugins_loaded`, as the first statement of FluentPlayer's boot callback, with the fully constructed WPFluent application container as its argument. This is the **canonical entry point for an add-on**: FluentPlayer is loaded and resolvable, but `init` has not run and nothing has rendered — so it is the right place to register your own hooks, services, providers, and REST routes.

| Arg | Type | Description |
|---|---|---|
| `$app` | `object` | The WPFluent application instance (the plugin's service container). |

```php
add_action('fluent_player/loaded', function ($app) {
    // Everything FluentPlayer offers is registerable from here.
    add_action('fluent_player/register_email_providers', 'myplugin_register_provider');
    add_filter('fluent_player/player_settings', 'myplugin_filter_player_settings');
}, 10, 1);
```

::: tip Register at file scope
Because `fluent_player/loaded` fires *during* `plugins_loaded`, adding the listener from inside your own `plugins_loaded` callback can be too late — plugin load order decides whether you win. Call `add_action('fluent_player/loaded', …)` at file scope in your main plugin file instead.
:::

## `fluent_player/after_save_media`

**Type:** action · **Source:** `app/Http/Controllers/MediaController.php:116` (also `:145`)

Fires after a media item is created or updated through the admin REST API.

| Arg | Type | Description |
|---|---|---|
| `$mediaId` | `int` | ID of the saved media post. |
| `$data` | `array` | The request payload used to save it. |

```php
add_action('fluent_player/after_save_media', function ($mediaId, $data) {
    error_log("FluentPlayer media {$mediaId} saved");
}, 10, 2);
```

## `fluent_player/media_status_changed`

**Type:** action · **Source:** `app/Hooks/actions.php:38`

Fires from WordPress's `transition_post_status` for the `fluent_player_media` post type — and only when the status actually changed (`$newStatus === $oldStatus` returns early). Unlike `after_save_media` this catches status transitions made anywhere, including quick-edit, bulk actions, and scheduled publishes. The source comment names the intended use: integrations hook this to invalidate cached markup.

| Arg | Type | Description |
|---|---|---|
| `$postId` | `int` | The media post whose status changed. |
| `$newStatus` | `string` | The status it moved to (`publish`, `draft`, `trash`, …). |
| `$oldStatus` | `string` | The status it moved from. |

```php
add_action('fluent_player/media_status_changed', function ($postId, $newStatus, $oldStatus) {
    if ('publish' !== $newStatus) {
        myplugin_flush_media_cache($postId);
    }
}, 10, 3);
```

## `fluent_player/email_collected`

**Type:** action · **Source:** `app/Hooks/Handlers/EmailCollectionHandler.php:92` (also `:122`)

Fires when a viewer submits the email-capture layer.

| Arg | Type | Description |
|---|---|---|
| `$data` | `array` | Submitted data (email and associated fields). |
| `$submission` | `mixed` | The stored `EmailCollection` record (or the existing record). |
| `$created` | `bool` | `true` if a new record was created, `false` if it already existed. |
| `$integrationResults` | `array` | Results from each email provider the submission was sent to. |

```php
add_action('fluent_player/email_collected', function ($data, $submission, $created, $results) {
    if ($created) {
        // first time this email was captured
    }
}, 10, 4);
```

## `fluent_player/watch_recorded`

**Type:** action · **Source:** `app/Services/Progression/ProgressionService.php:187`

Fires when a watch/progression event is recorded for a media item and user. This is the server-side, anti-spoof completion signal — see [Progression Hooks](/hooks/progression#fluent-player-watch-recorded) for the full treatment.

| Arg | Type | Description |
|---|---|---|
| `$mediaId` | `int` | The media being watched. |
| `$userId` | `int` | The viewing user — **always a real logged-in user ID, never `0`**. The progression endpoint registers no `nopriv` handler and rejects anonymous requests with `401 not_logged_in` (`app/Hooks/Handlers/ProgressionHandler.php:21`, `:32-35`). |
| `$payload` | `array` | Exactly six keys: `duration`, `durationSource`, `coverage`, `verdict`, `policy`, `context` (`app/Services/Progression/ProgressionService.php:187-194`). |

The `$payload` carries **no raw segments** — the server recomputes `coverage` (a `float`, 0–1) from them and passes only the ratio. `verdict` is a nested array, `policy` is the post-filter completion policy, and `context` is `['course_id' => int, 'step_id' => int]`.

::: danger Completion is nested — `$payload['verdict']['complete']`
There is no top-level `$payload['complete']`. A listener that checks `!empty($payload['complete'])` reads a key that never exists, so the condition is always false and the integration silently never fires. Always read `$payload['verdict']['complete']`.
:::

```php
add_action('fluent_player/watch_recorded', function ($mediaId, $userId, $payload) {
    if (empty($payload['verdict']['complete'])) {
        return; // not complete yet — note the nesting under 'verdict'
    }

    $stepId = isset($payload['context']['step_id']) ? (int) $payload['context']['step_id'] : 0;
    if (!$stepId) {
        return; // this watch wasn't part of a tracked LMS step
    }

    my_lms_mark_step_complete($userId, $stepId, [
        'media_id' => $mediaId,
        'coverage' => $payload['coverage'],
    ]);
}, 10, 3);
```

## `fluent_player/media_milestone`

**Type:** action · **Source:** `app/Hooks/Handlers/AbstractBehaviorHandler.php:156` · **Args:** 1

Fires server-side when a viewer crosses an **armed** watch milestone — `started`, `q25`, `q50`, `q75`, or a `completed` threshold. This is the automation-grade playback signal: coverage is recomputed from raw segments on the server, and each milestone fires **once per identity per media** (the fired-set lives in `BehaviorState`). It is the action FluentCRM's *Media Milestone Reached* funnel trigger listens to.

::: warning The literal name is nowhere near the dispatch site
The dispatch is `do_action($this->eventName(), $ctx)` (`app/Hooks/Handlers/AbstractBehaviorHandler.php:156`). `eventName()` is abstract (`:53`); `MediaMilestoneHandler::eventName()` (`app/Hooks/Handlers/MediaMilestoneHandler.php:15-18`) returns the constant `BehaviorRegistry::TRIGGER_MILESTONE`, declared at `app/Integrations/FluentCrm/BehaviorRegistry.php:17`. Grepping the source for `do_action('fluent_player/media_milestone'` therefore finds **nothing** — the string only exists in that one constant. `add_action('fluent_player/media_milestone', …)` works normally.
:::

::: danger Only exists when FluentCRM is active
`AbstractBehaviorHandler::register()` returns immediately unless `FLUENTCRM` is defined (`:31-33`), and the whole module is behind the same guard (`app/Integrations/FluentCrm/FluentCrmBehaviorModule.php:14-20`, invoked from `app/Hooks/actions.php:20`). On a site without FluentCRM the AJAX endpoint is never registered, so this action never fires. For a CRM-independent completion signal use [`fluent_player/watch_recorded`](#fluent-player-watch-recorded).
:::

| Arg | Type | Description |
|---|---|---|
| `$ctx` | `array` | One milestone event. Built at `app/Hooks/Handlers/MediaMilestoneHandler.php:58-69`. |

`$ctx` has exactly seven keys:

| Key | Type | Meaning |
|---|---|---|
| `media_id` | `int` | The media being watched. |
| `milestone` | `string` | `started`, `q25`, `q50`, `q75`, or `completed` (`app/Services/Behavior/Milestones.php:36`, `:41`, `:50`). |
| `boundary` | `float` or `null` | The coverage fraction that was crossed — `0.25` / `0.5` / `0.75` for quartiles, the configured threshold for `completed`. **`null`** for `started`, and for a `completed` fired on `ended` with an unknown duration (`Milestones.php:37`, `:54`). |
| `coverage` | `float` | Server-recomputed distinct watched fraction, 0–1. |
| `user_id` | `int` | WP user id, or `0` for a FluentCRM contact who is not logged in. |
| `subscriber_id` | `int` | FluentCRM contact id, or `0` when there is none. |
| `email` | `string` | The contact's email, else the WP user's, else `''`. |

::: warning Anonymous viewers never reach your callback
The `do_action()` loop is wrapped in `if ($contact || $userId)` (`AbstractBehaviorHandler.php:154-159`). An anonymous ping still records state, so the milestone fires later — once the visitor becomes a contact or logs in. At least one of `user_id` / `subscriber_id` is therefore always non-zero inside a callback.
:::

```php
add_action('fluent_player/media_milestone', function ($ctx) {
    if ('completed' !== $ctx['milestone']) {
        return;
    }

    // boundary is null when the duration was unknown — don't assume a float.
    $threshold = isset($ctx['boundary']) ? (float) $ctx['boundary'] : 0.0;

    my_plugin_award_badge($ctx['user_id'], $ctx['media_id'], [
        'coverage'  => $ctx['coverage'],
        'threshold' => $threshold,
    ]);
}, 10, 1);
```

Free's own consumers are a good template for a third-party one: the FluentCRM funnel trigger (`app/Integrations/FluentCrm/MediaMilestoneTrigger.php:19`, priority `20`, `actionArgNum = 1`), the funnel benchmark (`MediaMilestoneBenchmark.php:19`), and the contact-timeline bridge (`TimelineBridge.php:21`, also priority `20`).

The request side of this hook — parameters, envelope, rate limits and status codes — is documented under [AJAX actions](/rest-api/ajax#fluent-player-media-milestone). To emit your own events from the same plumbing, see [Build a Behavior Handler](/extending/behavior-handler).

## `fluent_player/layer_event`

**Type:** action · **Source:** `app/Hooks/Handlers/AbstractBehaviorHandler.php:156` · **Args:** 1

The layer half of the same pair: fires when a viewer **saw**, **completed**, or **skipped** an armed layer (CTA, ad, email capture, …) on a media. Same dispatch site, same FluentCRM-only availability, same one-argument shape — only the name and the payload differ. Its name comes from `LayerEventHandler::eventName()` (`app/Hooks/Handlers/LayerEventHandler.php:16-19`) → `BehaviorRegistry::TRIGGER_LAYER` (`app/Integrations/FluentCrm/BehaviorRegistry.php:18`), so it is just as invisible to a grep for the literal string.

| Arg | Type | Description |
|---|---|---|
| `$ctx` | `array` | One layer event. Built at `app/Hooks/Handlers/LayerEventHandler.php:69-78`. |

`$ctx` has exactly eight keys:

| Key | Type | Meaning |
|---|---|---|
| `media_id` | `int` | The media the layer belongs to. |
| `layer_id` | `string` | The layer's id from the media settings. |
| `layer_type` | `string` | The **normalized** type (`BehaviorRegistry::normalizedLayerType()`, `app/Integrations/FluentCrm/BehaviorRegistry.php:209-215`) — a `cta` layer whose `cta_type` is `email` arrives as `email`, not `cta`. |
| `layer_title` | `string` | The layer's title, or `''`. |
| `event` | `string` | `seen`, `completed`, or `skipped` — the only accepted values (`LayerEventHandler.php:14`, enforced at `:44`). |
| `user_id` | `int` | As above. |
| `subscriber_id` | `int` | As above. |
| `email` | `string` | As above. |

::: tip `hotspot` layers can never appear
`indexMediaLayers()` skips them outright (`LayerEventHandler.php:129`), so no hotspot ever produces a `layer_event`. Claims are also plausibility-checked — `completed` / `skipped` require a prior `seen`, and an ad cannot complete faster than its skip offset allows (`:104-117`).
:::

```php
add_action('fluent_player/layer_event', function ($ctx) {
    if ('email' !== $ctx['layer_type'] || 'skipped' !== $ctx['event']) {
        return;
    }

    my_plugin_note_optin_skip($ctx['subscriber_id'], $ctx['media_id'], $ctx['layer_id']);
}, 10, 1);
```

Consumed in free by `LayerEventTrigger.php:19`, `LayerEventBenchmark.php:19`, and `TimelineBridge.php:22`. Request contract: [AJAX actions](/rest-api/ajax#fluent-player-layer-event). Building your own: [Build a Behavior Handler](/extending/behavior-handler).

## `fluent_player/register_email_providers`

**Type:** action · **Source:** `app/Services/EmailProviderService.php:35`

Fires while the plugin builds its email-provider registry. Hook here to register a custom provider — see [Build a Custom Email Provider](/extending/custom-email-provider).

```php
add_action('fluent_player/register_email_providers', function () {
    // register your provider instance
});
```

## `fluent_player/daily_cleanup`

**Type:** action (WP-Cron) · **Source:** `app/Hooks/Handlers/ScheduledCleanupHandler.php:9` · **Args:** 0

The daily maintenance event. Individual cleanup tasks attach themselves to it — free removes stale auto-draft media (`app/Hooks/actions.php:106`), Pro attaches analytics and playlist cleanup (`fluent-player-pro/app/Hooks/actions.php:59-60`). Hook it for your own periodic housekeeping tied to FluentPlayer data.

::: warning This is a cron hook, not a dispatched action
There is no `do_action('fluent_player/daily_cleanup')` anywhere in the source — the name is a `const CRON_HOOK` scheduled via `wp_schedule_event()` (`app/Hooks/actions.php:109`). WP-Cron dispatches it, so `add_action()` works exactly as usual, but grepping for `do_action` will never find it.
:::

```php
add_action('fluent_player/daily_cleanup', function () {
    myplugin_prune_stale_player_reports();
});
```

## Other actions

Also available (see the [Full Reference](/hooks/reference) for exact `file:line` and arg counts in your version):
`before_delete_media`, `after_delete_media`, `before_render_media`, `email_collection_hooks`, `register_media_taxonomies`, `fluent_community_enqueue_block_assets`.

::: danger There is no `before_save_media`
FluentPlayer has **no pre-save action**. Nothing in the free or Pro tree dispatches `fluent_player/before_save_media` — earlier revisions of this page listed it in error.

To mutate a media item before it is written, use one of these instead:

- **`fluent_player/default_media_status`** (filter, 2 args, `app/Http/Controllers/MediaController.php:296`) — change the status a newly created media item is saved with.
- **`wp_insert_post_data`** — WordPress core's own pre-insert filter. FluentPlayer itself uses it to coerce `pending` to `draft` for its CPTs (`app/Hooks/actions.php:24`), so it definitely runs for `fluent_player_media`.
- **`fluent_player/after_save_media`** — if a post-write correction is acceptable.
:::
