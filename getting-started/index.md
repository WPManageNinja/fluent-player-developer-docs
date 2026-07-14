---
title: "Getting Started"
description: "Orientation for developers extending the FluentPlayer WordPress plugin."
---

# Getting Started

This site documents the **developer surface** of FluentPlayer: the WordPress hooks, REST API, extension base classes, and JS API you use to customize or build on top of the plugin. For end-user, click-through documentation, see the [user docs](https://docs.fluentplayer.com).

## What you can extend

| You want to... | Start here |
|---|---|
| Change what the player renders, or gate access to media | [Hooks & Filters](/hooks/) |
| Call the plugin's admin endpoints from your own code | [REST API](/rest-api/) |
| Send captured emails to a new service | [Custom Email Provider](/extending/custom-email-provider) |
| Resolve a media source dynamically (URL, post meta, filter) | [Dynamic Media Sources](/hooks/dynamic-sources) |
| React to player events in the browser | [JS API](/js-api/) |

## Conventions used across these docs

- All PHP hooks use the **`fluent_player/`** prefix and the **`fluent-player`** text domain.
- Namespaces are **`FluentPlayer\App\...`** (the plugin is built on WPFluent).
- Code examples are runnable and minimal. Signatures are verified against the plugin source; the file and line are cited so you can read the call site yourself.
- Anything marked **(Pro)** ships in the separate FluentPlayer Pro plugin, not the free build.

::: warning Version stability
Hook names, arguments, and endpoints can change between releases. Test customizations on staging and pin to the plugin version you verified against. The [Developer Changelog](/changelog) tracks developer-facing changes.
:::

## Next

Read the [Architecture](/getting-started/architecture) overview to learn how the plugin is laid out, then jump into the [Hooks](/hooks/) or [REST API](/rest-api/) reference.
