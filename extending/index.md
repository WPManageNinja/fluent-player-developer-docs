---
title: "Extending FluentPlayer"
description: "Extension points for building custom add-ons on FluentPlayer — email providers, integrations, behavior handlers, dynamic sources, smartcodes, and progression."
---

# Extending FluentPlayer

These are task-oriented guides for building on FluentPlayer's extension points. Each one is **a base class, a registry, or a set of filters** — read the row before you start, because they are not the same shape and the registration step differs for each.

| Guide | Extension point | Registered via |
|---|---|---|
| [Custom Email Provider](/extending/custom-email-provider) | `AbstractEmailProvider` (base class) | `fluent_player/register_email_providers` → `EmailProviderService::registerProvider()` |
| [Custom Integration](/extending/custom-integration) | `AbstractIntegration` (base class) | `fluent_player/integrations` filter (`key => ClassName::class`) |
| [Behavior Handler](/extending/behavior-handler) | `AbstractBehaviorHandler` (base class) | `YourHandler::register()` — auto-binds its own AJAX endpoints. Requires FluentCRM. |
| Dynamic Media Sources | [Filters only](/hooks/dynamic-sources) — nothing to extend or register | `fluent_player/dynamic_source_overrides`, `fluent_player/dynamic_source_meta_key_allowed`, `fluent_player/dynamic_source_post_id` |
| Custom Smartcodes *(curating)* | `app/Services/Smartcode/*` | smartcode registry |
| Progression / completion *(curating)* | `app/Services/Progression/*` | `watch_recorded` + mirrored evaluator |

::: warning Dynamic media sources are not a class you extend
`app/Services/DynamicMediaSourceResolver.php:17` is a plain class with only `private static` and `public static` methods. There is no base class, no registry, and no instance to swap in. You change its behavior exclusively through the three filters above (`:194`, `:211`, `:217`).
:::

## Do not generalize one guide to another

::: danger The base classes have different abstract sets
`AbstractEmailProvider` and `AbstractIntegration` look similar and are not interchangeable. Copying an email-provider skeleton and renaming the parent class produces a **fatal error** — PHP refuses to instantiate a class that leaves an abstract method unimplemented.

| | `AbstractEmailProvider` | `AbstractIntegration` |
|---|---|---|
| Abstract methods | `validateSettings`, `sanitizeSettings`, `getSettingsFields`, `subscribe`, `isConfigured` | `validateSettings`, `getSettingsFields`, `testConnection` |
| Registered with | an **instance** | a **class name string** |
| `enabled` value | boolean | the string `'yes'` / `'no'` |
| Settings option | `fluent_player_email_providers` | `fluent_player_integrations_settings` |

Start from the guide for the base class you actually need: [Custom Email Provider](/extending/custom-email-provider) or [Custom Integration](/extending/custom-integration).
:::

## Before you build

Read the [Free → Pro hook contract](/extending/free-pro-contract) first. It lists the 27 free hooks that FluentPlayer Pro itself binds — the extension points least likely to change under you — and is honest about what the rest guarantee, including the fact that Pro also couples to free classes directly, which your add-on should not.
