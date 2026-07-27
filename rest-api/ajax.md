---
title: "Admin-AJAX Endpoints"
description: "FluentPlayer's admin-ajax.php actions — the public frontend entry points for email capture, unlock, behavior pings, and progression."
---

# Admin-AJAX Endpoints

Not everything FluentPlayer exposes is a REST route. The **frontend runtime talks to `wp-admin/admin-ajax.php`**, not to `/wp-json/fluent-player/v2/`. These actions are where email capture, password unlock, milestone/layer behavior reporting, analytics pings and course progression actually happen.

**Six of the seven are registered `nopriv`**, meaning logged-out visitors can call them; only `fluent_player_progression` is logged-in-only, and that is deliberate. They are the only public entry points most integrators need.

::: tip These are the endpoints behind the documented filters
[Email hooks](/hooks/email) and [Unlock hooks](/hooks/unlock) describe filters that fire *inside* `fluent_player_email_submit` and `fluent_player_unlock`. This page names the endpoints those filters run in.
:::

## Summary

All requests go to `POST <site>/wp-admin/admin-ajax.php` with an `action` field.

| Action | `nopriv` | Nonce action | Handler |
|---|---|---|---|
| `fluent_player_email_submit` | **yes** | per-target (see below) | `app/Hooks/Handlers/EmailCollectionHandler.php:57-58` |
| `fluent_player_unlock` | **yes** | `fluent_player_frontend` | `app/Hooks/Handlers/UnlockHandler.php:21-22` |
| `fluent_player_get_media_data` | **yes** | `fluent_player_frontend` | `app/Blocks/FluentCommunityMediaBlock.php:65-66` |
| `fluent_player_media_milestone` | **yes** | `fluent_player_behavior` | `AbstractBehaviorHandler.php:34-36` + `MediaMilestoneHandler.php:13` |
| `fluent_player_layer_event` | **yes** | `fluent_player_behavior` | `AbstractBehaviorHandler.php:34-36` + `LayerEventHandler.php:13` |
| `fluent_player_track_event` **(Pro)** | **yes** | per-media (see below) | Pro `app/Hooks/Handlers/AnalyticsHandler.php:56-57` |
| `fluent_player_progression` | **no — logged-in only by design** | `fluent_player_frontend` | `app/Hooks/Handlers/ProgressionHandler.php:21` |

### Nonce actions are not uniform

There is no single site-wide AJAX nonce. Four different schemes are in play:

| Scheme | Used by | Value |
|---|---|---|
| `fluent_player_frontend` | unlock, media-data, progression | Minted with `wp_create_nonce('fluent_player_frontend')` and shipped in the localized player config (for example `app/Blocks/FluentCommunityMediaBlock.php:534`). |
| `fluent_player_behavior` | milestone, layer-event | `AbstractBehaviorHandler::NONCE_ACTION` (`app/Hooks/Handlers/AbstractBehaviorHandler.php:15`), verified at `:84`. |
| per-target email nonce | email submit | `fluent_player_email_submit:preset:<mediaId>:<presetSlug>` or `fluent_player_email_submit:layer:<mediaId>:<layerId>` — built by `EmailCollectionService::getNonceAction()` (`app/Services/EmailCollectionService.php:21-33`). |
| per-media analytics nonce | track event **(Pro)** | `fluent_player_track_event:<mediaId>` (Pro `app/Hooks/Handlers/AnalyticsHandler.php:117`). |

---

## `fluent_player_email_submit` (public)

Writes a row to the `flp_email_collections` table and fans the address out to the configured email providers. Registered at `app/Hooks/Handlers/EmailCollectionHandler.php:57-58`; the handler is `EmailCollectionHandler::submit()` (`:67-144`).

### Parameters

| Param | Required | Notes |
|---|---|---|
| `action` | yes | `fluent_player_email_submit` |
| `nonce` | yes | Per-target — see the table above. Mismatch → *"Invalid request"* (`:290-292`). **Verified last**, see below. |
| `email` | yes | Sanitized with `sanitize_email`; must pass `FILTER_VALIDATE_EMAIL` (`:265-267`). |
| `media_id` | yes | Integer; empty → *"Media ID is required"* (`:269-271`). |
| `type` | no | `preset` (default) or `layer` (`:223`). Anything else → *"Invalid type"* (`:177`). |
| `preset_slug` | when `type=preset` | Required (`:274-276`); must resolve to a known preset, else *"Invalid preset"* (`:150-152`). |
| `layer_id` | when `type=layer` | Required (`:279-281`); must resolve to a layer on that media, else *"Invalid layer"* (`:157-175`). |
| `video_time` | no | Float, stored on the submission (`:224`). |

`user_id`, `ip_address`, `browser` and `device` are derived server-side and cannot be spoofed by the client (`:226-229`).

::: warning The nonce is verified **last**, after every other validation
`validateRequestData()` (`:256-293`) runs the `fluent_player/validate_email_submission` filter (`:259`), then checks the email (`:265-267`), `media_id` (`:269-271`), `preset_slug` (`:274-276`) and `layer_id` (`:279-281`) — and only then computes the expected nonce action and calls `wp_verify_nonce()` (`:283-292`).

Two consequences for anyone building on this endpoint:

- A caller with a **garbage nonce still receives field-level validation messages** (*"Invalid email address"*, *"Media ID is required"*, …). Do not treat any specific error text as proof the nonce was accepted; only *"Invalid request"* means the nonce failed, and only success means it passed.
- The expected nonce action is **derived from the submitted `type` / `media_id` / `preset_slug` / `layer_id`** (`:283-288`), so the target must already be well-formed for the comparison to be meaningful. That is why the order is this way round, but it does mean a `fluent_player/validate_email_submission` callback runs on **unauthenticated input**. Treat `$data` there as hostile.
:::

### Rate limiting

Guests only — logged-in users are exempt (`:336-340`). Default **3 attempts per 5 minutes** per IP + target, both filterable via `fluent_player/email_submission_rate_limit_max_attempts` and `fluent_player/email_submission_rate_limit_window` (`:342-352`). Exceeding it throws with code `429`.

The limiter runs at `:86` — **after** `resolveCaptureSettings()` (`:83`) and `findExistingSubmission()` (`:84`), which are a preset/media-settings lookup and a `flp_email_collections` query respectively. Every request that gets past validation therefore costs two reads before it can be throttled.

### Response

Success — `wp_send_json_success` (`:127`):

```json
{ "success": true, "data": { "message": "Email collected successfully" } }
```

If any provider reported a pending double-opt-in confirmation, the message becomes *"Please check your inbox to confirm your email address."* (`:399-416`).

A repeat submission of the same address for the same target does **not** re-run the providers: it refreshes the stored context, replays the last provider log, and returns the plain success message (`:88-98`).

Failure — `wp_send_json_error` with the exception message and its code clamped into 400–599, defaulting to 500 (`:129-143`):

```json
{ "success": false, "data": { "message": "Invalid email address" } }
```

See [Email hooks](/hooks/email) for the filters that run inside this flow (`fluent_player/pre_process_email_submit`, `fluent_player/validate_email_submission`, `fluent_player/raw_request_data`, `fluent_player/email_providers`, `fluent_player/submission_data`, `fluent_player/email_collected`).

---

## `fluent_player_unlock` (public)

Verifies a media password and, on success, sets the **HttpOnly per-media unlock cookie**. No token or HTML is returned, so nothing sensitive is exposed to JavaScript — the frontend simply reloads and the server renders the real player once the cookie validates (`app/Hooks/Handlers/UnlockHandler.php:11-16`).

### Parameters

| Param | Required | Notes |
|---|---|---|
| `action` | yes | `fluent_player_unlock` |
| `nonce` | yes | `fluent_player_frontend` (`:29`). |
| `id` | yes | Media post id, `absint()` (`:33`). |
| `password` | yes* | Not required when the post no longer needs a password (`:42-44`). |

### Responses

| Status | Code | When |
|---|---|---|
| `403` | `bad_nonce` | Nonce check failed (`:29-31`). |
| `404` | `not_found` | No such post, or its post type is not in `fluent_player/unlockable_post_types` (`:36-40`). |
| `400` | `password_required` | Empty password (`:46-49`). |
| `429` | `rate_limited` | `UnlockService::isRateLimited()` (`:51-53`). |
| `403` | `incorrect` | Wrong password; also bumps the rate limiter (`:55-58`). |
| `200` | — | `wp_send_json_success()` with **no payload**. The cookie is set via `UnlockService::sendUnlockCookie()` (`:60-61`). |

A media that is already unlocked (`post_password_required()` false) returns bare success without checking the password at all (`:42-44`).

See [Unlock hooks](/hooks/unlock).

---

## `fluent_player_get_media_data` (public)

Returns render-ready media data for the FluentCommunity portal, where the player is mounted client-side rather than server-rendered. Registered at `app/Blocks/FluentCommunityMediaBlock.php:65-66`; handler at `:742-802`.

### Parameters

| Param | Required | Notes |
|---|---|---|
| `action` | yes | `fluent_player_get_media_data` |
| `nonce` | yes | `fluent_player_frontend` (`:747`). |
| `media_id` | yes | `intval()`; falsy → `{"error": "Invalid media ID"}` (`:753-757`). |
| `access_key` | for private media | Render-issued token. Required when the media is `private` and the caller cannot `read_post` it — see below (`:766-768`). |

### Access control

This route is `nopriv` and its nonce is visible in portal page source, so anyone can call it. Three guards apply:

1. **Private media need an access key.** `isPrivateFetchAllowed()` (`:813-824`) lets the request through only when the post is not private, or the caller can `read_post`, or `UnlockService::validateAccessToken()` accepts the supplied key — so sequential media ids cannot be enumerated. A failed private fetch returns `403 {"error": "Media not found"}` (`:779`) and counts toward a per-IP brake (default **60**/window, filterable via `fluent_player/media_data_rate_limit`) that returns `429 {"error": "Too many requests"}` when tripped (`:773-778`). Successful and ordinary published loads never count.
2. **Password-protected media** return `{"error": "This media is password protected."}` unless the unlock cookie validates (`:784-787`).
3. **Signed CDN / DRM URLs are gated on `edit_post`.** Only a caller who can edit the media gets `settings` through the `fluent_player/player_settings` filter (`:795-796`); everyone else gets the payload stripped of provider `config` blocks by `filterSensitiveMediaData()` (`:798`, defined at `:826-856`).

### Response

`wp_send_json($mediaData)` (`:801`) — the raw array from `MediaService::prepareMediaForFrontend($media, 'fluent-community')`, **not** wrapped in the `{success, data}` envelope.

::: danger Most failures on this endpoint are HTTP **200**
`wp_send_json()` defaults to a `200` status. Only two of the five failure paths pass an explicit status code, so a client that branches on the HTTP status will read four different errors as success:

| Failure | Status | Body | Source |
|---|---|---|---|
| Bad or missing nonce | **200** | `{"error": "Invalid nonce"}` | `:747-750` |
| Falsy `media_id` | **200** | `{"error": "Invalid media ID"}` | `:753-757` |
| `Media::findVisible()` found nothing | **200** | `{"error": "Media not found"}` | `:759-764` |
| Private media, access key rejected | `403` | `{"error": "Media not found"}` | `:768`, `:779` |
| Too many rejected private fetches | `429` | `{"error": "Too many requests"}` | `:775-778` |
| Password-protected, not unlocked | **200** | `{"error": "This media is password protected."}` | `:784-787` |

Always branch on the presence of an `error` key, never on `response.ok` or `success === false`. Note also that the two "not found" bodies are identical by design — a rejected private fetch is indistinguishable from a genuinely missing media, which is what stops id enumeration.
:::

---

## `fluent_player_media_milestone` and `fluent_player_layer_event` (public)

Both extend `AbstractBehaviorHandler`, which supplies registration, security, rate limiting and locking. They report watch milestones and layer interactions so FluentCRM automations can fire.

::: warning Registered only when FluentCRM is active
There are **two** gates, both checking `defined('FLUENTCRM')`. `FluentCrmBehaviorModule::register()` bails at `app/Integrations/FluentCrm/FluentCrmBehaviorModule.php:15-17` before it ever calls the handlers, and `AbstractBehaviorHandler::register()` bails again at `app/Hooks/Handlers/AbstractBehaviorHandler.php:31-33`. Without FluentCRM these two actions **do not exist**, and a request to them gets WordPress's generic `0` response, not a FluentPlayer error.
:::

### Shared contract

| Constant | Value | Source |
|---|---|---|
| Nonce action | `fluent_player_behavior` | `:15` |
| Rate limit | **60 requests per minute per IP** | `:16` (`RATE_LIMIT`), enforced at `:236-253` |
| Lock TTL | **15 seconds** | `:18` (`LOCK_TTL`) |
| Anonymous cookie | `flp_bhv_anon`, 6 hours | `:19-20` |

Shared parameters:

| Param | Required | Notes |
|---|---|---|
| `action` | yes | `fluent_player_media_milestone` or `fluent_player_layer_event` |
| `nonce` | yes | `fluent_player_behavior` (`:83-86`). |
| `media_id` | yes | `absint()`; falsy → `422` *"Invalid media"* (`:104-107`). |

Shared guards, in the order `process()` (`:81-168`) actually runs them:

1. Nonce → `403` *"Security check failed"* (`:83-86`).
2. **Same-origin check** on `Origin`/`Referer` → `403` (`:90-92`, `:297-311`). The `nopriv` nonce is a shared public value, so this is the real CSRF defence; when neither header is present the check falls back to the nonce alone (`:309-310`).
3. Per-IP rate limit → `429` *"Too many requests"* (`:94-97`).
4. `fluent_player/behavior_can_report` consent veto → `403` *"Reporting is disabled for this visitor"* (`:44-51`, `:100-102`).
5. `media_id` must be a non-zero `absint()` → `422` *"Invalid media"* (`:104-107`).
6. **`armedFor($mediaId)`** — falsy short-circuits to `{"fired": 0, "reached": []}` (`:109-112`).
7. Media must resolve via `Media::findVisible()` → `404` *"Invalid media"* (`:114-117`).

::: warning Steps 6 and 7 are in that order — the arming check comes first
An unarmed media **never reaches the 404 branch**. A request naming a trashed, draft or otherwise non-visible media id gets a `200` with `{"fired":0,"reached":[]}` as long as the site is not armed for it. Do not use this endpoint to probe whether a media exists.
:::

A **per identity + media mutex** (an atomic row in `wp_options`) then serialises load → evaluate → save → emit, so two concurrent pings cannot double-emit the same milestone. The lock-loser returns the already-stored state with `fired: 0` instead of erroring (`:130-138`).

The unarmed short-circuit at step 6 skips the media lookup, the identity resolution, the lock and the state row — but it is **not** free of DB work. `BehaviorRegistry::armedFor()` (`app/Integrations/FluentCrm/BehaviorRegistry.php:59`) goes through `map()` (`:38-52`), which reads a transient and rebuilds the whole arming map from its sources on a cold cache (`:44-51`, TTL 120 s at `:22`).

### `fluent_player_media_milestone`

Additional parameters (`app/Hooks/Handlers/MediaMilestoneHandler.php:27-45`):

| Param | Notes |
|---|---|
| `segments` | JSON array of watched intervals. **Capped at 5000 entries**, silently truncated (`:31-33`). |
| `duration` | Client-reported duration, cross-checked against the server-known duration. |
| `ended` | Boolean, parsed with `FILTER_VALIDATE_BOOLEAN`. |

Response:

```json
{
  "success": true,
  "data": { "fired": 1, "reached": ["started:x", "q25:0.2500", "q50:0.5000"], "coverage": 0.5231 }
}
```

`fired` counts emitted events (always `0` for a visitor with neither a FluentCRM contact nor a user id — the state is still recorded so events catch up on identification), `reached` lists every milestone id fired so far, and `coverage` is the watched fraction rounded to 4 decimals (`:71-84`).

A milestone id is always `"<key>:<boundary>"`, where `key` is `started`, `q25`, `q50`, `q75` or `completed` and `boundary` is a 4-decimal fraction or the literal `x` when there is none — `app/Services/Behavior/Milestones.php:60-65`. Parse it; do not pattern-match on substrings.

::: tip `coverage` is absent when the lock is lost
`coverage` comes from the `extra` key that `evaluate()` returns (`MediaMilestoneHandler.php:83`). A request that loses the identity+media mutex skips `evaluate()` and falls back to `extraFromState()`, which `MediaMilestoneHandler` does not override — so the base `[]` is used (`AbstractBehaviorHandler.php:134-138`, `:176-179`) and the response has `fired` and `reached` only. Read `coverage` defensively.
:::

### `fluent_player_layer_event`

Additional parameters (`app/Hooks/Handlers/LayerEventHandler.php:28-29`):

| Param | Notes |
|---|---|
| `crossed` | JSON array of `"<layerId>:<event>"` claims. **Capped at 50 entries.** `event` must be one of `seen`, `completed`, `skipped` (`:14`). |

Claims are plausibility-checked before they count: `completed` and `skipped` require a prior `seen`, and an ad layer's `completed` cannot arrive faster than its skip offset allows, capped at 30 seconds (`:104-117`). Hotspot layers are excluded entirely (`:129`).

Response:

```json
{
  "success": true,
  "data": { "fired": 2, "reached": ["layer-1:seen", "layer-1:completed"] }
}
```

Every error from these two handlers — including the `403`/`422`/`429`/`404` guards above — goes through `wp_send_json_error(['message' => …], $code)` (`AbstractBehaviorHandler.php:73-75`), so the message is nested, not top-level. An unhandled throwable is caught at `:66-71` and reported as HTTP `500`:

```json
{ "success": false, "data": { "message": "An unexpected error occurred" } }
```

Successes are `wp_send_json_success()`-wrapped in the same way (`:78`), which is why the two response samples above have a `data` key.

---

## `fluent_player_track_event` (public) **(Pro)**

Records a playback visit into `flp_visits`. Registered at Pro `app/Hooks/Handlers/AnalyticsHandler.php:56-57`, but **only when analytics is enabled in settings** (`:45-47`) — otherwise the action is not registered at all.

### Parameters

| Param | Required | Notes |
|---|---|---|
| `action` | yes | `fluent_player_track_event` |
| `nonce` | yes | Per-media: `fluent_player_track_event:<media_id>` (`:117-118`). A missing nonce is rejected *before* any input processing (`:66-73`). |
| `media_id` | yes | `intval`, validated `required\|integer`. |
| `duration` | yes | `floatval`, validated `required\|numeric\|min:0`, **capped at 86400** (24 h). |
| `percentage` | no | `intval`, validated `integer\|min:0\|max:100`, capped at 100. |

### Responses

| Status | When |
|---|---|
| `403` | Missing nonce (`:68-73`), or nonce does not match `fluent_player_track_event:<media_id>` (`:118-123`). |
| `429` | More than **30 requests per minute per IP** (transient-based, `:75-87`). |
| `422` | Validation failed — includes an `errors` bag (`:104-110`). |
| `404` | `Media::findVisible()` returned nothing (`:125-131`). |
| `500` | Unhandled exception. |
| `200` | `{"success": true, "data": {"message": "Visit recorded successfully"}}` (`:140-142`). |

Note the ordering: the nonce is checked for **presence** first, but its **value** is only verified after `media_id` is known, because the expected action is per-media.

---

## `fluent_player_progression` (logged-in only)

Receives raw watched segments and returns a completion verdict, then fires `fluent_player/watch_recorded` so an LMS adapter (LearnDash first) can mark a step complete. Registered at `app/Hooks/Handlers/ProgressionHandler.php:21`.

::: warning No `nopriv` variant — this is deliberate
The class docblock is explicit: *"No nopriv variant — completion is always per-user."* (`ProgressionHandler.php:11-16`). Only `wp_ajax_fluent_player_progression` is registered. A logged-out caller gets WordPress's `0` response, not a FluentPlayer error.
:::

### Parameters

| Param | Required | Notes |
|---|---|---|
| `action` | yes | `fluent_player_progression` |
| `nonce` | yes | `fluent_player_frontend` (`:28`). |
| `media_id` | yes | `absint()`; must be a `fluent_player_media` post (`:37-41`). |
| `segments` | no | JSON array of watched intervals; non-arrays become `[]`. **Capped at 5000 entries**, silently truncated (`:43-51`). |
| `duration` | no | Client-reported duration. Reconciled with the server-known duration by `ProgressionService::pickDuration()` (`:53-60`); external providers (Bunny/Mux/Gumlet) store theirs under `<provider>.duration`. |
| `ended` | no | Boolean via `FILTER_VALIDATE_BOOLEAN`. |
| `muted_autoplay` | no | Boolean; flags evidence gathered during muted autoplay. |
| `course_id` | no | `absint()`, passed to the adapter as context. |
| `step_id` | no | `absint()`, passed to the adapter as context. |

### Responses

| Status | Code | When |
|---|---|---|
| `403` | `bad_nonce` | Nonce check failed (`:28-30`). |
| `401` | `not_logged_in` | No current user (`:32-35`). |
| `404` | `not_found` | Media missing or wrong post type (`:37-41`). |
| `200` | — | Verdict payload. |

```json
{
  "success": true,
  "data": {
    "verdict": { },
    "durationSource": "server"
  }
}
```

`durationSource` tells you which duration the verdict was computed against — useful when a client-reported duration disagrees with the stored one (`:77-80`).
