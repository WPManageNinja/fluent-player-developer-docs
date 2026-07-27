---
title: "Blocks & Page-Builder Widgets"
description: "Every registered Gutenberg block and page-builder widget — attribute schemas, the free→Pro timed-content markup contract, and the builder registry filter."
---

# Blocks & Page-Builder Widgets

FluentPlayer uses **four distinct block names** across **eight registration calls** — six in JavaScript, two in PHP — plus **four page-builder widgets/modules**.

The registration count is higher than the name count because two names are registered more than once: `fluent-player/media` is registered server-side *and* client-side *and* again as a page-builder shim, and `fluent-player/timed-content` is registered once for the block editor and once as a shim. Three of the four names are inserter-visible; the fourth exists only inside a builder canvas.

| Block name | Registered (PHP) | Registered (JS) | Inserter |
|---|---|---|---|
| `fluent-player/media` | free `app/Blocks/MediaBlock.php:35` | free `resources/blocks/media/fluent-player-block.jsx:46` | Yes |
| `fluent-player/media` *(page-builder shim)* | — | free `resources/blocks/media/page-builder/TimedContentEditor.jsx:39` | No (`inserter: false`) |
| `fluent-player/timed-content` | — (JS only) | free `resources/blocks/media/fluent-player-block.jsx:118` | Yes, inside the media block only |
| `fluent-player/timed-content` *(page-builder shim)* | — | free `resources/blocks/media/page-builder/TimedContentEditor.jsx:52` | No (`inserter: false`) |
| `fluent-player/playlist` | **(Pro)** pro `app/Blocks/PlaylistBlock.php:24` | free `resources/blocks/playlist/fluent-playlist-block.jsx:32` | Yes (renders only with Pro) |
| `fluent-player/divi-timed-content-root` | — | free `resources/blocks/media/page-builder/TimedContentEditor.jsx:73` | No (`inserter: false`) |

Four of the six JS registrations are guarded by `getBlockType()` and so are idempotent — the playlist block (`fluent-playlist-block.jsx:31`) and all three shims (`TimedContentEditor.jsx:38`, `:51`, `:72`). The two in `fluent-player-block.jsx` (`:46`, `:118`) are **unguarded** and register unconditionally, which is why a builder canvas that loads both bundles gets whichever ran first — see [Page-builder editor shims](#page-builder-editor-shims).

## `fluent-player/media`

Registered **twice** — server-side for rendering, client-side for authoring. The two registrations declare **different attribute sets**, and that difference matters.

### Server-side registration

`register_block_type('fluent-player/media', …)` at free `app/Blocks/MediaBlock.php:35`, `api_version: 3`, `render_callback: MediaBlock::render`. Ten attributes (`:40-90`):

| Attribute | Type | Default | Read by `render()`? |
|---|---|---|---|
| `mediaId` | `number` | *(none)* | **Yes** — `:237`, `:243`. Empty renders the "Please select a media" placeholder. |
| `isFcomFeatureMedia` | `boolean` | `false` | No. A marker so FluentCommunity can manage a lesson's feature-media block lifecycle without touching normal blocks. |
| `preview` | `boolean` | `true` | No. |
| `autoplay` | `boolean` | `false` | No. |
| `showControls` | `boolean` | `true` | No. |
| `brandColor` | `string` | `'#007bff'` | No. |
| `cssClass` | `string` | `''` | No. |
| `align` | `string` | `''` | **Yes** — `:296`, wraps output in `.align{value}`. |
| `className` | `string` | `''` | **Yes** — `:262`, passed to `MediaRenderer::render()` as extra classes. |
| `timedContentStyle` | `object` | see below | **Yes** — `:279-285`, merged with the media's saved `timedContentStyle` and handed to `fluent_player/media_block_inner`. |

::: warning Five attributes are declared but never read
`preview`, `autoplay`, `showControls`, `brandColor`, and `cssClass` appear **only** in the registration array. `MediaBlock::render()` (`:235-302`) never reads them, and nothing else in free or Pro reads them as block attributes. Playback config comes from the media's own saved settings, not from these. They are retained so older saved content still validates — do not build against them.
:::

`timedContentStyle` default (`:76-89`):

```php
[
    'enabled' => true,
    'padding' => [
        'top'    => '20',
        'right'  => '20',
        'bottom' => '20',
        'left'   => '20',
        'unit'   => 'px',
        'linked' => true,
    ],
]
```

### Client-side registration

`registerBlockType("fluent-player/media", …)` at free `resources/blocks/media/fluent-player-block.jsx:46`, `apiVersion: 3`, category `media`. It declares only **three** attributes (`:59-83`) — `mediaId` (`number`), `isFcomFeatureMedia` (`boolean`, `false`), and `timedContentStyle` (`object`, the same default shape as PHP).

`supports` (`:84-88`): `html: false`, `align: ['wide', 'full']`, `lock: false`.

`save()` returns `InnerBlocks.Content` (`:90-92`) — the block is dynamic on the server but persists its children in post content. One `deprecated` entry (`:93-107`) migrates the original `mediaId`-only, `save: () => null` version.

### Registration is gated

```php
if (apply_filters('fluent_player/should_register_media_block', true) === false) {
    return;
}
```

free `app/Blocks/MediaBlock.php:26`. Returning `false` skips **the whole `register()` method** — block registration *and* the `enqueue_block_editor_assets` / `enqueue_block_assets` hooks (`:30-31`). The filter itself is listed in the [hooks reference](/hooks/reference); this is the block it controls.

## `fluent-player/timed-content`

**JS-only.** No PHP registration exists — the block's markup is saved into post content and rendered by whatever consumes it. Registered at free `resources/blocks/media/fluent-player-block.jsx:118`.

| Attribute | Type | Default |
|---|---|---|
| `startTime` | `number` | `0` (`:126`) |
| `endTime` | `number` | `30` (`:127`) |

`parent: ['fluent-player/media']` (`:124`) — it can only be inserted inside a media block. `supports`: `html: false`, `reusable: false`, `align: false` (`:129`).

### The free → Pro markup contract

This is a **cross-plugin contract** with no interface, no version negotiation, and no test that spans both repos. `save()` at free `resources/blocks/media/fluent-player-block.jsx:131-138` emits exactly (the markup itself is `:135`):

```html
<div class="fp-timed-content" data-start="0" data-end="30">
    <!-- InnerBlocks content -->
</div>
```

Three separate consumers depend on that exact shape:

| Consumer | Where | Depends on |
|---|---|---|
| Pro injection | pro `app/Hooks/Handlers/TimedContentHandler.php:54` | Wraps the saved inner HTML in `<div class="fp-timed-content-container">` (`:115`) and splices it before the player wrapper's closing `</div>` (`:120-126`). Hooked on `fluent_player/media_block_inner` at pro `app/Hooks/filters.php:50-53`. |
| Free runtime | free `resources/js/timed-content-frontend.js:137` | Finds every `.fp-timed-content-container`, then `:14` reads its `.fp-timed-content` children and `:22-26` parses `dataset.start` / `dataset.end` into floats (`end` falls back to `Infinity`). |
| Page-builder shim | free `resources/blocks/media/page-builder/TimedContentEditor.jsx:66` | Re-emits byte-identical markup so a Divi/Elementor canvas saves what Pro can render. |

**If you change the class name or the `data-start` / `data-end` attribute names, you break Pro rendering and the free runtime simultaneously.** Note the split of ownership: free saves the markup *and* ships the runtime controller; Pro only owns the injection step.

Pro also falls back to reading the CPT post's own saved blocks when a block is embedded elsewhere with no local InnerBlocks — `getTimedContentFromPost()` (pro `TimedContentHandler.php:134-157`) runs `parse_blocks()` (`:141`) and re-renders the `fluent-player/media` block's `innerBlocks`.

::: tip Locked media skips the injection entirely
`MediaBlock::render()` only applies `fluent_player/media_block_inner` when `post_password_required()` is false (free `app/Blocks/MediaBlock.php:288-292`), so timed content cannot leak past an unlock form.
:::

## `fluent-player/playlist` **(Pro render)**

Registered client-side by **free** (so the block appears in the editor either way) and server-side by **Pro** (which owns the render). Free's JS registration is idempotent — guarded by `getBlockType()` (free `resources/blocks/playlist/fluent-playlist-block.jsx:31`) so importing the build into a second host such as the Divi Visual Builder cannot double-register.

Server-side registration: pro `app/Blocks/PlaylistBlock.php:24`, `api_version: 3`, `render_callback: PlaylistBlock::render`. Seven attributes (`:33-64`):

| Attribute | Type | Default | Declared in JS too? |
|---|---|---|---|
| `playlistId` | `number` | *(none)* | Yes (`fluent-playlist-block.jsx:47`) |
| `sourceType` | `string` | `'playlist'` | Yes (`:50`) |
| `tags` | `array` | `[]` | Yes (`:54`) |
| `query` | `object` | `['limit' => 20, 'orderby' => 'date', 'order' => 'DESC']` | Yes (`:58`) |
| `settings` | `object` | `[]` | Yes (`:66`) |
| `align` | `string` | `''` | No — comes from `supports.align` client-side |
| `className` | `string` | `''` | No — WordPress-managed client-side |

`supports` (pro `:66-69`, free `:71-74`): `html: false`, `align: ['wide', 'full']`. JS `save: () => null` (`fluent-playlist-block.jsx:76`) — rendering is entirely server-side.

Allowed `query.orderby` values are constrained to `['date', 'title', 'modified', 'rand']` (pro `app/Blocks/PlaylistBlock.php:17`).

## Page-builder editor shims

`resources/blocks/media/page-builder/TimedContentEditor.jsx` mounts a **standalone block editor** below the player inside a builder canvas, reusing WordPress's own React (`wp.element`) rather than the builder's vendored copy — the block-editor stores and contexts require it (`:1-6`). It makes **three** of the eight registrations, all idempotently via `getBlockType()` (`:38`, `:51`, `:72`). Two of the three re-use a name the block-editor bundle also registers; only `fluent-player/divi-timed-content-root` is unique to this file:

| Block | Line | Attributes | Notes |
|---|---|---|---|
| `fluent-player/media` *(shim)* | `:39` | `mediaId` (`number`) | `supports: { inserter: false, html: false }`. `save: () => null` so `parse()` treats it as dynamic and skips validating the shim against the real markup. Registered **only** so `parse()` recognises the CPT content and nests the children (`:18-20`). |
| `fluent-player/timed-content` *(shim)* | `:52` | `startTime` (`number`, `0`), `endTime` (`number`, `30`) | `parent: ['fluent-player/divi-timed-content-root']`, `supports: { html: false, reusable: false, inserter: false }`. Saves the identical `.fp-timed-content` markup (`:63-68`). |
| `fluent-player/divi-timed-content-root` | `:73` | `duration` (`number`, `0`), `timedContentStyle` (`object`, `{}`) | `supports: { html: false, reusable: false, inserter: false }`. Uses `useBlockProps` so the editor stamps `[data-block=clientId]`, which `TimedContentManager`'s injected `<style>` targets for area styling (`:86-87`). |

::: warning The shim re-registers a real block name
`fluent-player/timed-content` is registered by *both* `fluent-player-block.jsx:118` (inserter-visible, `parent: ['fluent-player/media']`) and `TimedContentEditor.jsx:52` (hidden, `parent: ['fluent-player/divi-timed-content-root']`). Only one wins per page context — the `getBlockType()` guard means whichever bundle loads first defines the block. Both save identical markup, so the front end is unaffected, but a plugin that calls `wp.blocks.getBlockType('fluent-player/timed-content')` in a builder canvas will read the shim's schema, not the block editor's.
:::

## Page-builder widgets & modules

Four builder integrations, all registered from the **free** plugin:

| Builder | Identifier | Kind | Source |
|---|---|---|---|
| Elementor | `fluent_player_media` | widget | free `app/PageBuilders/Elementor/ElementorMediaWidget.php:19` |
| Elementor | `fluent_player_playlist` | widget | free `app/PageBuilders/Elementor/ElementorPlaylistWidget.php:20` |
| Divi | `fluent-player/divi-media` | module | free `app/PageBuilders/Divi/fluent-player-media/module.json:2` |
| Divi | `fluent-player/divi-playlist` | module | free `app/PageBuilders/Divi/fluent-player-playlist/module.json:2` |

Both Elementor widgets extend `\Elementor\Widget_Base` and are only loaded when Elementor is active. Both use category `fluent-player` (`ElementorMediaWidget.php:34`, `ElementorPlaylistWidget.php:37`) and expose their pickers **in the canvas, not the sidebar** — the panel controls are `Controls_Manager::HIDDEN` so the canvas picker's `$e.run` write persists and `render()` can read it (`ElementorMediaWidget.php:52`, `ElementorPlaylistWidget.php:54`).

The Divi modules use `moduleClassName` / `moduleOrderClassName` `fluent_player_media` and `fluent_player_playlist` respectively, and delegate their pickers to the custom field components `fluent-player/media-search`, `fluent-player/settings`, `fluent-player/playlist-search`, and `fluent-player/playlist-settings`.

### The registry is extensible

`PageBuilderService` mirrors `IntegrationService` — builders register a class name, and `boot()` instantiates each, skipping any whose builder plugin is inactive (free `app/Services/PageBuilderService.php:76-88`; the design intent is stated in the class docblock at `:9-14`).

**`fluent_player/page_builders`** — filter · free `app/Services/PageBuilderService.php:72` · 1 arg

| Arg | Type | Description |
|---|---|---|
| `$builders` | `array<string,string>` | Class-name ⇒ class-name map of registered adapters. |

```php
add_filter('fluent_player/page_builders', function ($builders) {
    $builders[MyBuilderAdapter::class] = MyBuilderAdapter::class;
    return $builders;
});
```

Your class must extend `FluentPlayer\App\PageBuilders\AbstractPageBuilder` and implement `isActive()` + `register()` — `boot()` (`:76-88`) skips anything that is not an `AbstractPageBuilder` instance or reports itself inactive (`:84`).

::: tip `registerEarly()` runs at registration time, not at `boot()`
If your adapter defines a **static** `registerEarly()`, `PageBuilderService::register()` (`:54`) invokes it immediately, once per class (`:63-65`) — before `init`. Use it for hook needs that must land before the builder itself boots. Note that `register()` is the direct-registration path; a class added purely through the `fluent_player/page_builders` filter never passes through `register()` and therefore **never gets its `registerEarly()` called**.
:::
