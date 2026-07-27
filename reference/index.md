---
title: "Reference"
description: "Source-verified reference for FluentPlayer's shortcodes, blocks, data model, and permissions model."
---

# Reference

These pages document the parts of FluentPlayer's developer surface that are **not** hooks and **not** REST endpoints — the embed tags, the block and widget schemas, what the plugin writes to your database, and exactly which capability each route requires. Every claim carries a `file:line` citation against **1.3.0** so you can confirm it against your installed version. Pro-only items are marked **(Pro)**.

| Page | Covers |
|---|---|
| [Shortcodes](/reference/shortcodes) | All four tags, `[fluentplayer]`'s 16 attributes with types and defaults, the source/setting precedence chains, and the override trap that silently disables timed content. |
| [Blocks & Page-Builder Widgets](/reference/blocks) | The four block names and eight registrations with full attribute schemas, the undocumented free→Pro timed-content markup contract, and the four Elementor/Divi widgets plus their registry filter. |
| [DOM Attributes](/reference/dom-attributes) | The `data-*` contract between the PHP renderer and the frontend runtime — who writes each attribute, who reads it, its value shape, and which attributes belong to Vidstack rather than FluentPlayer. |
| [Data Model](/reference/data-model) | Custom tables with exact column types, both custom post types, the `flp_media_tag` taxonomy, every meta and option key, the seven settings sections, and the table rename/drop history. |
| [Capabilities & Permissions](/reference/capabilities) | The capability behind every policy in free and Pro, the filterable authoring gate, three real traps (`PresetPolicy`, the Mux split, the three public routes), and the separate nonce-based AJAX model. |

Related: [Hooks & Filters](/hooks/), [REST API](/rest-api/), [Extending FluentPlayer](/extending/).
