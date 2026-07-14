---
title: "Extending FluentPlayer"
description: "Extension points for building custom add-ons on FluentPlayer — email providers, integrations, dynamic sources, smartcodes, and progression."
---

# Extending FluentPlayer

These are task-oriented guides for building on FluentPlayer's extension points. Each is a base class or registry you extend, then register with a hook.

| Guide | Extension point | Registered via |
|---|---|---|
| [Custom Email Provider](/extending/custom-email-provider) | `AbstractEmailProvider` | `fluent_player/register_email_providers` + `email_providers` |
| Custom Integration *(curating)* | `AbstractIntegration` | `integrations` filter |
| Dynamic Media Sources | `DynamicMediaSourceResolver` + [filters](/hooks/dynamic-sources) | `dynamic_source_*` filters |
| Custom Smartcodes *(curating)* | `app/Services/Smartcode/*` | smartcode registry |
| Progression / completion *(curating)* | `app/Services/Progression/*` | `watch_recorded` + mirrored evaluator |

Start with the [Custom Email Provider](/extending/custom-email-provider) guide — it is the most complete example and the pattern generalizes to the other base classes.
