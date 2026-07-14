---
title: "Recipes"
description: "Copy-paste snippets for common FluentPlayer customizations."
---

# Recipes

Short, copy-paste snippets built from the [hooks](/hooks/) and extension points. Each links to the reference entry it uses.

## Custom paywall markup for locked media

Uses [`fluent_player/access_denied_html`](/hooks/access-gating#fluent-player-access-denied-html).

```php
add_filter('fluent_player/access_denied_html', function ($html, $id, $post) {
    return '<div class="paywall"><a href="/pricing">Upgrade to watch</a></div>';
}, 10, 3);
```

## Fallback poster for every dynamic source

Uses [`fluent_player/dynamic_source_overrides`](/hooks/dynamic-sources#fluent-player-dynamic-source-overrides).

```php
add_filter('fluent_player/dynamic_source_overrides', function ($overrides, $url, $sourceUrl, $sourceMeta, $sourcePoster) {
    if (empty($overrides['poster'])) {
        $overrides['poster'] = 'https://example.com/fallback.webp';
    }
    return $overrides;
}, 10, 5);
```

## Mark an LMS step complete when a video is watched

Uses [`fluent_player/watch_recorded`](/hooks/actions#fluent-player-watch-recorded). The server is the source of truth for coverage.

```php
add_action('fluent_player/watch_recorded', function ($mediaId, $userId, $payload) {
    if ($userId && !empty($payload['complete'])) {
        // your LMS: mark the step for $userId complete
    }
}, 10, 3);
```

## Suppress email delivery for test addresses

Uses [`fluent_player/email_providers`](/hooks/email#fluent-player-email-providers).

```php
add_filter('fluent_player/email_providers', function ($providers, $data, $settings) {
    return str_ends_with($data['email'] ?? '', '@example.com') ? [] : $providers;
}, 10, 3);
```

::: tip
Have a snippet worth sharing? These recipes are curated from real hooks — verify the signature against the linked reference entry before adding one.
:::
