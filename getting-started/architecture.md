---
title: "Architecture"
description: "How the FluentPlayer plugin is structured, and where the developer surface lives."
---

# Architecture

FluentPlayer is a WordPress plugin built on the **WPFluent** framework — a Laravel-style application layer (router, models, request lifecycle) inside WordPress. The frontend player wraps **Vidstack** `1.12.13` (with **hls.js** `1.6.15` for HLS streaming); the admin UI is **Vue 3** (`3.5.13`) with **Element Plus** `2.8.8`; blocks are **React** (Gutenberg `apiVersion: 3`, so they render inside the editor canvas iframe).

All four versions are **lockfile-resolved** (`package-lock.json`), not the ranges declared in `package.json` — which are `^1.12.13`, `^1.5.7`, `^3.2.40` and `^2.2.17` respectively. Read the lockfile, not the manifest, when you need to know what actually ships.

## Directory map

The tree below is the **development** checkout. The extension points you care about live in a few predictable places:

```
fluent-player/
├── fluent-player.php        # Plugin header + FLUENT_PLAYER_* constants
├── boot/                    # app.php — WPFluent bootstrap; fires fluent_player/loaded
├── config/                  # app.php — slug, text domain, hook prefix, REST namespace + version
├── database/                # Custom-table schema + migrations (flp_email_collections)
├── app/
│   ├── Http/
│   │   ├── Controllers/     # REST controllers (Media, Preset, Settings, Layer, Smartcode, …)
│   │   ├── Policies/        # Auth gate per route group (MediaPolicy, SettingsPolicy, …)
│   │   └── Routes/          # api.php + routes.php — the REST route definitions
│   ├── Blocks/              # Gutenberg block registration (MediaBlock, FluentCommunityMediaBlock)
│   ├── PageBuilders/        # Elementor + Divi 5 integrations (AbstractPageBuilder)
│   ├── EmailProviders/      # AbstractEmailProvider (+ FluentCRMProvider, a @deprecated shim)
│   ├── Integrations/        # AbstractIntegration + FluentCrm/ (EmailCaptureProvider lives here)
│   ├── Services/            # MediaRenderer, DynamicMediaSourceResolver, Progression/, Smartcode, …
│   ├── Models/              # Media, EmailCollection
│   ├── Helpers/             # Helper (hasPro, capabilities, poster + YouTube utilities)
│   ├── Hooks/               # Handlers/ — where most actions/filters fire; actions.php, filters.php
│   ├── Utils/               # Enqueuer/Vite.php — the manifest-driven asset loader
│   └── Views/               # player.php + player/ partials (the rendered markup)
├── assets/                  # SHIPPED build output — the compiled JS/CSS the plugin enqueues
├── language/                # fluent-player.pot
├── vendor/                  # Composer autoloader + the prefixed WPFluent framework
└── resources/               # SOURCE ONLY — not shipped (see below)
    ├── js/                  # FluentPlayer.js, FluentPlaylist.js, LayersManager.js,
    │                        # AnalyticsTracker.js, BrowserStorage.js, progression/,
    │                        # behavior/, managers/, utils/, translator.js
    ├── admin/               # Vue 3 admin app
    ├── blocks/              # React block sources (media/, playlist/, timed-content/)
    ├── progression/         # conformance.json — the PHP↔JS evaluator fixture
    └── scss/                # Player, block, and admin styles
```

::: danger `resources/` is source-only — the shipped runtime is `assets/`
`.distignore` excludes `resources`, `dev`, `node_modules`, and the Vite configs from the distributed ZIP. What a customer installs contains `assets/` — the compiled bundles, loaded through the manifest-driven `app/Utils/Enqueuer/Vite.php` — plus `app/`, `boot/`, `config/`, `database/`, `language/` and `vendor/`.

So every `resources/…` citation on this site points at **source you read on GitHub, not a file on the server**. If you are debugging a live site, look in `assets/`. If you are patching behavior, patch `resources/` and rebuild (`npm run build`).
:::

::: tip Not in the free tree
`app/Layouts/` (playlist layouts) and the hosted-streaming integrations live in **fluent-player-pro** only. Pro also has no `resources/` of its own — all frontend JavaScript ships in the free plugin. See the [JS API](/js-api/).
:::

## The developer surface at a glance

| Surface | Where | Reference |
|---|---|---|
| **Actions** (15 free, 8 Pro-only) | `do_action` / `$app->doAction('fluent_player/…')` across `app/` + `boot/` | [Actions](/hooks/actions) · [Full Reference](/hooks/reference) |
| **Filters** (77 free, 12 Pro-only) | `apply_filters` / `$app->applyFilters('fluent_player/…')` | [Hooks overview](/hooks/) · [Full Reference](/hooks/reference) |
| **REST API** (45 free + 102 Pro = 147 routes) | `app/Http/Routes/{api,routes}.php`, guarded by `app/Http/Policies/` | [REST API](/rest-api/) · [Pro routes](/rest-api/pro) |
| **AJAX actions** | `admin-ajax.php` handlers registered in `app/Hooks/Handlers/` | [AJAX](/rest-api/ajax) |
| **Email providers** | `app/EmailProviders/AbstractEmailProvider.php` | [Custom Email Provider](/extending/custom-email-provider) |
| **Integrations** | `app/Integrations/AbstractIntegration.php` | [Custom Integration](/extending/custom-integration) |
| **Dynamic sources** | `app/Services/DynamicMediaSourceResolver.php` | [Dynamic Media Sources](/hooks/dynamic-sources) |
| **Progression** | `app/Services/Progression/*` + `resources/js/progression/*` | [Progression](/hooks/progression) · [JS API](/js-api/) |
| **Shortcodes & smartcodes** | `app/Hooks/Handlers/MediaShortcodeHandler.php`, `app/Services/Smartcode*` | [Shortcodes](/reference/shortcodes) · [Smartcode hooks](/hooks/smartcodes) |
| **DOM contract** | `data-*` on `.fluent-player` / `.fluent-player-container`, written by `app/Views/player.php` | [DOM attributes](/reference/dom-attributes) |
| **Data model** | CPT `fluent_player_media` + table `flp_email_collections` | [Data model](/reference/data-model) |
| **Capabilities** | `app/Http/Policies/`, `fluent_player/authoring_capability` | [Capabilities](/reference/capabilities) |

The **REST namespace is `fluent-player/v2`** — `config/app.php:10-11` sets `rest_namespace` to `fluent-player` and `rest_version` to `v2`, so every endpoint lives under `/wp-json/fluent-player/v2/`.

## Free vs Pro

This documentation covers both trees, but the **free** plugin is the baseline. FluentPlayer Pro is a separate plugin that adds analytics, timed content, playlists and playlist layouts, media tags, custom presets, LearnDash integration, most interactive layer types, and hosted streaming — **Mux, Bunny Stream, Bunny Storage, Cloudflare Stream, Cloudflare R2, and Gumlet** (`fluent-player-pro/app/Integrations/`). Each contributes its own hooks and routes.

Pro-only items are marked **(Pro)** throughout: in the [Full Hooks Reference](/hooks/reference) Edition column, on the [Pro REST routes](/rest-api/pro) page, and inline wherever a free page mentions a Pro-gated feature.

Detect Pro from PHP with `Helper::hasPro()`, which is a thin wrapper over the constant (`app/Helpers/Helper.php:1093-1096`):

```php
if (\FluentPlayer\App\Helpers\Helper::hasPro()) {
    // Pro is active
}

// Equivalent, and safe before FluentPlayer loads:
if (defined('FLUENT_PLAYER_PRO_VERSION')) {
    // Pro is active
}
```

Both plugins declare a minimum for the other, but **only one of the two is enforced**:

| Constant | Declared | What it does |
|---|---|---|
| `FLUENT_PLAYER_MIN_PRO_VERSION` = `1.0.7` | free `fluent-player.php:23` | **Nothing is gated.** The only consumer is an `admin_notices` callback (`app/Hooks/actions.php:43-59`) that prints "Your FluentPlayer Pro is outdated" to users with `activate_plugins`. Pro still loads and still hooks. |
| `FLUENT_PLAYER_PRO_MIN_CORE_VERSION` = `1.0.9` | `fluent-player-pro/fluent-player-pro.php:22` | **A real hard stop.** Inside Pro's `fluent_player/loaded` listener, if `coreMeetsMinimum()` (`fluent-player-pro/app/Hooks/Handlers/FreeDependencyNotice.php:71-74`) fails, Pro registers an admin notice and `return`s **before** `new Application(...)` — so no Pro route, hook, block, or integration is ever registered (`fluent-player-pro/boot/app.php:14-19`). |

The practical consequence for third-party code: an out-of-date **free** plugin makes Pro's entire surface vanish silently, while an out-of-date **Pro** plugin still registers everything it has. So `defined('FLUENT_PLAYER_PRO_VERSION')` tells you Pro's *file* loaded, not that Pro *booted*. If you depend on a specific Pro hook, compare `FLUENT_PLAYER_PRO_VERSION` yourself — or hook something Pro registers and check for it.

## i18n and text domains

**Free and Pro use different text domains.** Getting this wrong means your string is never translated — `__()` silently returns the original when the domain has no catalogue.

| | Free | Pro |
|---|---|---|
| Text domain | `fluent-player` (`fluent-player.php:10`, mirrored at `config/app.php:8`) | `fluent-player-pro` (`fluent-player-pro/fluent-player-pro.php:13`) |
| `Domain Path` | `/language` (`fluent-player.php:11`, `config/app.php:7`) → `language/fluent-player.pot` | `/language` (`fluent-player-pro/fluent-player-pro.php:14`) → `fluent-player-pro/language/fluent-player-pro.pot` |

Pro moved to its own domain in **1.0.7**. At 1.3.0 its `app/` uses `'fluent-player-pro'` 807 times against 4 remaining `'fluent-player'` uses, so treat `fluent-player-pro` as the only correct domain for a Pro-facing string. When you write a filter callback, use **your own** plugin's domain — not either of these.

### JS strings

Frontend and admin JavaScript do **not** use `wp_set_script_translations`. Strings are localized as a plain map and looked up by a tiny translator:

| Piece | Where |
|---|---|
| Frontend catalogue | `TransStrings::getFrontendStrings()` — `app/Services/Translations/TransStrings.php:15-19`, sourced from `frontend-translations.php`, localized onto `window.fluent_player.trans` (`app/Services/MediaRenderer.php:312`) |
| Admin catalogue | `TransStrings::getStrings()` — `TransStrings.php:9-13`, sourced from `admin-translations.php`, localized onto `window.fluentFrameworkAdmin.trans` (`app/Hooks/Handlers/AdminMenuHandler.php:378`) |
| The translator | `resources/js/translator.js` — a default-exported `$t(string, ...args)` that looks the string up in `window.fluent_player.trans`, falls back to the original, then runs `printf`-style `%s` / `%d` / `%1$s` substitution |

Two filters let you add or override entries. Both receive the catalogue array and are declared with 2 args:

- **`fluent_player/frontend_translations`** — filter · `app/Services/Translations/TransStrings.php:18`
- **`fluent_player/admin_translations`** — filter · `app/Services/Translations/TransStrings.php:12`

```php
add_filter('fluent_player/frontend_translations', function ($translations) {
    // 'Copy Link' is a real key — see app/Services/Translations/frontend-translations.php
    $translations['Copy Link'] = __('Share this video', 'your-textdomain');
    return $translations;
});
```

::: warning `$t()` keys on the English source string
The catalogue is a `source => translation` map (`frontend-translations.php`, `admin-translations.php`), so the key you override is the literal English string the JS passes to `$t()`. There is no message-ID layer, and an unknown key is a silent no-op rather than an error — inspect `window.fluent_player.trans` in the console to see the exact keys in play.
:::

## Discovering everything in your installed version

The references here are generated, but you can regenerate them against the exact version you run.

**Preferred — the extractor in this repo.** It scans both plugin trees, covers all four dispatch forms, and tags every hook `free` / `pro` / `both`:

```bash
npm run extract          # hooks + routes → _generated/
```

**Fallback — grep.** Two things the obvious command gets wrong: scoping to `app/` misses `boot/app.php`, which is where `fluent_player/loaded` is dispatched; and matching only the literal `apply_filters(` misses the WPFluent wrapper `$app->applyFilters(...)` used by `app/Hooks/Handlers/AdminMenuHandler.php:382`. Scan both directories and both dispatch forms:

```bash
P=wp-content/plugins/fluent-player
grep -rnE "(do_action|doAction)\(\s*['\"]fluent_player/"        "$P/app" "$P/boot" | sort
grep -rnE "(apply_filters|applyFilters)\(\s*['\"]fluent_player/" "$P/app" "$P/boot" | sort
```

Run the same two commands against `fluent-player-pro` to see the Pro surface.

::: warning These commands return 12 actions and 72 filters, not the 15 / 77 stated above — by design
A single-line regex cannot see eight of the free hooks, and the shortfall is **not** a defect in the commands. `npm run extract` is authoritative at **15 actions / 77 filters** because it additionally resolves all eight; grep is the quick check.

- **Five filters are dispatched across a line break**, with the hook name on the line *after* the opening call, so `apply_filters(\s*'fluent_player/` never matches: `fluent_player/base_url` (`app/Hooks/Handlers/AdminMenuHandler.php:253-254`), `fluent_player/progression/policy` (`app/Services/Progression/ProgressionService.php:165-166`), `fluent_player/email_attachment_allowed_types` (`app/Http/Controllers/EmailProviderController.php:46-47`), and `fluent_player/email_submission_rate_limit_max_attempts` (`app/Hooks/Handlers/EmailCollectionHandler.php:342-343`) / `…_window` (`:347-348`). The extractor parses the call across lines, so it finds all five.
- **One action is cron-only.** `fluent_player/daily_cleanup` has no `do_action` at all — it is a cron hook name (`const CRON_HOOK`, `app/Hooks/Handlers/ScheduledCleanupHandler.php:9`), listened to at `app/Hooks/actions.php:106` and scheduled via `wp_next_scheduled()` at `:109`. WordPress dispatches it, so there is nothing in the plugin for grep to find. See [Actions](/hooks/actions#fluent-player-daily-cleanup).
- **Two actions dispatch through a variable.** `do_action($this->eventName(), $ctx)` at `app/Hooks/Handlers/AbstractBehaviorHandler.php:156` resolves to `fluent_player/media_milestone` and `fluent_player/layer_event`, whose literal names exist only as the constants `BehaviorRegistry::TRIGGER_MILESTONE` / `TRIGGER_LAYER` (`app/Integrations/FluentCrm/BehaviorRegistry.php:17-18`). Grep for the dispatch and you get nothing; grep for the strings and you get two `const` declarations. See [Actions](/hooks/actions#fluent-player-media-milestone).

The cron hook and the two behavior actions are carried by the extractor as **verified manual entries**, each checked against source rather than inferred — so all three appear in the generated set with their real `file:line`, edition and argument count. The extractor also *fails* if it meets a dynamic dispatch site no entry accounts for, which is what keeps the 15 honest.
:::
