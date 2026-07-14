---
title: "Hooks & Filters"
description: "How FluentPlayer's WordPress actions and filters are organized, with the version-stability caveat and discovery tips."
---

# Hooks & Filters

FluentPlayer exposes WordPress **actions** and **filters** under the `fluent_player/` prefix so you can extend it without editing plugin files. The free build ships **10 actions** and **66 filters** — see the [Full Reference](/hooks/reference) for the complete, source-verified table.

::: warning Version stability
Hook names and signatures can change between releases. Test on staging and pin to the plugin version you verified against. Signatures on this site are cited with a `file:line` so you can confirm against your installed version.
:::

## Reference pages

The [Full Reference](/hooks/reference) lists all 76 hooks. These curated pages add argument names and runnable examples for the high-traffic groups:

| Group | Covers |
|---|---|
| [Actions](/hooks/actions) | Lifecycle events — media save/delete, email collected, watch recorded, provider registration. |
| [Media Rendering](/hooks/media-rendering) | The vars, default settings, and final markup of the player block. |
| [Access & Gating](/hooks/access-gating) | The markup and messages shown when media is locked or access is denied. |
| [Dynamic Media Sources](/hooks/dynamic-sources) | Overriding how a source URL is resolved at render time. |
| [Email Providers](/hooks/email) | The provider list and the data delivered when an email is captured. |
| [Progression](/hooks/progression) | The watch-coverage completion evaluator — for LMS and gating. |
| [FluentCommunity](/hooks/community) | Embedding and rendering media inside FluentCommunity. |
| [Unlock & Tokens](/hooks/unlock) | Unlock-token TTL, rate limiting, and unlockable post types. |
| [Smartcodes](/hooks/smartcodes) | Registering smartcodes/groups and parsing them in player text. |

Groups covered in the [Full Reference](/hooks/reference) but without a curated page yet: Playlist, Settings/shortcode/page-builders, and Admin & i18n.

## Discover every hook in your version

```bash
P=wp-content/plugins/fluent-player
grep -rnE "do_action\(\s*['\"]fluent_player/"    "$P/app" | sort
grep -rnE "apply_filters\(\s*['\"]fluent_player/" "$P/app" | sort
```

## How to read an entry

Each hook entry lists its **type** (action or filter), the **source** `file:line`, a **table of arguments**, and one **runnable example** with the correct priority and accepted-argument count. For filters, always `return` the (possibly modified) first argument.
