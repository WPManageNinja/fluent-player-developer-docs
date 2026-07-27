---
title: "Progression Hooks"
description: "Filters and the action that govern FluentPlayer's watch-coverage completion evaluator — for LMS and content-gating integrations."
---

# Progression Hooks

Progression decides whether a viewer has watched enough of a media to count it **complete**. The evaluator is coverage-based (distinct watched segments ÷ duration) and is mirrored in PHP and JS with a shared conformance fixture. The **server** is authoritative: it recomputes coverage from raw segments and never trusts a client-supplied ratio.

These hooks fire in `ProgressionService::record()` (`app/Services/Progression/ProgressionService.php:163-198`). Use them to tune the completion policy or react to a recorded watch. See the [JS API](/js-api/) for the browser side.

::: warning `$userId` is never `0` — progression is logged-in only
Every hook on this page receives a `$userId`, and in the shipped flow it is **always a real, logged-in user ID (`>= 1`)**. There is no guest path:

- `ProgressionHandler` registers **only** `wp_ajax_fluent_player_progression` — there is no `wp_ajax_nopriv_` variant (`app/Hooks/Handlers/ProgressionHandler.php:21`). Its docblock states the intent outright: "No nopriv variant — completion is always per-user" (`:15`).
- An anonymous request is rejected before any hook runs, with `401 not_logged_in` (`app/Hooks/Handlers/ProgressionHandler.php:32-35`).
- That handler is the **only** caller of `ProgressionService::record()` in either tree (`app/Hooks/Handlers/ProgressionHandler.php:75`).

So `if (!$userId)` branches in a progression callback are dead code — they never run and only obscure the real logic. Do not write them. (The one way `$userId` could be `0` is your own plugin calling `ProgressionService::record()` directly with `0`; that is not a path FluentPlayer itself ever takes.)

See the [AJAX endpoint reference](/rest-api/ajax) for the endpoint's auth contract.
:::

## The completion policy

Every filter and payload on this page carries the same policy array. It comes from `ProgressionService::defaultPolicy()` (`app/Services/Progression/ProgressionService.php:25-35`) merged with any per-call overrides, and has **exactly four keys**:

| Key | Type | Default | Meaning |
|---|---|---|---|
| `threshold` | `float` | `0.9` | Distinct-coverage ratio (0–1) required to complete. Clamped to 0–1 by the evaluator (`app/Services/Progression/Evaluator.php:33`). |
| `countMutedAutoplay` | `bool` | `false` | When `false`, a watch that happened during muted autoplay can never complete (`Evaluator.php:36-38`). |
| `autoComplete` | `bool` | `false` | Not read by the core evaluator — it is an opt-in flag consumed by LMS adapters (LearnDash reads it at `fluent-player-pro/app/Integrations/LearnDash/LearnDashIntegration.php:90`) **(Pro)**. |
| `accumulate` | `bool` | `false` | When `true`, distinct coverage accumulates **server-side across sessions** (`ProgressionService.php:179-181`), so completion survives a reload or multi-sitting viewing. Logged-in users only; the union lives in user meta and cannot be forged from the client. Default `false` keeps `record()` stateless. |

There is no `basis` key. If you see one in third-party code, it is doing nothing.

## `fluent_player/progression/policy`

**Type:** filter · **Source:** `app/Services/Progression/ProgressionService.php:165`

Filters the completion policy before the verdict is computed. The array you receive is already `defaultPolicy()` merged with the per-call overrides.

| Arg | Type | Description |
|---|---|---|
| `$policy` | `array` | Default policy merged with any per-call overrides — the four keys above. |
| `$mediaId` | `int` | The media being evaluated. |
| `$userId` | `int` | The viewing user — always a real logged-in user ID (see the warning above). |
| `$context` | `array` | LMS call context, e.g. `['course_id' => 12, 'step_id' => 340]`. |

```php
add_filter('fluent_player/progression/policy', function ($policy, $mediaId, $userId, $context) {
    $policy['threshold'] = 0.8;   // require 80% coverage to complete
    $policy['accumulate'] = true; // let progress survive across sessions

    // Be stricter on graded course steps only.
    if (!empty($context['step_id']) && myplugin_step_is_graded($context['step_id'])) {
        $policy['threshold'] = 0.95;
    }

    return $policy;
}, 10, 4);
```

## `fluent_player/progression/verdict`

**Type:** filter · **Source:** `app/Services/Progression/ProgressionService.php:185`

Filters the computed verdict before it is returned and before `watch_recorded` fires.

The verdict is exactly `['complete' => bool, 'reason' => 'ended'|'threshold'|null]` (`app/Services/Progression/Evaluator.php:27-45`). Coverage is **not** part of the verdict — it is a sibling key in the `watch_recorded` payload.

| Arg | Type | Description |
|---|---|---|
| `$verdict` | `array` | `['complete' => bool, 'reason' => string\|null]`. |
| `$mediaId` | `int` | The media being evaluated. |
| `$userId` | `int` | The viewing user — always a real logged-in user ID (see the warning above). |
| `$context` | `array` | LMS call context — the same two-key array the policy filter gets: `['course_id' => int, 'step_id' => int]`, built from the request at `app/Hooks/Handlers/ProgressionHandler.php:70-73`. Both keys are **always present** and both are `absint()`-cast, so an untracked watch carries `0` rather than a missing key. This is the only way the callback knows which course/step the watch belongs to. |

```php
add_filter('fluent_player/progression/verdict', function ($verdict, $mediaId, $userId, $context) {
    // A graded step needs a passing quiz on top of the watch coverage.
    if (!empty($context['step_id']) && !empty($verdict['complete'])) {
        if (!myplugin_quiz_passed($userId, (int) $context['step_id'])) {
            $verdict['complete'] = false;
            $verdict['reason']   = null;
        }
    }

    return $verdict;
}, 10, 4);
```

## `fluent_player/watch_recorded`

**Type:** action · **Source:** `app/Services/Progression/ProgressionService.php:187`

Fires after a watch event is recorded. This is the server-side, anti-spoof signal to gate content or mark an LMS step complete.

| Arg | Type | Description |
|---|---|---|
| `$mediaId` | `int` | The media watched. |
| `$userId` | `int` | The viewing user — always a real logged-in user ID (see the warning above). |
| `$payload` | `array` | Six keys — see below. |

### The `$payload` array

All six keys are always present (`app/Services/Progression/ProgressionService.php:187-194`):

| Key | Type | Description |
|---|---|---|
| `duration` | `float` | Server-side media duration used for the coverage denominator. |
| `durationSource` | `string` | Where that duration came from; `'unknown'` when the evidence carried none. |
| `coverage` | `float` | Server-authoritative distinct-coverage ratio (0–1), recomputed from raw segments. |
| `verdict` | `array` | `['complete' => bool, 'reason' => 'ended'\|'threshold'\|null]`. |
| `policy` | `array` | The post-filter policy the verdict was judged against. |
| `context` | `array` | The LMS call context, `['course_id' => int, 'step_id' => int]` (`app/Hooks/Handlers/ProgressionHandler.php:70-73`) — **the only way a listener knows which course/step this watch belongs to**. Both keys always exist; `0` means "not supplied". |

::: danger Completion is nested — `$payload['verdict']['complete']`
There is no top-level `$payload['complete']`. A listener that checks `!empty($payload['complete'])` reads a key that never exists, so the condition is always false and the integration silently never fires. Always read `$payload['verdict']['complete']`.
:::

```php
add_action('fluent_player/watch_recorded', function ($mediaId, $userId, $payload) {
    // No guest check needed — this action only ever fires for a logged-in user.

    // Correct: completion lives under 'verdict'.
    if (empty($payload['verdict']['complete'])) {
        return;
    }

    $stepId = isset($payload['context']['step_id']) ? (int) $payload['context']['step_id'] : 0;
    if (!$stepId) {
        return; // this watch wasn't part of a tracked LMS step
    }

    my_lms_mark_step_complete($userId, $stepId, [
        'media_id' => $mediaId,
        'coverage' => $payload['coverage'],
        'reason'   => $payload['verdict']['reason'],
    ]);
}, 10, 3);
```

::: warning Trust the server, not the browser
The JS evaluator is optimistic (for instant UI feedback). Gate real content on `watch_recorded` server-side — the coverage there is recomputed from raw segments and cannot be forged by the client.
:::
