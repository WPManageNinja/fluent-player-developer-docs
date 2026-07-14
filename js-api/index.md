---
title: "JS API"
description: "FluentPlayer's frontend JavaScript surface — player events, layers, analytics, and watch tracking."
---

# JS API

FluentPlayer's frontend is built on **Vidstack** (with hls.js for HLS). The plugin's own JavaScript wraps the player element and exposes events and managers you can hook into from the browser. Document what FluentPlayer emits and consumes — for the underlying element API, refer to the [Vidstack docs](https://vidstack.io).

## Modules

| Module | Source | Responsibility |
|---|---|---|
| Player | `resources/js/FluentPlayer.js` | Player instance lifecycle and events. |
| Layers | `resources/js/LayersManager.js` | Interactive overlays (CTA, hotspots, ads) shown over the player. |
| Analytics | `resources/js/AnalyticsTracker.js` | Emits play / progress / complete events. |
| Watch tracking | `resources/js/MediaWatchTracker.js`, `resources/js/progression/*` | Records watched segments and computes coverage. |
| Playlist | `resources/js/FluentPlaylist.js` | Playlist navigation and state. |

## Progression (mirrored evaluator)

Completion is decided by a **coverage-based** evaluator that is deliberately mirrored in PHP and JS, sharing a conformance fixture at `resources/progression/conformance.json`:

- The **JS** side computes coverage optimistically for instant UI feedback (e.g. unlocking a button).
- The **server** is the source of truth: it recomputes coverage from the raw watched segments and never trusts a client-supplied ratio (anti-spoof). The `fluent_player/watch_recorded` action fires server-side once a watch event is recorded.

If you are gating LMS steps or unlocking content on completion, hook [`fluent_player/watch_recorded`](/hooks/actions#fluent-player-watch-recorded) on the server rather than trusting the browser.

::: tip Curating this page
This overview is verified against the module layout. The per-event contracts (event names, payloads) come from reading the modules above — expand each into its own page (`js-api/player-events`, `js-api/analytics-events`, `js-api/watch-tracking`) as you document them.
:::
