---
title: "Progression Hooks"
description: "Filters and the action that govern FluentPlayer's watch-coverage completion evaluator — for LMS and content-gating integrations."
---

# Progression Hooks

Progression decides whether a viewer has watched enough of a media to count it **complete**. The evaluator is coverage-based (distinct watched segments ÷ duration) and is mirrored in PHP and JS with a shared conformance fixture. The **server** is authoritative: it recomputes coverage from raw segments and never trusts a client-supplied ratio.

These hooks fire in `ProgressionService::record()`. Use them to tune the completion policy or react to a recorded watch. See the [JS API](/js-api/) for the browser side.

## `fluent_player/progression/policy`

**Type:** filter · **Source:** `app/Services/Progression/ProgressionService.php:165`

Filters the completion policy before the verdict is computed. The policy carries `threshold`, `basis`, `accumulate`, and related rules.

| Arg | Type | Description |
|---|---|---|
| `$policy` | `array` | Default policy merged with any per-call overrides. |
| `$mediaId` | `int` | The media being evaluated. |
| `$userId` | `int` | The viewing user (0 for guests). |
| `$context` | `array` | Call context. |

```php
add_filter('fluent_player/progression/policy', function ($policy, $mediaId, $userId, $context) {
    $policy['threshold'] = 0.8; // require 80% coverage to complete
    return $policy;
}, 10, 4);
```

## `fluent_player/progression/verdict`

**Type:** filter · **Source:** `app/Services/Progression/ProgressionService.php:185`

Filters the computed verdict (`complete` + `reason`) before it is returned and before `watch_recorded` fires.

| Arg | Type | Description |
|---|---|---|
| `$verdict` | `array` | The evaluator output (`complete`, `reason`, coverage). |
| `$mediaId` | `int` | The media being evaluated. |
| `$userId` | `int` | The viewing user. |
| `$context` | `array` | Call context. |

```php
add_filter('fluent_player/progression/verdict', function ($verdict, $mediaId, $userId, $context) {
    return $verdict;
}, 10, 4);
```

## `fluent_player/watch_recorded`

**Type:** action · **Source:** `app/Services/Progression/ProgressionService.php:187`

Fires after a watch event is recorded. This is the server-side, anti-spoof signal to gate content or mark an LMS step complete.

| Arg | Type | Description |
|---|---|---|
| `$mediaId` | `int` | The media watched. |
| `$userId` | `int` | The viewing user (0 for guests). |
| `$payload` | `array` | `duration`, `durationSource`, `coverage`, `verdict`, and `policy`. |

```php
add_action('fluent_player/watch_recorded', function ($mediaId, $userId, $payload) {
    if ($userId && !empty($payload['verdict']['complete'])) {
        // mark your LMS step complete for $userId
    }
}, 10, 3);
```

::: warning Trust the server, not the browser
The JS evaluator is optimistic (for instant UI feedback). Gate real content on `watch_recorded` server-side — the coverage there is recomputed from raw segments and cannot be forged by the client.
:::
