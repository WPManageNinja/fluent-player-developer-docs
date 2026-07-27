---
title: "Recipes"
description: "Copy-paste snippets for common FluentPlayer customizations."
---

# Recipes

Short, copy-paste snippets built from the [hooks](/hooks/) and extension points. Each links to the reference entry it uses.

Every snippet on this page is traced to its call site and is **PHP 7.4-safe** — the floor both plugins declare (`readme.txt:6`, `Requires PHP: 7.4`). Avoid `str_ends_with()`, `str_contains()`, `match`, and named arguments in your own callbacks for the same reason: a PHP 8.0-only function in an AJAX filter is a fatal error on a supported host, not a warning.

## Replace a media block with your own paywall

Uses [`fluent_player/pre_render_block_media`](/hooks/media-rendering) — `app/Blocks/MediaBlock.php:256`. Returning a **non-empty string** makes the block return your markup and never render the player.

```php
add_filter('fluent_player/pre_render_block_media', function ($output, $attributes, $mediaId) {
    if (current_user_can('read')) {
        return $output; // '' — let FluentPlayer render normally
    }

    return '<div class="paywall"><a href="/pricing">Upgrade to watch</a></div>';
}, 10, 3);
```

::: warning Block-only seam
`pre_render_block_media` fires in the Gutenberg **block** render path only. The `[fluentplayer]` shortcode — and its `[fluentmedia]` back-compat alias, both registered at `app/Hooks/actions.php:179-180` — has no output-override filter (`app/Hooks/Handlers/MediaShortcodeHandler.php` dispatches only `fluent_player/media_shortcode_defaults`), so a paywall built here does not cover shortcode embeds. To hide media from the shortcode path too, deny it in [`fluent_player/can_view_media`](/hooks/access-gating#fluent-player-can-view-media) — but read the next recipe first, because denying a **published** media renders nothing at all.
:::

## Custom curtain for media hidden by status

Uses [`fluent_player/access_denied_html`](/hooks/access-gating#fluent-player-access-denied-html) — `app/Models/Media.php:352`.

```php
add_filter('fluent_player/access_denied_html', function ($html, $id, $post) {
    return '<div class="fp-curtain"><a href="/pricing">This video is not available yet</a></div>';
}, 10, 3);
```

::: warning This is not the paywall hook
`Media::getAccessDeniedCurtain()` returns an **empty string before it reaches this filter** when the media is missing, has a public status (`publish`), is `private`, or the current user can `read_post` it (`app/Models/Media.php:314-337`). So the filter only fires for media hidden by a non-public status such as `draft` or `pending`.

The practical consequence: if you deny a *published* media through `fluent_player/can_view_media`, the caller falls through to `getAccessDeniedCurtain()`, which returns `''` — the visitor sees **nothing**, and this filter never runs to supply replacement markup. For password-gated media, filter [`fluent_player/media_locked_html`](/hooks/access-gating#fluent-player-media-locked-html) instead.
:::

## Fallback poster for every dynamic source

Uses [`fluent_player/dynamic_source_overrides`](/hooks/dynamic-sources#fluent-player-dynamic-source-overrides) — `app/Services/DynamicMediaSourceResolver.php:194`.

```php
add_filter('fluent_player/dynamic_source_overrides', function ($overrides, $url, $sourceUrl, $sourceMeta, $sourcePoster) {
    if (empty($overrides['posterSrc'])) {
        $overrides['posterSrc'] = 'https://example.com/fallback.webp';
    }
    return $overrides;
}, 10, 5);
```

::: danger The poster key is `posterSrc`, not `poster`
The resolver builds exactly three keys — `src`, `provider`, `posterSrc` (`app/Services/DynamicMediaSourceResolver.php:185-189`) — and every consumer downstream reads `posterSrc` (`app/Views/player.php:195`, `app/Views/player/bottom-controls-audio.php:44`, `app/Helpers/Helper.php:162`). Writing `$overrides['poster']` adds a key nothing ever reads: the callback runs, the array grows, and no poster changes. A silent no-op.
:::

## Mark an LMS step complete when a video is watched

Uses [`fluent_player/watch_recorded`](/hooks/progression#fluent-player-watch-recorded) — `app/Services/Progression/ProgressionService.php:187`. The server is the source of truth for coverage.

```php
add_action('fluent_player/watch_recorded', function ($mediaId, $userId, $payload) {
    // Completion is NESTED under 'verdict' — there is no $payload['complete'].
    if (!$userId || empty($payload['verdict']['complete'])) {
        return;
    }

    $stepId = isset($payload['context']['step_id']) ? (int) $payload['context']['step_id'] : 0;
    if (!$stepId) {
        return; // this watch wasn't part of a tracked LMS step
    }

    // your LMS: mark $stepId complete for $userId
}, 10, 3);
```

::: danger `$payload['complete']` does not exist
The action passes six keys — `duration`, `durationSource`, `coverage`, `verdict`, `policy`, `context` (`app/Services/Progression/ProgressionService.php:187-194`). The completion flag lives inside the verdict array: `['complete' => bool, 'reason' => 'ended'|'threshold'|null]` (`app/Services/Progression/Evaluator.php:25`). A listener testing `!empty($payload['complete'])` reads a key that is never set, so the condition is always false and the LMS step is silently never marked — no error, no log, no clue.
:::

## Skip marketing delivery for test addresses

Uses [`fluent_player/email_providers`](/hooks/email#fluent-player-email-providers) — `app/Hooks/Handlers/EmailCollectionHandler.php:103`.

```php
add_filter('fluent_player/email_providers', function ($providers, $data, $settings) {
    $email = isset($data['email']) ? (string) $data['email'] : '';

    // PHP 7.4-safe suffix test — str_ends_with() is PHP 8.0 and would fatal here.
    if ($email !== '' && substr($email, -12) === '@example.com') {
        return []; // nothing to dispatch to
    }

    return $providers;
}, 10, 3);
```

**What `$providers` actually is.** Not a list of provider slugs — it is the capture layer's **per-provider config list**, read from `email_capture.providers` in the resolved settings (`app/Hooks/Handlers/EmailCollectionHandler.php:101`). Each element is an array of the shape `['enabled' => bool, 'type' => string, 'config' => array]`; the consumer skips anything without a truthy `enabled`, then reads `type` and `config` (`app/Services/EmailCollectionService.php:318-324`). `type` is either the built-in `'email'` notification handler or a key registered through [`fluent_player/register_email_providers`](/hooks/actions#fluent-player-register-email-providers) (`app/Services/EmailCollectionService.php:51`, `app/Services/EmailProviderService.php:42-46`).

Because the shape is per-entry config, you can disable one entry instead of clearing the whole list:

```php
add_filter('fluent_player/email_providers', function ($providers, $data, $settings) {
    foreach ($providers as $index => $provider) {
        // Keep CRM sync, but stop the admin notification email.
        if (isset($provider['type']) && $provider['type'] === 'email') {
            $providers[$index]['enabled'] = false;
        }
    }
    return $providers;
}, 10, 3);
```

::: warning This only suppresses *delivery*, and only for new submissions
The submission is still validated, still written to `flp_email_collections`, and [`fluent_player/email_collected`](/hooks/actions#fluent-player-email-collected) still fires. And the filter sits **after** the returning-visitor branch: if a submission for this email already exists, the handler refreshes it and returns at `app/Hooks/Handlers/EmailCollectionHandler.php:88-98` — `email_providers` never runs. To stop the submission outright, use the next recipe.
:::

## Reject a submission before anything is stored

Uses `fluent_player/pre_process_email_submit` — `app/Hooks/Handlers/EmailCollectionHandler.php:77`, listed in the [Full Hooks Reference](/hooks/reference). This is the sanctioned short-circuit: return **anything other than `null`** and the handler sends it as the success payload and returns, before the returning-visitor lookup, before the provider dispatch, and before the `EmailCollection` row is created.

```php
add_filter('fluent_player/pre_process_email_submit', function ($result, $data) {
    $email = isset($data['email']) ? (string) $data['email'] : '';

    if ($email !== '' && substr($email, -12) === '@example.com') {
        // Non-null short-circuits: no row, no providers, no email_collected action.
        return ['message' => __('Thanks!', 'your-textdomain')];
    }

    return $result; // null — carry on with normal processing
}, 10, 2);
```

::: tip Return `null` to opt out
`null` is the "no opinion" value. Returning `false`, `0`, or `''` is **not** null, so it short-circuits the submission and ships that value to the browser as a success response. Always return the incoming `$result` when your condition does not match.

The filter runs *after* nonce/email/media validation (`$this->validateRequestData($data)` at `app/Hooks/Handlers/EmailCollectionHandler.php:72`), so `$data['email']` is already a sanitized, `FILTER_VALIDATE_EMAIL`-passing address by the time your callback sees it. To reject on your own rules *during* validation instead, return a `WP_Error` from `fluent_player/validate_email_submission` (`app/Hooks/Handlers/EmailCollectionHandler.php:259`) — that surfaces as an error response rather than a fake success.
:::

::: tip
Have a snippet worth sharing? These recipes are curated from real hooks — verify the signature against the linked reference entry before adding one, and check the **Args** column: the `accepted_args` you pass to `add_filter` must match, or PHP hands your callback fewer arguments than it declares.
:::
