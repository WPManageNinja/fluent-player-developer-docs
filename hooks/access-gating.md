---
title: "Access & Gating Hooks"
description: "The filter that decides whether FluentPlayer media may be viewed at all, the capability behind the authoring REST routes, and the filters for locked / access-denied markup."
---

# Access & Gating Hooks

These hooks decide **whether** a viewer may see a media item, **who** may author media, and **what** is shown when a media item is password-protected or access is denied. Each is a **filter** — always `return` the (possibly modified) first argument.

## `fluent_player/can_view_media`

**Type:** filter · **Source:** `app/Models/Media.php:302` · also re-dispatched in Pro at `fluent-player-pro/app/Hooks/Handlers/PlaylistShortcodeHandler.php:292` **(Pro)**

The plugin's **only real access-control filter**. It lives inside `Media::findVisible()` (`app/Models/Media.php:292-305`), which is the lookup every embed path uses. The default `$visible` comes from `Media::isStatusEmbeddable()` (`:276-283`): `publish` and `private` are embeddable (private is unlisted by design), everything else requires `read_post`.

**A falsy return blocks access.** `findVisible()` returns `null`, and the caller renders the access-denied curtain instead of the player. This is where you wire a membership plugin, a course-enrolment check, or a per-user paywall.

| Arg | Type | Description |
|---|---|---|
| `$visible` | `bool` | Default visibility from the post-status check. |
| `$media` | `object` | The media record (a `Post` model instance exposing `->ID`, `->post_status`, `->post_title`, `->settings`). |

```php
add_filter('fluent_player/can_view_media', function ($visible, $media) {
    if (!$visible) {
        return $visible; // already blocked — don't widen access
    }

    if (!get_post_meta($media->ID, 'requires_membership', true)) {
        return $visible;
    }

    return is_user_logged_in() && current_user_can('read_membership_content');
}, 10, 2);
```

::: warning Never blindly return `true`
Returning a hard `true` overrides the status check and can expose draft or trashed media. Gate *down* from `$visible`, not up.
:::

::: tip Pro playlists filter per item
Pro's playlist shortcode re-dispatches the same filter for every item it renders (`fluent-player-pro/app/Hooks/Handlers/PlaylistShortcodeHandler.php:292`), passing a `WP_Post`. Items that fail are silently skipped from the playlist. Your callback must therefore tolerate both a `Post` model and a `WP_Post` — use `$media->ID` and `$media->post_status`, which both expose.
:::

## `fluent_player/authoring_capability`

**Type:** filter · **Source:** `app/Helpers/Helper.php:1113`

Filters the capability required to author FluentPlayer content. `Helper::authoringCapability()` is consumed by `MediaPolicy` (`app/Http/Policies/MediaPolicy.php:16`), `LayerPolicy` (`:21`) and `PresetPolicy` (`:21`), which between them gate **22 REST routes** — media, layers, presets and smartcodes.

The default is `edit_others_posts` (Editors and Administrators). It is deliberately **not** `edit_posts` or `upload_files`: those also grant Contributors and Authors, and these routes have no per-object ownership check while covering destructive operations (delete, force-delete, bulk).

Site configuration routes (settings, integrations, migration) stay on `manage_options` and are **not** affected by this filter.

| Arg | Type | Description |
|---|---|---|
| `$capability` | `string` | Default `'edit_others_posts'`. Cast to string by the caller. |

```php
add_filter('fluent_player/authoring_capability', function ($capability) {
    return 'manage_fluent_player'; // a custom capability you grant explicitly
});
```

::: danger Loosening this widens 22 endpoints at once
Any capability you return here grants create / update / delete / bulk access to the whole shared media library. Prefer granting a narrow custom capability to the right roles over lowering this to `edit_posts`.
:::

## `fluent_player/media_locked_message`

**Type:** filter · **Source:** `app/Services/MediaRenderer.php:329` **and** `app/Services/MediaRenderer.php:359`

Filters the message shown for a password-protected media item. **It fires at two structurally different call sites, and the second one is conditional** — read both traps below before writing a callback.

| Arg | Type | Description |
|---|---|---|
| `$message` | `string` | Default message (`This media is password protected.`). |
| `$mediaId` | `int` | A **post ID**, not necessarily a `fluent_player_media` one — **`0` at the global call site**, the ID passed to `renderLockedForm()` at the per-media call site. See "Do not assume the ID is a media post" below. |

::: danger The two call sites are not interchangeable
`MediaRenderer.php:329` builds `$globalPlayerSettings['locked_message']` — the single, globally-localized string handed to the JS runtime for **any** media on the page. It passes a literal `0` as `$mediaId`.

`MediaRenderer.php:359` runs inside `lockedMarkup()` and passes the **real** `$mediaId` for the server-rendered curtain.

A naive "custom message per video" callback that ignores `$mediaId` will run against the global pass too, and leak one media's message into the string every other player on the page uses. Always guard on `$mediaId`.
:::

::: warning The per-media call site only fires when no message was supplied
`MediaRenderer.php:359` is wrapped in `if ($message === '')` (`app/Services/MediaRenderer.php:357`). The filter is a **default provider**, not a post-processor: a caller that already has a message skips it entirely.

The free render path calls `renderLockedForm($mediaId)` with no message (`app/Services/MediaRenderer.php:108`), so the filter does run there. But Pro's whole-playlist gate always resolves its own string through `fluent_player/playlist_password_message` first and passes it in (`fluent-player-pro/app/Hooks/Handlers/PlaylistShortcodeHandler.php:113-114`) — so on the playlist path `media_locked_message` **never fires at all**.

To change the wording of a locked *playlist*, hook `fluent_player/playlist_password_message` (filter, 2 args: `$message`, `$playlistId`) instead. The global call site at `:329` is unconditional and always fires.
:::

::: danger Do not assume the ID is a media post
`MediaRenderer::renderLockedForm()` is public and documented in-source as "Reusable by media and the whole-playlist gate" (`app/Services/MediaRenderer.php:344-348`), so the ID it forwards to `lockedMarkup()` is whatever post the caller gated — Pro passes a `fluent_playlist` post ID (`fluent-player-pro/app/Hooks/Handlers/PlaylistShortcodeHandler.php:114`).

In the shipped tree that Pro call supplies a message and therefore skips this filter, but the same is **not** true of [`media_locked_html`](#fluent-player-media-locked-html) below, which does receive playlist IDs today. Either way, never call `Media::find($mediaId)` and dereference the result — for a playlist ID it returns `null`. Check `get_post_type($mediaId)` first, or guard with `isset()`.
:::

```php
add_filter('fluent_player/media_locked_message', function ($message, $mediaId) {
    // $mediaId === 0 → the global string shared by every player. Leave it alone.
    return $mediaId ? sprintf(
        /* translators: %s: media title */
        __('Enter the password to watch "%s".', 'your-textdomain'),
        get_the_title($mediaId)
    ) : $message;
}, 10, 2);
```

The same guard as a one-liner:

```php
add_filter('fluent_player/media_locked_message', fn ($msg, $id) => $id ? customFor($id) : $msg, 10, 2);
```

## `fluent_player/media_locked_html`

**Type:** filter · **Source:** `app/Services/MediaRenderer.php:376`

Filters the full HTML rendered in place of a locked media item, at the end of `MediaRenderer::lockedMarkup()`.

| Arg | Type | Description |
|---|---|---|
| `$html` | `string` | Default locked-state markup — **contains the password-entry form**. |
| `$mediaId` | `int` | The locked post's ID. **Not always a `fluent_player_media` post** — see below. |

::: danger `$mediaId` may be a playlist ID
`lockedMarkup()` is reached through the public `MediaRenderer::renderLockedForm()`, which its own docblock describes as "Reusable by media and the whole-playlist gate" (`app/Services/MediaRenderer.php:344-348`). Pro's playlist shortcode calls it with a **`fluent_playlist` post ID** when a whole playlist is password-protected (`fluent-player-pro/app/Hooks/Handlers/PlaylistShortcodeHandler.php:114`), and this filter then fires with that ID.

A callback that does `Media::find($mediaId)->settings` gets `null` back from `find()` and fatals on the property access. Branch on `get_post_type($mediaId)` if the distinction matters to you:

```php
if (get_post_type($mediaId) !== 'fluent_player_media') {
    return $html; // a locked playlist, not a media item
}
```
:::

::: danger Do not replace `$html` — the form is inside it
`$html` wraps the `<form class="fp-unlock-form">` built at `app/Services/MediaRenderer.php:362-369`: the password input, the submit button, and the `.fp-unlock-error` live region the frontend script writes into. (`:371-373` is the surrounding `.fp-media-locked` / `.fp-unlock-curtain` wrapper the form is nested in.)

Returning your own markup instead of `$html` deletes that form, so the media becomes **permanently un-unlockable** — there is no other way for a viewer to submit the password. Append to, prepend to, or wrap `$html`. Never discard it.
:::

```php
add_filter('fluent_player/media_locked_html', function ($html, $mediaId) {
    $notice = '<p class="my-lock-note">'
        . esc_html__('Members can unlock this lesson with the password from their welcome email.', 'your-textdomain')
        . '</p>';

    // Wrap — the unlock form inside $html is preserved.
    return '<div class="my-lock">' . $notice . $html . '</div>';
}, 10, 2);
```

If you genuinely need to render a login wall with no password path, gate the media with [`fluent_player/can_view_media`](#fluent-player-can-view-media) instead — that produces an access-denied curtain, which is not supposed to be unlockable.

## `fluent_player/access_denied_message`

**Type:** filter · **Source:** `app/Models/Media.php:344`

Filters the message shown when a viewer is not allowed to access a media item. Fires inside `Media::getAccessDeniedCurtain()`, which returns an empty string (and never reaches this filter) when the media is missing, public, private, or readable by the current user.

The default is `You do not have permission to view this video.` when logged in, `Please log in to view this video.` otherwise.

| Arg | Type | Description |
|---|---|---|
| `$message` | `string` | Default access-denied message. |
| `$id` | `int` | The media ID. |
| `$post` | `WP_Post` | The media post object. |

```php
add_filter('fluent_player/access_denied_message', function ($message, $id, $post) {
    if (!is_user_logged_in()) {
        return $message; // keep the "please log in" wording
    }

    return __('This video is available to subscribers only.', 'your-textdomain');
}, 10, 3);
```

## `fluent_player/access_denied_html`

**Type:** filter · **Source:** `app/Models/Media.php:352`

Filters the full HTML shown when access is denied. Unlike [`media_locked_html`](#fluent-player-media-locked-html), this markup carries no interactive form, so replacing it wholesale is safe.

| Arg | Type | Description |
|---|---|---|
| `$html` | `string` | Default access-denied markup. |
| `$id` | `int` | The media ID. |
| `$post` | `WP_Post` | The media post object. |

```php
add_filter('fluent_player/access_denied_html', function ($html, $id, $post) {
    return '<div class="paywall">'
        . esc_html__('Upgrade to watch.', 'your-textdomain')
        . '</div>';
}, 10, 3);
```

## Three inverted defaults

Discoverability and consent. The next three filters all default to a value that is the *opposite* of what their names suggest, or are consumed through a negation. Each one has a real consequence if you get the polarity backwards, so read the direction of travel before you write the callback.

### `fluent_player/media_discoverable`

**Type:** filter · **Source:** `app/Hooks/Handlers/FluentPlayerMediaCPT.php:107` · **Args:** 1

The **master discoverability switch** for the dedicated `fluent_player_media` pages. Its default is **`false`**, which is the *locked-down* state: dedicated media pages are unlisted — playable by direct URL, but kept out of sitemaps and served `noindex`.

| Arg | Type | Description |
|---|---|---|
| `$discoverable` | `bool` | Default **`false`**. No media ID is passed — this is a **site-wide** switch, not per-item. |

`FluentPlayerMediaCPT::isDiscoverable()` is read at three places, and **returning `true` relaxes all three at once**:

| Consumer | With the `false` default | If you return `true` |
|---|---|---|
| `noindexDedicatedPage()` (`:113-129`) | `noindex, nofollow` added to `wp_robots` | The whole noindex branch is skipped — pages become indexable |
| `excludeFromSitemap()` (`:131-138`) | CPT `unset()` from WP core sitemaps | CPT is left in the sitemap |
| `excludeFromSeoPluginSitemap()` (`:140-146`) | Returns `true` (excluded) for Yoast and Rank Math | Falls through — SEO plugins index the archive |

::: danger `true` exposes every dedicated media page at once
This is the one filter here where the "positive"-sounding return is the permissive one. Returning `true` opts your whole media library into video SEO: archives, sitemaps and search indexing. That is a legitimate choice — but if any of your media is unlisted-by-URL only (`private` status is embeddable by design, see [`can_view_media`](#fluent-player-can-view-media)), flipping this switch publishes it to crawlers. It is site-wide; there is no per-media escape hatch on this hook.
:::

```php
// Opt in to video SEO for the whole library.
add_filter('fluent_player/media_discoverable', function ($discoverable) {
    return true;
});
```

### `fluent_player/media_page_noindex`

**Type:** filter · **Source:** `app/Hooks/Handlers/FluentPlayerMediaCPT.php:120` · **Args:** 2

Per-media override of the `noindex` robots directive on a dedicated media page. Default is **`true`** — meaning "yes, noindex this page".

| Arg | Type | Description |
|---|---|---|
| `$noindex` | `bool` | Default **`true`** (do add `noindex`). |
| `$postId` | `int` | The media post, from `get_the_ID()`. |

::: danger The default is `true` and it is consumed through a negation
The call site is:

```php
if (!apply_filters('fluent_player/media_page_noindex', true, get_the_ID())) {
    return $robots; // no noindex added
}
```

So **returning `false` is what makes the page indexable**, and returning `true` (or doing nothing) keeps it hidden. Read it as `$shouldNoindex`, not as a permission flag. A callback that returns `false` "to be safe" achieves the opposite of safe.
:::

It only runs after two earlier gates in `noindexDedicatedPage()` (`app/Hooks/Handlers/FluentPlayerMediaCPT.php:113-122`): the request must be `is_singular('fluent_player_media')`, and `media_discoverable` must still be `false`. If you already returned `true` from `media_discoverable`, this filter never fires — the site-wide switch short-circuits first.

```php
// Publish just the free preview lessons; leave everything else noindexed.
add_filter('fluent_player/media_page_noindex', function ($noindex, $postId) {
    if (get_post_meta($postId, 'is_free_preview', true)) {
        return false; // false === indexable
    }

    return $noindex;
}, 10, 2);
```

### `fluent_player/behavior_can_report`

**Type:** filter · **Source:** `app/Hooks/Handlers/AbstractBehaviorHandler.php:46` · **Args:** 2

A per-visitor **consent veto** over all FluentCRM behavior reporting — both the automation triggers and the CRM timeline. The default is **`true`** (report), and it is consumed through a negation at both call sites, so **returning `false` is what disables reporting**.

| Arg | Type | Description |
|---|---|---|
| `$canReport` | `bool` | Default **`true`**. Cast to `bool` by the caller. |
| `$context` | `array` | Exactly three keys — see below. |

| Context key | Type | Value |
|---|---|---|
| `user_id` | `int` | `get_current_user_id()` — `0` for a logged-out visitor. |
| `has_contact` | `bool` | Whether the visitor resolves to a FluentCRM contact (`app/Integrations/FluentCrm/Identity.php:50-53`). |
| `ip` | `string` | The visitor IP — **empty at the print-time call site**, see the caution below. |

The filter is read at two points, and a `false` return stops reporting at both:

| Call site | Effect of `false` |
|---|---|
| `app/Hooks/Handlers/AbstractBehaviorHandler.php:100` | The AJAX request is rejected with `403` before any state is written. Called as `canReport($ip)`, so `$context['ip']` is populated. |
| `app/Integrations/FluentCrm/FluentCrmBehaviorModule.php:133` | Print-time veto — the `crm_behavior` client config is never emitted, so the browser reporters never attach at all. Called as `canReport()` with **no argument**, so `$context['ip']` is `''`. |

::: warning Do not key your consent decision on `$context['ip']` alone
The print-time call passes no IP, so `$context['ip']` is `''` there while being a real address at the AJAX call. A callback that reads only the IP will make two different decisions for the same visitor in the same page view — allowing the reporters to attach and then rejecting their requests, or vice versa. Key on `user_id` / a consent cookie / your consent plugin's own API instead, and treat `ip` as supplementary.
:::

The whole behavior surface is FluentCRM-gated: `AbstractBehaviorHandler::register()` returns early unless `FLUENTCRM` is defined (`app/Hooks/Handlers/AbstractBehaviorHandler.php:31-33`), so on a site without FluentCRM this filter never fires.

```php
add_filter('fluent_player/behavior_can_report', function ($canReport, $context) {
    if (!$canReport) {
        return $canReport; // already vetoed — don't re-enable
    }

    // Logged-in members have consented at signup.
    if (!empty($context['user_id'])) {
        return true;
    }

    return myplugin_visitor_has_analytics_consent();
}, 10, 2);
```

## See also

- [Unlock & Access Token Hooks](/hooks/unlock) — the token, rate limit and post-type filters behind the password form.
