---
title: "JS API"
description: "FluentPlayer's frontend JavaScript surface — window globals, custom events, localized config objects, and the runtime modules."
---

# JS API

FluentPlayer's frontend is built on **Vidstack** (`vidstack@1.12.13`) with **hls.js** (`1.6.15`) for HLS. The plugin's own JavaScript wraps the `<media-player>` element, initializes it from a PHP-localized config object, and adds its own overlays, trackers, and playlist runtime on top.

This page documents **FluentPlayer's own surface only**. For playback control (`play()`, `pause()`, `currentTime`, `duration`, and the native media events) go straight to the [Vidstack docs](https://vidstack.io) — FluentPlayer neither wraps nor replaces that API.

::: tip All frontend JS ships in the free plugin
`fluent-player-pro/resources/` is empty — Pro contains no JavaScript sources of its own. Every module, global, and event below lives in the **free** repo under `resources/`, even where the feature it drives is Pro-gated. If you are looking for the code behind a Pro runtime behavior, look in the free repo.
:::

## `window` globals

**Five globals are API.** The plugin writes other properties to `window`, but none of them is an extension point — see [everything else on `window`](#everything-else-on-window) for the complete list and why you should not build on it.

| Global | Type | Source | What it is |
|---|---|---|---|
| `window.initFluentPlaylists` | function | `resources/js/fluent-playlist.js:116` | Re-scans the document for `.fluent-playlist` containers and initializes any that aren't already running. **The one entry point built for third parties.** |
| `window.FluentPlayer` | class | `resources/js/fluent-player.js:214` | The player **constructor** — not an instance. See the limitation below. |
| `window.FluentPlaylist` | class | `resources/js/fluent-playlist.js:115`, also `resources/js/FluentPlaylist.js:2728` | The playlist constructor, assigned in both the entry module and the class module. |
| `window.FluentBrowserStorage` | object | `resources/js/BrowserStorage.js:170` | A live singleton for playback positions and persisted layer condition state. |
| `window.fluentPlayerMediaCache` | object | `resources/blocks/media/edit.jsx:822` | Block-editor only. A `{ [mediaId]: { settings, title } }` memo the media block writes for the FluentCommunity integration. Not present on the front end. |

### `initFluentPlaylists()` — re-init after AJAX content

Takes no arguments. It walks `.fluent-playlist` containers, skips any already tracked in the module's instance map, purges instances whose containers left the DOM, and dispatches `fluentPlaylistInitialized` when it finishes (`resources/js/fluent-playlist.js:57-84`).

```js
// After injecting markup that contains a FluentPlayer playlist:
if (typeof window.initFluentPlaylists === 'function') {
    window.initFluentPlaylists();
}
```

It is safe to call repeatedly — already-initialized containers are skipped. A `MutationObserver` on `document.body` already calls it automatically when a `.fluent-playlist` node is added (`resources/js/fluent-playlist.js:94-112`), so you usually only need the manual call when your markup arrives some other way.

### Known limitation: you cannot reach a running player

`window.FluentPlayer` is the class, so `new window.FluentPlayer(container, config)` works — but there is **no supported way to get the instance FluentPlayer already created for a container on the page.**

Live instances are stored in a module-private `Map` keyed by container id (`const playerInstances = new Map()`, `resources/js/fluent-player.js:21`), and that map is never exported, never attached to `window`, and never attached to the container element. The playlist runtime does the same thing (`playlistInstances`, `resources/js/fluent-playlist.js:5`).

What you *can* reach:

- The `<media-player>` element itself — `container.querySelector('media-player')` — which gives you the full Vidstack API. That is the practical workaround.
- The per-instance localized config, via the container's `data-var_name` attribute: `window[container.dataset.var_name]`. The attribute is stamped on the container at `app/Views/player.php:148`; the object it names is localized by `MediaRenderer` at `app/Services/MediaRenderer.php:198` and re-read at `resources/js/fluent-player.js:66`. See [DOM attributes](/reference/dom-attributes).

Do not re-create an instance for a container that already has one — you would get duplicate trackers and double-counted analytics.

### Everything else on `window`

None of the following is API. They are listed so the "five globals" claim above is exact, and so you can recognise them when you see them in a console.

**Frontend runtime** (`resources/js/`):

| Property | Source | What it is |
|---|---|---|
| `window.__fluentPlayerBootstrapped` | `fluent-player.js:196` | Bootstrap guard, so the entry module can evaluate twice without doubling every tracker. |
| `window._fluentPlaylistAbortHandled` | `FluentPlaylist.js:100` | One-shot flag for an aborted-request handler. |
| `window.__flpUrlPlaybackTarget` | `utils/urlPlaybackTarget.js:82` | Per-page memo of the parsed `flp_r` / `flp_v` / `flp_t` deep-link target. Set to `null` when the URL has none. |
| `window.__flpUrlPlaybackScrolledKeys` | `utils/urlPlaybackTarget.js:131` | `Set` of targets already scrolled to. |
| `window[varName]` | written back at `fluent-player.js:78`, `fluent-playlist.js:39` and `:49` | The **dynamically named** per-instance config objects. Not a fixed property — the name comes from `data-var_name`. |

**Block editor and page-builder bundles only** — never present on the front end:

| Property | Source | What it is |
|---|---|---|
| `window.fluentPlayerBlockVars` | PHP-localized (`app/Blocks/MediaBlock.php:169`); also written by JS at `resources/blocks/media/divi/index.jsx:47`, `resources/blocks/playlist/divi/index.jsx:45`, and defensively at `resources/blocks/media/components/BunnyCDN.jsx:85` | Panel vars. Read it; do not rely on writing it. |
| `window.fluentPlayerInPageBuilder` | `resources/blocks/media/elementor/ensureMediaUpload.js:9` | Marker set inside a builder canvas. |
| `window.__fpElPreviewForwarder` | `resources/blocks/media/elementor/editor.jsx:280` | Guard so the Elementor preview forwarder installs once. |
| `window.__fpUnderscoreRestoring` | `resources/blocks/media/elementor/ensureMediaUpload.js:46` | Re-entrancy guard around the Underscore restore shim. |
| `window._` | `resources/blocks/media/fluent-player-block.jsx:34` | A **third-party global**, not FluentPlayer's. The block bundle creates an empty stand-in and polyfills `_.isArray` (`:38-41`) only when Underscore.js is absent, because `wp.media` assumes it. |
| `window.$RefreshReg$` · `window.$RefreshSig$` · `window.__vite_plugin_react_preamble_installed__` | `resources/blocks/reactSupport.jsx:4`, `:6`, `:7` | Vite React-refresh preamble stubs. Development tooling. |

### Inbound events FluentPlayer listens for

Two document-level events let you drive initialization without touching the private map (`resources/js/fluent-player.js:207-211`):

| Event | Effect |
|---|---|
| `FComMediaReady` | Re-runs `initFluentPlayers(true)` — force-reinitializes every player on the page. |
| `InitSingleFluentPlayer` | Initializes one player. Expects `detail.container`, optionally `detail.playerData`. |

```js
document.dispatchEvent(new CustomEvent('InitSingleFluentPlayer', {
    detail: { container: myContainerEl }
}));
```

The whole bootstrap is guarded by `window.__fluentPlayerBootstrapped` (`resources/js/fluent-player.js:195-196`) so the entry can evaluate twice without doubling every tracker.

## Custom events

FluentPlayer dispatches its own `CustomEvent`s. These are **distinct from native Vidstack / `HTMLMediaElement` events** (`play`, `pause`, `ended`, `timeupdate`, …), which come from the `<media-player>` element and are documented by Vidstack. Everything in this table is FluentPlayer's.

### Frontend runtime events

| Event | Dispatched on | Source | `detail` |
|---|---|---|---|
| `fluent-player-play` | `document` | `resources/js/FluentPlayer.js:2937` | `{ playerId }` |
| `playlist-media-completed` | the `<media-player>` element | `resources/js/MediaWatchTracker.js:190` | `{ mediaId, percentage, watchedTime, segments }` |
| `fluentPlaylistInitialized` | `document` | `resources/js/fluent-playlist.js:83` | none |

`fluent-player-play` is how FluentPlayer pauses every *other* player on the page: each instance broadcasts on play, and every instance whose `playerId` differs pauses itself (`resources/js/FluentPlayer.js:2936-2952`). Note it is dispatched on `document`, not on the player element — listen on `document`.

`playlist-media-completed` is the opposite: it is dispatched on the player element (`this.player.dispatchEvent(event)`), so it bubbles from there.

### Editor / page-builder events

These fire only in the block editor and page-builder canvases. They exist so a settings panel outside the canvas can push changes into the preview.

| Event | Dispatched on | Source | `detail` |
|---|---|---|---|
| `fluentPlayer/mediaUpdated` | `document` | `resources/blocks/media/page-builder/TimedContentEditor.jsx:188`, `resources/blocks/media/divi/SettingsField.jsx:48` | `{ mediaId }` |
| `fluentPlayer/settingsPreview` | `document`, then re-dispatched into the canvas iframe document | `resources/blocks/media/elementor/MediaSettingsApp.jsx:119`, `resources/blocks/media/elementor/editor.jsx:284` | `{ mediaId, settings, defaultSettings }` |
| `fluentPlayer/playlistUpdated` | `document` | `resources/blocks/playlist/divi/PlaylistSettingsApp.jsx:98` | `{ playlistId }` |
| `fluentPlayer/playlistLivePreview` | `document` | `resources/blocks/playlist/divi/PlaylistSettingsApp.jsx:118` | `{ playlistId, settings }` |
| `fluentPlayer/playlistMediasChanged` | `document` | `resources/blocks/playlist/edit.jsx:815` | `{ playlistId, medias }` |

`fluentPlayer/settingsPreview` is the one that also has a **front-end** listener: `resources/js/fluent-player.js:211` applies the branding CSS variables inline on every element carrying the matching `data-media-id`, with no FluentPlayer instance required.

::: warning Two naming conventions, deliberately not unified
Frontend runtime events are **kebab-case** (`fluent-player-play`, `playlist-media-completed`) — the older convention. Editor events are **slash-namespaced camelCase** (`fluentPlayer/mediaUpdated`) — the newer one, mirroring the PHP `fluent_player/` hook prefix. `fluentPlaylistInitialized` is bare camelCase and matches neither. Match the existing name exactly; there is no aliasing.
:::

## Modules

Everything under `resources/js/` in the **free** repo. Nothing here ships from Pro.

| Module | Source | Responsibility | Edition |
|---|---|---|---|
| **Player entry** | `resources/js/fluent-player.js` | **The lifecycle entry point.** Owns the instance registry (`:21`), config resolution from `data-var_name` with an AJAX fallback (`:64-78`, `:132`), the bootstrap guard (`:195-196`), the inbound `FComMediaReady` / `InitSingleFluentPlayer` listeners (`:207-211`), and the `window.FluentPlayer` export (`:214`). | free |
| Player | `resources/js/FluentPlayer.js` | Instance lifecycle: overlays, email capture, CTA, action bar, autoplay, save/resume, keyboard, language switcher. | free |
| **Playlist entry** | `resources/js/fluent-playlist.js` | Playlist counterpart of the above: instance map (`:5`), `data-fp-config` parsing (`:36-38`), `MutationObserver` auto-init (`:94-112`), and the `window.FluentPlaylist` / `window.initFluentPlaylists` exports (`:115-116`). | free |
| Playlist | `resources/js/FluentPlaylist.js` | Playlist navigation and state. | free (layouts are **(Pro)**) |
| **Playlist layout managers** | `resources/js/managers/GridPlaylistManager.js`, `LearningPlaylistManager.js` | Per-layout behavior — grid modal/search wiring, learning-mode lesson list. Loaded by `FluentPlaylist`; the layouts they drive are **(Pro)**. | free source, **(Pro)** feature |
| Browser storage | `resources/js/BrowserStorage.js` | `localStorage` for playback positions and layer condition state. | free |
| Watch tracking | `resources/js/MediaWatchTracker.js`, `resources/js/progression/{coverage,evaluate}.js` | Records watched segments and computes coverage. | free |
| Layers | `resources/js/LayersManager.js` | Interactive overlays shown over the player. | mostly **(Pro)** — see below |
| **Behavior reporters** | `resources/js/behavior/` — `MilestoneReporter.js`, `LayerReporter.js`, `milestones.js`, `arming.js`, `claimChannel.js` | The FluentCRM behavior client. `MilestoneReporter` evaluates quartile/completion milestones against the watch tracker; `LayerReporter` reports layer interactions; `ClaimChannel` fires each event **at most once** with bounded retries (`claimChannel.js:3`, `:15`). They POST the AJAX actions `fluent_player_media_milestone` (`MilestoneReporter.js:4`) and `fluent_player_layer_event` (`LayerReporter.js:3`) — handled by `app/Hooks/Handlers/MediaMilestoneHandler.php:13` and `LayerEventHandler.php:13`, which in turn `do_action()` the `fluent_player/media_milestone` and `fluent_player/layer_event` hooks. `arming.js` mirrors the PHP rule for when an anonymous viewer becomes identifiable. | free — inert unless FluentCRM is active (`AbstractBehaviorHandler.php:31-33`) |
| Analytics | `resources/js/AnalyticsTracker.js` | Batches watch data and POSTs it to `admin-ajax.php`. | **(Pro)** — see below |
| **Error handling** | `resources/js/VideoErrorHandler.js` | Maps a `MediaError.code` (1–4) and a set of message patterns onto a translated title/detail pair, and builds the error overlay. Imported by `FluentPlayer.js:6` as `getVideoError` / `createErrorOverlay`. Pairs with the Vidstack `data-error` attribute — see [DOM attributes](/reference/dom-attributes#vidstack-state-attributes). | free |
| **Timed content** | `resources/js/timed-content-frontend.js` | Separate entry point (own Vite build). Finds `.fp-timed-content-container` (`:137`), reads each child's `data-start` / `data-end` (`:24-25`), and shows/hides on `timeupdate`. | free runtime, **(Pro)** injection |
| **Translator** | `resources/js/translator.js` | `$t()` — looks a source string up in `window.fluent_player.trans` and does `printf`-style substitution. See [i18n](/getting-started/architecture#i18n-and-text-domains). | free |
| **Shared utilities** | `resources/js/utils/` — 15 modules including `urlPlaybackTarget.js` (deep links), `unlock.js` (password form), `emailCapture.js`, `conditions.js`, `brandingVars.js`, `throttle.js` | Internal helpers. Not exported and not a stable surface — listed so you can find the behavior, not so you can import it. | free |

### Analytics **(Pro)**

`AnalyticsTracker` **emits nothing**. It is a *listener and a sender*, not an event source:

1. It subscribes to the **native** `play`, `pause`, and `ended` events on the `<media-player>` element, plus `visibilitychange` on `document` and `beforeunload` on `window` (`resources/js/AnalyticsTracker.js:41-47`).
2. It reads coverage from a `MediaWatchTracker` — it does not compute its own.
3. On pause it schedules a **30-second debounced flush**; on `ended` it flushes on the next microtask; on hide/unload it force-finalizes the in-progress segment and flushes immediately (`resources/js/AnalyticsTracker.js:50-92`).
4. A flush POSTs the action `fluent_player_track_event` to `admin-ajax.php` with `{ nonce, media_id, duration, percentage }` — via `navigator.sendBeacon` on unload, otherwise `fetch` (`resources/js/AnalyticsTracker.js:147-181`).

There is no custom event anywhere in the module. If you want to observe playback, listen to the native Vidstack events yourself.

**Why it is (Pro):** `wp_ajax_fluent_player_track_event` / `wp_ajax_nopriv_fluent_player_track_event` are registered **only in the Pro plugin** (`fluent-player-pro/app/Hooks/Handlers/AnalyticsHandler.php:56-57`). The free plugin ships the tracker and even mints the per-media nonce (`app/Services/MediaRenderer.php:193`), but with Pro inactive the POST lands on an unhandled action and nothing is recorded. The tracker also skips the beacon entirely when that per-media nonce is missing — the generic frontend nonce can never satisfy Pro's `fluent_player_track_event:{id}` check (`resources/js/AnalyticsTracker.js:116-122`).

### Layers — mostly **(Pro)**

`LayersManager` is dynamically imported, and only when `settings.layers` is non-empty (`resources/js/FluentPlayer.js:477-478`, `542-548`). Layer definitions come from the media's saved settings, authored in the block editor.

Free authoring is limited to two layer types — `form`, and `cta` where `cta_type === 'email'`. Every other type opens the upgrade modal instead of saving (`canUseLayerWithoutPro()` at `resources/blocks/media/components/settings/LayersSettings.jsx:38-48`, applied at `:141-144`; `resources/blocks/media/components/layers/LayersManageModal.jsx:48`). So the module is live in free for those two types and dormant otherwise.

Free's `/layer` REST group is only the read-only helpers those panels call — `GET /forms/{type}`, `GET /form-preview`, `GET /shortcode-preview` (`app/Http/Routes/api.php:60-64`). There is no free endpoint that writes a layer.

## PHP-localized config objects

The runtime is configured entirely through `wp_localize_script`. These are the object names to read (or filter, server-side) — none of them is an API you should write to.

| Object | Localized at | Contents |
|---|---|---|
| `fluent_player` | `app/Services/MediaRenderer.php:341` | The **global** frontend config: `ajax_url`, `nonce`, `serverLang`, `has_pro`, `show_powered_by`, `trans`, `resume_playback`, `audio_extensions`, `youtube`, `locked_message`, `external_tracked_media` (+ `analytics` / `google_analytics` when Pro is active). |
| `fluent_player_{mediaId}_{n}` | `app/Services/MediaRenderer.php:198` | Per-player instance config. The name is on the container as `data-var_name`. |
| `fluentPlayerBlockVars` | `app/Blocks/MediaBlock.php:169`, `app/PageBuilders/Elementor/ElementorPageBuilder.php:48` | Block-editor and page-builder panel vars: media list, default settings, REST config, `hasPro`. |
| `fluentPlayerToolbar` | `app/Hooks/Handlers/FluentPlayerMediaCPT.php:336` | Media-library toolbar back-button vars. Pro re-localizes it for playlists (`fluent-player-pro/app/Blocks/PlaylistBlock.php:94`). |
| `fluentFrameworkAdmin` | `app/Hooks/Handlers/AdminMenuHandler.php:383` | Vue admin app vars. |
| `fluentPlayerLearnDash` **(Pro)** | `fluent-player-pro/app/Integrations/LearnDash/LearnDashIntegration.php:394` | LearnDash step-completion wiring. |

::: tip `fluent_player` is filterable from PHP
The global object passes through [`fluent_player/global_vars`](/hooks/media-rendering#fluent-player-global-vars) immediately before localization (`app/Services/MediaRenderer.php:339`). That is the supported way to hand your own frontend script a value off the global config object — add a key there rather than localizing a second script.
:::

## Progression (mirrored evaluator)

Completion is decided by a **coverage-based** evaluator that is deliberately mirrored in PHP and JS, sharing a conformance fixture at `resources/progression/conformance.json`:

- The **JS** side (`resources/js/progression/coverage.js`, `resources/js/progression/evaluate.js`) computes coverage optimistically for instant UI feedback.
- The **server** is the source of truth: it recomputes coverage from the raw watched segments and never trusts a client-supplied ratio (anti-spoof). The `fluent_player/watch_recorded` action fires server-side once a watch event is recorded (`app/Services/Progression/ProgressionService.php:187`).

If you are gating LMS steps or unlocking content on completion, hook [`fluent_player/watch_recorded`](/hooks/progression#fluent-player-watch-recorded) on the server rather than trusting the browser — and read the completion flag from `$payload['verdict']['complete']`, not `$payload['complete']`.
