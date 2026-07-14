---
name: fluentplayer-extension-guide
description: Specialist template for FluentPlayer "build a custom X" developer tutorials under extending/ — custom email provider, custom integration, dynamic media sources, custom smartcodes, and progression/completion. Use when writing a task-oriented guide that walks a developer through extending FluentPlayer via a base class or registry hook. Always pair with fluentplayer-dev-doc-writer and load DEV-SURFACE.md.
---

# FluentPlayer Extension Guide Template

Extension guides are **task-oriented tutorials** (not reference): they take a developer from zero to a working custom add-on against a FluentPlayer extension point. Reference pages list *what exists*; these show *how to build one*.

## When to use — the extension points (from `DEV-SURFACE.md` §4)

| Guide | Base class / registry | Registered via |
|---|---|---|
| `extending/custom-email-provider.md` | `app/EmailProviders/AbstractEmailProvider.php` (ref: `FluentCRMProvider.php`) | `do_action('fluent_player/register_email_providers')` + `email_providers` filter |
| `extending/custom-integration.md` | `app/Integrations/AbstractIntegration.php` | `integrations` filter / `IntegrationService` |
| `extending/dynamic-media-sources.md` | `DynamicMediaSourceResolver` + `dynamic_source_*` filters | filters |
| `extending/custom-smartcodes.md` | `app/Services/Smartcode/*` | smartcode registry |
| `extending/progression.md` | `Services/Progression/*` + `resources/js/progression/*` + `conformance.json` | `watch_recorded` + mirrored evaluator |

## Required structure

```
---
title: "Build a Custom <Thing>"
description: "<one line>"
---
# Build a Custom <Thing>

<Intro: what you'll build, when you'd need it, and the one reference implementation to read first (name the file, e.g. FluentCRMProvider.php).>

## Prerequisites
- FluentPlayer <version>+ (and Pro if the point is Pro-only).
- <PHP/JS baseline, where the code lives, text domain `fluent-player`.>

## 1. Extend the base class
<Show the class skeleton: the abstract methods you MUST implement, each with its contract. Read AbstractX.php for the real method list — don't invent methods.>

​```php
class MyProvider extends \FluentPlayer\App\EmailProviders\AbstractEmailProvider
{
    // required methods, verified against the abstract
}
​```

## 2. Register it
<The exact hook/filter and where to call it.>

​```php
add_filter('fluent_player/email_providers', function ($providers) {
    $providers['my_provider'] = new MyProvider();
    return $providers;
});
​```

## 3. <Configure / handle data / render>
<The provider-specific work: settings fields, the callback that receives data, etc.>

## 4. Verify
<How to confirm it works: where it appears in the UI, what to check, how to debug.>

## Reference
- Base class: `app/.../AbstractX.php`
- Bundled implementation to copy from: `app/.../Xxx.php`
- Related hooks: link to the `hooks/` reference entries.
```

### Rules
- **Read the abstract class first.** List the exact abstract methods and their signatures from `AbstractEmailProvider.php` / `AbstractIntegration.php`. Never invent a method name — a wrong method breaks the reader's build.
- **Point at the bundled reference implementation** (`FluentCRMProvider.php` for providers) and tell the reader to read it alongside.
- **Every code block is runnable** and uses real hook/class names with correct namespaces (`FluentPlayer\App\...`).
- **End with a Verify step** — where the extension surfaces in the admin UI or frontend, and how to debug when it doesn't.
- **Link to the reference pages** (`hooks/`, `rest-api/`) rather than restating signatures inline.
- **Mark Pro-only extension points** and state the Pro requirement in Prerequisites.
- For `extending/progression.md`, explain the **mirrored PHP+JS evaluator** and the shared `resources/progression/conformance.json` fixture: the server recomputes coverage from raw segments (anti-spoof), the JS side is optimistic. This is the highest-nuance guide — get the "server is source of truth" point across.

## Sidebar entry
```js
{ text: 'Custom Email Provider', link: 'extending/custom-email-provider' }
```

## Common pitfalls
- **Invented abstract methods / wrong signatures** — always from source.
- **Missing the registration hook** — a perfectly-written class that's never registered does nothing.
- **Namespace errors** — use the plugin's real `FluentPlayer\App\...` namespaces.
- **No verification step** — the reader is left unsure it worked.
