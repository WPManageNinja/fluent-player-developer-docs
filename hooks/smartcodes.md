---
title: "Smartcode Hooks"
description: "Filters for registering FluentPlayer smartcodes and their groups, and for parsing smartcodes in player text."
---

# Smartcode Hooks

**Smartcodes** are merge-tag tokens FluentPlayer resolves to real values in supported player text. These filters let you register your own smartcode namespaces and groups, and hook into parsing.

## Token syntax

```
{{namespace.key}}
{{namespace.key|fallback}}
```

`SmartcodeParser::parse()` matches every <code v-pre>{{…}}</code> in the string, then `SmartcodeParser::replace()` (`app/Services/Smartcode/SmartcodeParser.php:30-58`) breaks the inner text up:

1. Split on the **first** `.` — everything before it is the **namespace**, everything after is the rest (`:37-38`). An inner value with no `.` is left untouched (`:33-35`).
2. Split the rest on `|`. Segment 0 is the **key**, segment 1 is the **fallback** (`:41-43`). A third segment is **reserved for a transformer** and is currently ignored (`:40`).
3. If the namespace is not registered, the raw token is returned untouched so a later parser can handle it (`:45-48`).
4. The namespace's `resolver` is called; a `null` return becomes an empty string (`:55-57`).

Because the split is on the *first* dot, a key may itself contain dots — that is how <code v-pre>{{date.format.D, d M Y}}</code> works: namespace `date`, key `format.D, d M Y`.

## Core namespaces

Four namespaces ship in the free plugin (`app/Services/Smartcode/SmartcodeRegistry.php:56-109`), all in the `general` picker group:

| Namespace | Tokens |
|---|---|
| `user` | <code v-pre>{{user.display_name}}</code>, <code v-pre>{{user.first_name}}</code>, <code v-pre>{{user.last_name}}</code>, <code v-pre>{{user.email}}</code>, <code v-pre>{{user.login}}</code>, <code v-pre>{{user.id}}</code>, <code v-pre>{{user.role}}</code> |
| `site` | <code v-pre>{{site.name}}</code>, <code v-pre>{{site.tagline}}</code>, <code v-pre>{{site.url}}</code>, <code v-pre>{{site.admin_email}}</code> |
| `date` | <code v-pre>{{date.now}}</code>, <code v-pre>{{date.year}}</code>, <code v-pre>{{date.format.&lt;php-date-format&gt;}}</code> |
| `media` | <code v-pre>{{media.title}}</code>, <code v-pre>{{media.author}}</code>, <code v-pre>{{media.date}}</code>, <code v-pre>{{media.id}}</code> |

::: tip <code v-pre>{{contact.*}}</code> is FluentCRM, not FluentPlayer
FluentCRM contact tags are **not** FluentPlayer smartcodes. `SmartcodeParser` deliberately leaves unknown namespaces alone, and `MediaService::parseSmartcodes()` then hands the string to FluentCRM's own parsers — `fluent_crm/parse_campaign_email_text` and `fluent_crm/parse_extended_crm_text` (`app/Services/MediaService.php:706-710`). Registering a `contact` namespace here would shadow FluentCRM's.
:::

## `fluent_player/smartcodes`

**Type:** filter · **Source:** `app/Services/Smartcode/SmartcodeRegistry.php:21`

Filters the registered smartcode namespace map — the single source of truth for both the picker popup and the parser. The REST controller does not apply this filter itself, but its response is derived from it: `SmartcodeController::get()` calls `SmartcodeRegistry::uiGroups()` (`app/Http/Controllers/SmartcodeController.php:15`), which calls `namespaces()` (`app/Services/Smartcode/SmartcodeRegistry.php:28-31`), which is where this filter runs. A namespace you register here **does** appear in the picker.

| Arg | Type | Description |
|---|---|---|
| `$namespaces` | `array` | Map of namespace slug → definition. |

### Namespace definition contract

Documented on the class docblock at `app/Services/Smartcode/SmartcodeRegistry.php:9-16` and consumed by `uiGroups()` at `:36-51`:

| Key | Type | Required | Description |
|---|---|---|---|
| `group` | `string` | no | Picker group key. Defaults to the namespace slug (`:37`). |
| `group_title` | `string` | no | Human-readable group heading. Defaults to `ucfirst($slug)` (`:38`). |
| `tokens` | `array` | yes | Map of the **full token string** (<code v-pre>'{{ns.key}}'</code>, including braces) → label. See the core namespaces at `:65-73`. Used only to build the picker list. |
| `resolver` | `callable` | yes | Any callable. Signature: `(string $key, string $fallback, array $context): string`. Returning `null` yields an empty string. |

::: warning `tokens` keys include the braces
The picker inserts the array **key** verbatim, so it must be the complete token — <code v-pre>'{{my_ns.plan}}'</code>, not `'plan'`. A bare key inserts broken text into the editor.
:::

```php
add_filter('fluent_player/smartcodes', function ($namespaces) {
    $namespaces['my_ns'] = [
        'group'       => 'my_plugin',
        'group_title' => __('My Plugin', 'your-textdomain'),
        'tokens'      => [
            '{{my_ns.plan}}'       => __('My Plugin: Plan Name', 'your-textdomain'),
            '{{my_ns.expires_on}}' => __('My Plugin: Expiry Date', 'your-textdomain'),
        ],
        'resolver'    => function ($key, $fallback, $context) {
            $userId = get_current_user_id();
            if (!$userId) {
                return $fallback;
            }

            if ($key === 'plan') {
                $plan = (string) get_user_meta($userId, 'my_plan_name', true);

                return $plan !== '' ? $plan : $fallback;
            }

            if ($key === 'expires_on') {
                $stamp = (int) get_user_meta($userId, 'my_plan_expires', true);

                return $stamp ? date_i18n(get_option('date_format'), $stamp) : $fallback;
            }

            return $fallback;
        },
    ];

    return $namespaces;
});
```

The resolver may be any callable — a closure, `'my_function'`, or `[MyClass::class, 'resolve']` as the core namespaces use.

## `fluent_player/smartcode_groups`

**Type:** filter · **Source:** `app/Http/Controllers/SmartcodeController.php:30`

Filters the smartcode **groups** shown in the admin picker, as returned by the [smartcodes endpoint](/rest-api/smartcodes).

::: tip Different layer from `fluent_player/smartcodes`
`fluent_player/smartcodes` filters the core **namespace registry** — it affects both the parser and the picker. The REST controller never calls it directly, but it runs upstream of the endpoint's response via `uiGroups()` → `namespaces()`, so namespaces registered here do reach the picker.

`fluent_player/smartcode_groups` filters only the **UI group list** the REST endpoint returns (the `{key, title, shortcodes}` shape produced by `SmartcodeRegistry::uiGroups()`). Adding a group here makes tokens appear in the picker but does **not** make them resolvable — register a namespace with a `resolver` for that.
:::

| Arg | Type | Description |
|---|---|---|
| `$groups` | `array` | List of `['key' => string, 'title' => string, 'shortcodes' => array]`. |

```php
add_filter('fluent_player/smartcode_groups', function ($groups) {
    $groups[] = [
        'key'        => 'crm',
        'title'      => __('FluentCRM Contact', 'your-textdomain'),
        'shortcodes' => [
            '{{contact.first_name}}' => __('Contact: First Name', 'your-textdomain'),
        ],
    ];

    return $groups;
});
```

## `fluent_player/parse_smartcodes`

**Type:** filter · **Source:** `app/Services/MediaService.php:698`

Filters a string as smartcodes are parsed, so you can resolve custom tokens without registering a namespace. FluentPlayer's own parser is attached here; FluentCRM's contact parser runs **after** it.

| Arg | Type | Description |
|---|---|---|
| `$parsed` | `string` | The text being parsed. Always a string at this call site. |
| `$context` | `array` | Parse context — the second argument of `MediaService::parseSmartcodes($settings, $context = [])` (`:689`). Defaults to `[]`. The same array is passed as the third resolver argument (`app/Services/Smartcode/SmartcodeRegistry.php:15`). |

```php
add_filter('fluent_player/parse_smartcodes', function ($text, $context) {
    return str_replace('{{my_ns.plan}}', 'Pro', $text);
}, 10, 2);
```

### When it actually fires

The filter only runs inside the `is_string($settings)` branch of `MediaService::parseSmartcodes()` (`app/Services/MediaService.php:691-719`), and only after `containsSmartcode()` passes (`:692`). `containsSmartcode()` (`:801-804`) is a plain substring test: the string must contain <code v-pre>{{</code> **or** `##`, or the whole branch returns early and your filter never runs.

When `parseSmartcodes()` is handed an **array**, it does not recurse everywhere. It walks a fixed whitelist:

| Scope | Fields | Source |
|---|---|---|
| Top level | `title` | `:727` |
| `layers[]` | `content`, `title`, `text`, `description`, `button_text`, `button_url`, `url`, `click_url`, `badge_text` | `:730-733` |
| `overlays[]` | `text`, `link` | `:730-733` |
| `email_capture` | `placeholder`, `headline`, `button_text`, `bottom_text`, `confirmation_message` | `:736-740` |
| `cta` | `content` | `:736-740` |
| `action_bar` | `text`, `button_text`, `button_link` | `:736-740` |

A smartcode anywhere else in the settings array is never parsed.

::: danger Unresolved tokens are destroyed, not left alone
After your filter (and FluentCRM's) have run, anything still matching <code v-pre>{{…}}</code> is passed to `stripSmartcodes()` (`:714-716`, definition `:806-816`). That function replaces each remaining token with **only its `|fallback` segment** — an empty string when there is no fallback — and also strips `##…##` pairs.

So returning text that still contains <code v-pre>{{…}}</code> tokens does not defer them to something later: they are deleted. If your resolver cannot produce a value, emit the fallback yourself, or write the tokens with a `|fallback` segment so something survives.
:::
