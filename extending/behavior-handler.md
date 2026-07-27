---
title: "Build a Behavior Handler"
description: "Turn viewer watch behavior into FluentCRM automation triggers by extending AbstractBehaviorHandler — the AJAX, nonce, rate-limit, and locking plumbing is inherited."
---

# Build a Behavior Handler

A **behavior handler** turns something a viewer did — crossing a watch milestone, seeing an overlay — into a WordPress action that FluentCRM automations can be triggered from. `app/Hooks/Handlers/AbstractBehaviorHandler.php:13` gives you the whole pipeline: a pair of AJAX endpoints, nonce and same-origin verification, per-IP rate limiting, anonymous-visitor bucketing, a per-identity mutex, and persistent state. You implement three methods.

FluentPlayer ships two subclasses:

| Handler | `AJAX_ACTION` | Fires |
|---|---|---|
| `app/Hooks/Handlers/MediaMilestoneHandler.php:11` | `fluent_player_media_milestone` (`:13`) | [`fluent_player/media_milestone`](/hooks/actions#fluent-player-media-milestone) — started / q25 / q50 / q75 / completion thresholds |
| `app/Hooks/Handlers/LayerEventHandler.php:11` | `fluent_player_layer_event` (`:13`) | [`fluent_player/layer_event`](/hooks/actions#fluent-player-layer-event) — a layer was `seen`, `completed`, or `skipped` |

Both action names are class constants (`app/Integrations/FluentCrm/BehaviorRegistry.php:17-18`) returned by `eventName()`, so neither literal appears at the dispatch site. Their payloads are documented on the [Actions](/hooks/actions#fluent-player-media-milestone) page.

::: warning Handlers only exist when FluentCRM is active
`register()` returns immediately unless `FLUENTCRM` is defined (`AbstractBehaviorHandler.php:31-33`). Both shipped handlers are registered from `app/Integrations/FluentCrm/FluentCrmBehaviorModule.php:19-20`, itself behind the same guard (`:15-17`), invoked at `app/Hooks/actions.php:20`.

Your handler will not exist on a site without FluentCRM. If you need behavior reporting independent of the CRM, this is not the seam — hook `fluent_player/watch_recorded` instead (see [Progression hooks](/hooks/progression)).
:::

## 1. The contract

Source: `app/Hooks/Handlers/AbstractBehaviorHandler.php`.

### Abstract — implement all three

| Method | Line | Purpose |
|---|---|---|
| `protected eventName()` | `:53` | The action name to `do_action()` for each fired event. |
| `protected armedFor($mediaId)` | `:55` | What this media is configured to watch for. Return falsy to short-circuit the whole request with `['fired' => 0, 'reached' => []]` (`:110-112`). |
| `protected evaluate($mediaId, array $armed, array $state, array $identity)` | `:60` | Decide what fired. Returns `['state' => array, 'fired' => ctx[], 'reached' => string[], 'extra' => array]`. |

All three are `protected` — do not widen them to `public`.

### Constants

| Constant | Line | Value | Meaning |
|---|---|---|---|
| `AJAX_ACTION` | `:17` | `''` | **You must override this.** Both `wp_ajax_{ACTION}` and `wp_ajax_nopriv_{ACTION}` are bound to it (`:35-36`). |
| `NONCE_ACTION` | `:15` | `'fluent_player_behavior'` | One shared nonce action for every handler. |
| `RATE_LIMIT` | `:16` | `60` | Requests per IP per 60 seconds (`:236-253`). Over the cap → HTTP 429. |
| `LOCK_TTL` | `:18` | `15` | Seconds before a held identity+media lock is considered stale and stealable (`:205`). |
| `ANON_COOKIE` | `:19` | `'flp_bhv_anon'` | First-party httpOnly cookie bucketing anonymous watch state (`:276-295`). |
| `ANON_COOKIE_TTL` | `:20` | `21600` | 6 hours. |

### Inherited helpers

- `$this->app` — the WPFluent application, set in the base constructor (`:24-27`). `$this->app->request->get('key', $default)` is how both shipped handlers read request parameters. This is the base class's own property, so you are not importing anything from `FluentPlayer\Framework\*` yourself.
- `static::register()` (`:29`) — call it once. It instantiates `new static()` and binds both AJAX endpoints. Your class must therefore be constructible with **no arguments**.
- `static::canReport($ip = '')` (`:44`) — the consent gate, see below.
- `static::reapStaleLocks()` (`:259`) — sweep mutex rows left behind by a fatal. Already attached to `fluent_player/daily_cleanup` by `FluentCrmBehaviorModule.php:53`; you do not need to attach it again.
- `protected reachedFromState(array $state)` (`:171`) and `protected extraFromState(array $state, $mediaId)` (`:176`) — override to shape the response returned to a request that **lost the lock** and therefore skipped evaluation.

## 2. What the base class does per request

`process()` (`:81-168`), in order:

1. **Nonce.** `wp_verify_nonce($nonce, 'fluent_player_behavior')` (`:83-86`) → 403.
2. **Same-origin.** `isSameOrigin()` (`:90-92`, `:297-311`) → 403. Because the `nopriv` nonce is a shared public value, this is the real CSRF defense; a request with no `Origin`/`Referer` falls back to the nonce alone (`:309-310`).
3. **Rate limit.** 60/minute per IP (`:94-97`) → 429. Uses an atomic `wp_cache_incr` when a persistent object cache is present, otherwise a transient (`:238-252`).
4. **Consent.** `canReport($ip)` (`:100-102`) → 403. Deliberately *after* the rate limit, because resolving the CRM contact is DB work the limiter caps.
5. **Media id.** `absint(media_id)` → 422 *"Invalid media"* if empty (`:104-107`).
6. **`armedFor($mediaId)`** (`:109-112`). Falsy → early `['fired' => 0, 'reached' => []]`.
7. **Media exists and is visible.** `Media::findVisible()` → 404 *"Invalid media"* (`:114-117`).
8. **Identity.** Current user + FluentCRM contact; an anonymous id is minted only while unidentified (`:119-124`).
9. **Lock.** An atomic mutex on the options table keyed by identity+media (`:130-131`, `:184-217`). A request that cannot take the lock returns state-derived output without evaluating (`:132-138`) — this is what `reachedFromState()` / `extraFromState()` are for.
10. **`evaluate(...)`** (`:149`) with the loaded state.
11. **Persist + emit.** `BehaviorState::save()` (`:151`), then `do_action($this->eventName(), $ctx)` once per entry in `$result['fired']` (`:154-159`).
12. **Respond.** `['fired' => int, 'reached' => [...], ...extra]` via `wp_send_json_success()` (`:78`, `:164-167`).

::: warning `armedFor()` runs *before* the media lookup
Steps 6 and 7 are in that order in the source — the `armedFor()` early return is at `:109-112`, the `Media::findVisible()` 404 at `:114-117`. An unarmed media therefore **never reaches the 404 branch**: a request naming a trashed or non-visible media id still gets a `200` with `{"fired":0,"reached":[]}` as long as `armedFor()` returned falsy. Never read a `200` as proof the media exists.
:::

### Every response is enveloped

`handle()` (`:62-79`) wraps everything. Errors go through `wp_send_json_error(['message' => …], $code)` (`:74`); successes through `wp_send_json_success($data)` (`:78`). So the payloads quoted throughout this page always arrive nested under `data`:

```json
{ "success": true,  "data": { "fired": 0, "reached": [] } }
{ "success": false, "data": { "message": "Security check failed" } }
```

::: danger Anonymous visitors never emit
The `do_action()` loop is wrapped in `if ($contact || $userId)` (`:154`). An anonymous ping updates and persists state but fires nothing. Events "catch up" once the visitor is identified — design `evaluate()` so that a milestone recorded anonymously is still emittable later, exactly as `LayerEventHandler` does with its `$willEmit` flag (`LayerEventHandler.php:35`, used at `:67`).
:::

::: danger `BehaviorState` stores six keys and nothing else — custom keys are silently discarded
This is the single most important fact on this page. `BehaviorState::save()` (`app/Integrations/FluentCrm/BehaviorState.php:75`) does **not** persist the array you return. Line `:77` clamps it:

```php
$payload = array_intersect_key(array_merge(self::defaults(), $state), self::defaults());
```

`defaults()` (`:14-18`) is a closed whitelist. `AbstractBehaviorHandler.php:151` is the only call a handler can make into it (the one other caller, `BehaviorState::migrateUserState()` at `:102`, is internal to `load()`), so there is no way around the clamp:

| Key | Type | Written by | Meaning |
|---|---|---|---|
| `union` | `array` of `['start','end']` intervals | `MediaMilestoneHandler` | Merged distinct watched intervals (`MediaMilestoneHandler.php:73`) |
| `watched` | `float` | `MediaMilestoneHandler` | Accepted cumulative watched seconds (`:74`) |
| `ts` | `int` | `MediaMilestoneHandler` | Unix time of the last evaluated ping (`:75`) |
| `fired` | `string[]` | `MediaMilestoneHandler` | Flat list of already-emitted milestone ids — `"started:x"`, `"q50:0.5000"` (`:76`, format at `app/Services/Behavior/Milestones.php:60-65`) |
| `layers` | `array<layerId, array<event, int>>` | `LayerEventHandler` | First-seen timestamp per layer event (`LayerEventHandler.php:59`, `:89`) |
| `layers_fired` | `string[]` | `LayerEventHandler` | Flat list of emitted `"<layerId>:<event>"` identities (`:90`) |

Setting `$state['my_key']` in `evaluate()` compiles, runs, and is thrown away on every save. On the next request `load()` returns `array_merge(self::defaults(), $raw)` (`:55`), so your key comes back **absent**: a counter reads `0` forever, and a "have I already fired this?" marker never persists — meaning **your action re-fires on every single ping**.
:::

::: danger Handlers share one state row per identity + media
`BehaviorState::load()` / `save()` (`BehaviorState.php:33`, `:75`) are keyed by scope + media, **not** by handler. `MediaMilestoneHandler` and `LayerEventHandler` both write the same row, which is why the milestone handler explicitly carries the layer handler's keys through untouched (`MediaMilestoneHandler.php:77-79`) and the layer handler mutates only its own two keys on the array it was handed (`LayerEventHandler.php:89-90`, returned whole at `:93`).

Your `evaluate()` must return a `state` array that preserves every key you do not own, or you will silently wipe another handler's progress.
:::

### Storing your own data anyway

Both shipped handlers use the same trick, and it is the only in-whitelist option: they keep **flat lists of opaque identity strings** inside a whitelisted key. `LayerEventHandler` packs two dimensions into one list by composing `"<layerId>:<event>"` (`:62`, appended at `:68`). A third-party handler can do exactly the same in `fired`:

- Append prefixed markers such as `myplugin_chapter:intro` to `$state['fired']`.
- They survive the clamp because `fired` is a whitelisted key.
- They survive the milestone handler, which reads the existing list and only appends to it (`MediaMilestoneHandler.php:52-56`).
- They cannot be confused with a milestone id, which is always `"<key>:<boundary>"` with `boundary` a 4-decimal number or the literal `x` (`Milestones.php:60-65`). `MilestoneEvaluator::freshMilestones()` (`app/Integrations/FluentCrm/MilestoneEvaluator.php:96-108`) only ever looks for those exact ids, so foreign entries are inert there.

The cost is that your markers also appear in `MediaMilestoneHandler`'s own `reached` array (`MediaMilestoneHandler.php:82`), because that array *is* the `fired` list. Use an unambiguous prefix so consumers can filter, and filter it yourself in `reachedFromState()`.

::: warning A numeric counter cannot live in `BehaviorState`
There is no free scalar slot. `watched` and `ts` are the milestone handler's, `union` is an interval list, and a seventh key is discarded. If your handler needs a real count, either derive it from the number of markers you wrote into `fired` (fine for a bounded set), or keep it in your **own** store — `update_user_meta()`, a transient, your own table — and return `$state` from `evaluate()` completely untouched:

```php
protected function evaluate($mediaId, array $armed, array $state, array $identity)
{
    $count = (int) get_user_meta($identity['user_id'], '_my_plugin_replays_' . $mediaId, true) + 1;
    update_user_meta($identity['user_id'], '_my_plugin_replays_' . $mediaId, $count);

    return ['state' => $state, 'fired' => [], 'reached' => [], 'extra' => ['replays' => $count]];
}
```

Note that this loses the scope resolution `BehaviorState` gives you for free — anonymous visitors have no `user_id`, so you would need your own anonymous bucket. `BehaviorState::resolveScope()` (`:20-31`) shows the shape FluentPlayer uses.
:::

## 3. The consent gate

```php
apply_filters('fluent_player/behavior_can_report', true, [
    'user_id'     => get_current_user_id(),
    'has_contact' => Identity::isCurrentUserContact(),
    'ip'          => (string) $ip,
]);
```

`AbstractBehaviorHandler.php:46-50`. **Two accepted args**: the boolean, and the context array.

It is a per-visitor veto over *all* behavior reporting — automation and CRM timeline alike. It is checked twice: server-side before evaluation (`:100`), and at print time before the frontend reporters are even given a nonce (`FluentCrmBehaviorModule.php:133-135`). Return `false` and nothing attaches and nothing is recorded.

```php
add_filter('fluent_player/behavior_can_report', function ($canReport, $context) {
    // e.g. defer to a consent-management plugin for non-contacts
    if (empty($context['has_contact']) && !my_consent_plugin_has_analytics_consent()) {
        return false;
    }
    return $canReport;
}, 10, 2);
```

## 4. A complete handler

This one fires once per named chapter a viewer reaches. It is deliberately built on **fire-once markers**, because that is what the six-key whitelist actually supports — the markers go into `fired` as prefixed identity strings, exactly the way `LayerEventHandler` packs `"<layerId>:<event>"` into `layers_fired`.

```php
<?php

namespace MyPlugin\FluentPlayer;

use FluentPlayer\App\Hooks\Handlers\AbstractBehaviorHandler;

class ChapterReachedHandler extends AbstractBehaviorHandler
{
    // Binds wp_ajax_my_plugin_chapter_reached AND wp_ajax_nopriv_my_plugin_chapter_reached.
    const AJAX_ACTION = 'my_plugin_chapter_reached';

    // Prefix for our markers inside the shared, whitelisted `fired` list.
    // A milestone id is always "<key>:<4-decimal boundary|x>", so this cannot collide.
    const MARKER_PREFIX = 'myplugin_chapter:';

    protected function eventName()
    {
        return 'my_plugin/chapter_reached';
    }

    /**
     * What this media is armed for. Return falsy and evaluate() never runs —
     * the response is {"success":true,"data":{"fired":0,"reached":[]}}.
     *
     * @return array|false
     */
    protected function armedFor($mediaId)
    {
        $chapters = get_post_meta($mediaId, '_my_plugin_chapters', true);
        $chapters = array_values(array_filter(array_map('sanitize_key', (array) $chapters)));

        return $chapters ? $chapters : false;
    }

    /**
     * @return array ['state' => array, 'fired' => array[], 'reached' => string[], 'extra' => array]
     */
    protected function evaluate($mediaId, array $armed, array $state, array $identity)
    {
        // Request params come through the inherited $this->app->request.
        $claims = json_decode((string) wp_unslash($this->app->request->get('chapters', '[]')), true);
        $claims = is_array($claims) ? array_slice($claims, 0, 50) : [];

        // Anonymous pings never emit (see §2), so they must not mark anything
        // fired either — otherwise the event could never catch up on identify.
        $willEmit = !empty($identity['contact']) || (int) $identity['user_id'] > 0;

        // `fired` already holds MediaMilestoneHandler's milestone ids. Read the
        // whole list, append to it, and hand the whole list back.
        $firedSet = isset($state['fired']) ? array_values((array) $state['fired']) : [];

        $fired = [];

        foreach ($claims as $claim) {
            if (!is_string($claim)) {
                continue;
            }

            $chapter = sanitize_key($claim);
            if ($chapter === '' || !in_array($chapter, $armed, true)) {
                continue;
            }

            $marker = self::MARKER_PREFIX . $chapter;
            if (!$willEmit || in_array($marker, $firedSet, true)) {
                continue;
            }

            $firedSet[] = $marker;
            $fired[]    = [
                'media_id'      => $mediaId,
                'chapter'       => $chapter,
                'user_id'       => $identity['user_id'],
                'subscriber_id' => $identity['contact'] ? (int) $identity['contact']->id : 0,
                'email'         => $identity['email'],
            ];
        }

        // Only `fired` is ours to touch. union / watched / ts / layers /
        // layers_fired are carried through untouched by returning $state itself.
        $state['fired'] = array_values(array_unique($firedSet));

        return [
            'state'   => $state,
            'fired'   => $fired,
            'reached' => $this->reachedFromState($state),
            'extra'   => [],
        ];
    }

    /**
     * Response for a request that lost the identity+media lock and skipped
     * evaluation. The base returns the raw `fired` list, which would leak
     * MediaMilestoneHandler's milestone ids — keep only our own markers.
     */
    protected function reachedFromState(array $state)
    {
        $entries = isset($state['fired']) ? (array) $state['fired'] : [];
        $out     = [];

        foreach ($entries as $entry) {
            $entry = (string) $entry;
            if (strpos($entry, self::MARKER_PREFIX) === 0) {
                $out[] = substr($entry, strlen(self::MARKER_PREFIX));
            }
        }

        return $out;
    }
}
```

::: tip Why there is no `extraFromState()` here
`extraFromState()` (`AbstractBehaviorHandler.php:176-179`) adds handler-specific keys to the **lock-loser** payload, and the base returns `[]`. Neither shipped handler overrides it — which is why a milestone request that loses the lock comes back without the `coverage` key that `evaluate()` would otherwise have supplied (`MediaMilestoneHandler.php:83`). This handler returns no `extra` at all, so the inherited empty array is already right. Override it only when `evaluate()` produces an `extra` your callers cannot do without.
:::

Register it — the FluentCRM guard is inside `register()`, so calling it unconditionally is safe:

```php
add_action('init', function () {
    \MyPlugin\FluentPlayer\ChapterReachedHandler::register();
});
```

::: tip Do not call `register()` more than once
Each call attaches another `wp_ajax_*` callback on a fresh instance, so the handler would run twice per request — and the second run would see the state the first one just wrote.
:::

Consume the event like any WordPress action:

```php
add_action('my_plugin/chapter_reached', function ($ctx) {
    // $ctx is one of the arrays you built in evaluate()'s `fired` list
    error_log(sprintf(
        'media %d chapter "%s" reached by contact %d',
        $ctx['media_id'],
        $ctx['chapter'],
        $ctx['subscriber_id']
    ));
});
```

## 5. Calling it from the browser

The endpoint is plain `admin-ajax.php`. The nonce is minted server-side and injected into `window.fluent_player.crm_behavior.nonce` by `FluentCrmBehaviorModule::injectClientConfig()` (`app/Integrations/FluentCrm/FluentCrmBehaviorModule.php:123-145`, nonce at `:137`) through the `fluent_player/global_vars` filter (`:33`) — and only when the site is armed **and** `canReport()` passes.

Required parameters:

| Param | Value |
|---|---|
| `action` | your `AJAX_ACTION` |
| `nonce` | a `fluent_player_behavior` nonce |
| `media_id` | the media post ID |
| *(anything else)* | read it in `evaluate()` via `$this->app->request->get(...)` |

```js
const globals = window.fluent_player || {};
const config  = globals.crm_behavior;

// 'ajax_url' — the key FluentPlayer localizes (app/Services/MediaRenderer.php:307),
// read by resources/js/utils/ajax.js:10-17. Not WordPress's global `ajaxurl`.
if (config?.active && config.nonce && globals.ajax_url) {
    const body = new FormData();
    body.append('action', 'my_plugin_chapter_reached');
    body.append('nonce', config.nonce);
    body.append('media_id', String(mediaId));
    body.append('chapters', JSON.stringify(['intro']));

    fetch(globals.ajax_url, { method: 'POST', body, credentials: 'same-origin' });
}
```

Re-send a chapter claim on every ping rather than only the first time you observe it. The handler is idempotent — a claim already in `fired` is skipped — and re-claiming is what lets a chapter first crossed anonymously fire once the visitor becomes a contact.

FluentPlayer's own reporters do the same thing through a shared claim channel that prefers `navigator.sendBeacon` on unload — see `resources/js/behavior/claimChannel.js:39-51` and `resources/js/behavior/MilestoneReporter.js:27-35`.

::: warning Your nonce must be a `fluent_player_behavior` nonce
There is one nonce action for all handlers (`AbstractBehaviorHandler.php:15`). If FluentPlayer did not print `crm_behavior` (site unarmed, or consent denied), mint your own with `wp_create_nonce('fluent_player_behavior')` — but respect `canReport()` when you decide whether to print it at all.
:::

## 6. Verify

Every payload below is the `data` object of a `{"success":true,"data":{…}}` envelope; errors are `{"success":false,"data":{"message":…}}` (`AbstractBehaviorHandler.php:74`, `:78`).

1. **Registered.** With FluentCRM active, `has_action('wp_ajax_my_plugin_chapter_reached')` and `has_action('wp_ajax_nopriv_my_plugin_chapter_reached')` are both truthy. Without FluentCRM, both are `false` — that is correct behavior (`:31-33`).
2. **Rejects a bad nonce.** POST without `nonce` → HTTP 403, body `{"success":false,"data":{"message":"Security check failed"}}`.
3. **Rejects cross-origin.** POST with a foreign `Origin` header → 403 (`:90-92`).
4. **Rate limits.** More than 60 requests in a minute from one IP → 429 `Too many requests`.
5. **Short-circuits when unarmed.** With no `_my_plugin_chapters` meta, `data` is `{"fired":0,"reached":[]}` and `evaluate()` never runs (`:109-112`). Note this happens **before** the media lookup, so it also masks a bad `media_id`.
6. **Fires once.** As a logged-in contact, claim `intro` twice. First request: `data.fired` is `1`. Second: `data.fired` is `0`, `data.reached` still contains `"intro"`, and `my_plugin/chapter_reached` does not run again.
7. **The marker actually persisted.** Read the row directly and confirm the whitelist accepted it — for a logged-in non-contact:

   ```php
   $key = \FluentPlayer\App\Integrations\FluentCrm\BehaviorState::metaKey($mediaId);
   $row = get_user_meta(get_current_user_id(), $key, true);
   // $row['fired'] contains 'myplugin_chapter:intro'
   ```

   If `fired` is missing your marker, the clamp at `BehaviorState.php:77` rejected it — you wrote to a non-whitelisted key.
8. **Anonymous does not emit and does not mark.** Logged out and not a contact: `data.fired` stays `0` and no marker is written (`$willEmit` is false). Log in as a contact, re-claim the same chapter — the event fires then.
9. **Does not clobber other handlers.** Arm the same media for milestones too, run a milestone ping, then yours. `union`, `watched`, `ts`, `layers` and `layers_fired` must still hold their **pre-existing values** — not merely be present. `save()` re-merges `defaults()` on every write (`:77`), so a wiped key comes back as `[]` / `0.0` / `0` rather than disappearing; comparing values is the only check that can detect the failure.

## Reference

- Base class: `app/Hooks/Handlers/AbstractBehaviorHandler.php:13`
- Shipped handlers: `app/Hooks/Handlers/MediaMilestoneHandler.php:11`, `app/Hooks/Handlers/LayerEventHandler.php:11`
- Wiring: `app/Integrations/FluentCrm/FluentCrmBehaviorModule.php:13`, invoked at `app/Hooks/actions.php:20`
- State store: `app/Integrations/FluentCrm/BehaviorState.php` — `defaults()` (the six-key whitelist) `:14-18`, `resolveScope()` `:20`, `load()` `:33`, `save()` `:75` with the clamp at `:77`
- Milestone id format: `app/Services/Behavior/Milestones.php:60-65`; fired-set diffing at `app/Integrations/FluentCrm/MilestoneEvaluator.php:96-108`
- Arming registry: `app/Integrations/FluentCrm/BehaviorRegistry.php` — `armedFor()` `:59`, `layersFor()` `:71`, `clientConfig()` `:110`
- Frontend: `resources/js/behavior/claimChannel.js`, `MilestoneReporter.js`, `LayerReporter.js`
- Consent filter: `fluent_player/behavior_can_report` (`AbstractBehaviorHandler.php:46`, 2 args)
