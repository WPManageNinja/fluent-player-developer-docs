---
title: "Smartcode Hooks"
description: "Filters for registering FluentPlayer smartcodes and their groups, and for parsing smartcodes in player text."
---

# Smartcode Hooks

**Smartcodes** are merge-tag tokens FluentPlayer resolves to real values in supported player text (for example, FluentCRM contact fields). These filters let you register your own smartcode namespaces and groups, and hook into parsing.

## `fluent_player/smartcodes`

**Type:** filter · **Source:** `app/Services/Smartcode/SmartcodeRegistry.php:21`

Filters the registered smartcode namespaces. Add your own namespace here.

| Arg | Type | Description |
|---|---|---|
| `$namespaces` | `array` | The core smartcode namespaces. |

```php
add_filter('fluent_player/smartcodes', function ($namespaces) {
    $namespaces['my_ns'] = [ /* your resolver config */ ];
    return $namespaces;
});
```

## `fluent_player/smartcode_groups`

**Type:** filter · **Source:** `app/Http/Controllers/SmartcodeController.php:30`

Filters the smartcode groups shown in the admin picker (returned by the [smartcodes endpoint](/rest-api/smartcodes)).

| Arg | Type | Description |
|---|---|---|
| `$groups` | `array` | Smartcode groups for the UI. |

## `fluent_player/parse_smartcodes`

**Type:** filter · **Source:** `app/Services/MediaService.php:688`

Filters text as smartcodes are parsed, so you can resolve custom tokens. When FluentCRM is present, FluentPlayer also runs the FluentCRM parser for contact merge tags.

| Arg | Type | Description |
|---|---|---|
| `$parsed` | `string` | The text being parsed. |
| `$context` | `mixed` | Parse context. |

```php
add_filter('fluent_player/parse_smartcodes', function ($text, $context) {
    return str_replace('{{my_token}}', 'value', $text);
}, 10, 2);
```
