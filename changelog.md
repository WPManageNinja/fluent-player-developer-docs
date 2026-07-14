---
title: "Developer Changelog"
description: "Developer-facing changes to FluentPlayer — hooks, routes, and extension points added, changed, or removed per release."
---

# Developer Changelog

Tracks changes to the **developer surface** (hooks, REST routes, extension base classes) per plugin release. This is distinct from the [user-facing changelog](https://docs.fluentplayer.com/changelog).

Maintained by the `fluentplayer-dev-code-to-docs` skill: on each release it diffs the extracted hook/route sets against the previous tag and records additions, changes, and removals here.

## Unreleased

Initial developer documentation site. Reference surface captured against the current plugin working tree:

- **Actions documented:** `after_save_media`, `email_collected`, `watch_recorded`, `register_email_providers` (+ 8 more listed on [Actions](/hooks/actions)).
- **Filters documented:** access & gating (4), dynamic sources (2+), email providers (1+). Full set (62) discoverable via the grep tips on the [Hooks overview](/hooks/).
- **REST groups documented:** `media` fully; 8 more groups mapped on the [REST API overview](/rest-api/).
- **Extension guides:** [Custom Email Provider](/extending/custom-email-provider).

_Add the next entry above this line, newest first, keyed by plugin version and date._
