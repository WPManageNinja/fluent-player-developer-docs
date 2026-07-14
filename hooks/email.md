---
title: "Email Provider Hooks"
description: "Filters that shape the FluentPlayer email-provider registry and the data delivered when an email is captured."
---

# Email Provider Hooks

These filters shape the email-capture pipeline: which providers exist, and what data is sent to them. To register a whole new provider, see [Build a Custom Email Provider](/extending/custom-email-provider) — the filters here are for adjusting existing behavior.

## `fluent_player/email_providers`

**Type:** filter · **Source:** `app/Hooks/Handlers/EmailCollectionHandler.php:103`

Filters the providers a captured email is dispatched to for a given submission.

| Arg | Type | Description |
|---|---|---|
| `$providers` | `array` | Providers resolved for this submission. |
| `$data` | `array` | The submitted email data. |
| `$settings` | `array` | The capture layer's settings. |

```php
add_filter('fluent_player/email_providers', function ($providers, $data, $settings) {
    // e.g. skip delivery for a test address
    if (($data['email'] ?? '') === 'test@example.com') {
        return [];
    }
    return $providers;
}, 10, 3);
```

## Related filters

Discover exact signatures for these with the grep tip on the [Hooks overview](/hooks/):

- `email_data` — filter the payload before it is sent to a provider.
- `email_provider_meta` / `email_provider_placeholder_meta` — provider metadata shown in the UI.
- `email_export_columns` — columns included when exporting the captured-email list.
- `email_template` / `email_styles` — the notification email markup and CSS.

## See also

- Action: [`fluent_player/email_collected`](/hooks/actions#fluent-player-email-collected) — fires after a submission is stored.
- Action: [`fluent_player/register_email_providers`](/hooks/actions#fluent-player-register-email-providers) — register a custom provider.
