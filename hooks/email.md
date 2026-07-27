---
title: "Email Provider Hooks"
description: "Filters that shape the FluentPlayer email-capture pipeline — submission, provider dispatch, the notification email, and export."
---

# Email Provider Hooks

These hooks shape the email-capture pipeline: what gets submitted, which providers a submission is dispatched to, what data reaches them, and how captured emails are exported. To register a whole new provider, see [Build a Custom Email Provider](/extending/custom-email-provider) — the filters here adjust existing behavior.

The pipeline runs across three classes:

- `app/Hooks/Handlers/EmailCollectionHandler.php` — the AJAX submission endpoint.
- `app/Services/EmailCollectionService.php` — provider dispatch and the wp_mail notification.
- `app/Services/EmailProviderService.php` — the provider registry, its UI metadata, and export.

## `fluent_player/pre_process_email_submit`

**Type:** filter · **Source:** `app/Hooks/Handlers/EmailCollectionHandler.php:77`

The sanctioned seam for taking over a submission. Fires after the raw data is read and validated, before any settings resolution, rate limiting, provider dispatch or DB write.

**Return anything other than `null` to short-circuit the entire submission** — the handler immediately `wp_send_json_success()`es your value and returns (`:77-81`). Nothing is stored and no provider is called.

| Arg | Type | Description |
|---|---|---|
| `$result` | `null` | Default `null` (continue normally). |
| `$data` | `array` | The sanitized submission data. |

```php
add_filter('fluent_player/pre_process_email_submit', function ($result, $data) {
    if (my_own_crm_handles($data)) {
        my_own_crm_store($data);

        return ['message' => __('Thanks!', 'your-textdomain')]; // short-circuits
    }

    return $result; // null → FluentPlayer continues as usual
}, 10, 2);
```

## `fluent_player/email_providers`

**Type:** filter · **Source:** `app/Hooks/Handlers/EmailCollectionHandler.php:103`

::: danger This is not a provider registry
Despite the name, this filter does **not** register providers. It filters the **per-layer / per-preset configured provider list** — `Arr::get($settings, 'email_capture.providers', [])` (`EmailCollectionHandler.php:101`) — for one submission only.

Appending a provider *object* (or a class name) here does nothing: the consumer loop calls `Arr::isTrue($provider, 'enabled')` on every element (`app/Services/EmailCollectionService.php:319`), which is false for anything that is not an array with a truthy `enabled` key, and the entry is silently skipped.

To register a provider, call `EmailProviderService::registerProvider()` (`app/Services/EmailProviderService.php:42`) inside the [`fluent_player/register_email_providers`](/hooks/actions#fluent-player-register-email-providers) action. See [Build a Custom Email Provider](/extending/custom-email-provider).
:::

### Element shape

Each element of `$providers` is an array (consumer loop: `app/Services/EmailCollectionService.php:318-337`):

| Key | Type | Description |
|---|---|---|
| `enabled` | `bool` | Read via `Arr::isTrue()`. Falsy → the element is skipped entirely. |
| `type` | `string` | The registered provider key. The special value `'email'` means a **wp_mail notification**, not a registered provider (`EmailCollectionService.php:51-53`). |
| `config` | `array` | Per-layer configuration handed to the provider (list ID, tags, custom fields…). Defaults to `[]`. |

| Arg | Type | Description |
|---|---|---|
| `$providers` | `array` | The configured provider entries for this capture layer/preset. |
| `$data` | `array` | The submitted email data. |
| `$settings` | `array` | The resolved capture layer/preset settings. |

```php
add_filter('fluent_player/email_providers', function ($providers, $data, $settings) {
    // Skip all delivery for a test address.
    if (isset($data['email']) && $data['email'] === 'test@example.com') {
        return [];
    }

    // Disable one configured provider without editing the layer.
    foreach ($providers as $index => $provider) {
        if (isset($provider['type']) && $provider['type'] === 'mailchimp') {
            $providers[$index]['enabled'] = false;
        }
    }

    return $providers;
}, 10, 3);
```

## `fluent_player/provider_config`

**Type:** filter · **Source:** `app/Services/EmailCollectionService.php:327`

The sanctioned seam for adjusting a **third-party provider's per-layer config without owning the provider class**. Fires once per enabled provider, immediately before `processProvider()` runs.

| Arg | Type | Description |
|---|---|---|
| `$config` | `array` | The provider's `config` array from the capture settings. |
| `$type` | `string` | The provider key. |
| `$email` | `string` | The submitted email address. |
| `$data` | `array` | The full submission data. |

```php
add_filter('fluent_player/provider_config', function ($config, $type, $email, $data) {
    if ($type !== 'mailchimp') {
        return $config;
    }

    // Route submissions from one media to a different list.
    if ((int) ($data['media_id'] ?? 0) === 1234) {
        $config['list_id'] = 'abc123';
    }

    return $config;
}, 10, 4);
```

## Submission-pipeline hooks

| Hook | Type | Source | Notes |
|---|---|---|---|
| `fluent_player/raw_request_data` | filter | `app/Hooks/Handlers/EmailCollectionHandler.php:247` | Filters the sanitized request array before validation. 1 arg. |
| `fluent_player/validate_email_submission` | filter | `app/Hooks/Handlers/EmailCollectionHandler.php:259` | Default `null`. Return a `WP_Error` to reject the submission — its message is thrown and surfaced to the visitor. 2 args (`$result`, `$data`). |
| `fluent_player/submission_data` | filter | `app/Hooks/Handlers/EmailCollectionHandler.php:116` | Filters the row about to be written to `flp_email_collections`. 3 args (`$submissionData`, `$data`, `$integrationResults`). |
| `fluent_player/email_submission_rate_limit_max_attempts` | filter | `app/Hooks/Handlers/EmailCollectionHandler.php:342` | Default `3`. 2 args (`$max`, `$data`). Guests only. |
| `fluent_player/email_submission_rate_limit_window` | filter | `app/Hooks/Handlers/EmailCollectionHandler.php:347` | Default `5 * MINUTE_IN_SECONDS`. 2 args (`$window`, `$data`). Guests only. |

Both rate-limit filters are wrapped in `absint()`, and returning `0` (or anything below `1`) for either **disables guest rate limiting entirely** (`EmailCollectionHandler.php:353-355`).

```php
add_filter('fluent_player/validate_email_submission', function ($result, $data) {
    if (isset($data['email']) && substr($data['email'], -12) === '@example.com') {
        return new \WP_Error('blocked_domain', __('That email domain is not accepted.', 'your-textdomain'));
    }

    return $result;
}, 10, 2);
```

## Provider-dispatch hooks

| Hook | Type | Source | Notes |
|---|---|---|---|
| `fluent_player/pre_process_email_collection` | filter | `app/Services/EmailCollectionService.php:311` | Default `null`. Return non-null to skip the whole provider loop and use your value as the results. 4 args (`$result`, `$email`, `$data`, `$providers`). |
| `fluent_player/post_process_email_collection` | filter | `app/Services/EmailCollectionService.php:340` | Filters the aggregated per-provider results. 4 args (`$results`, `$email`, `$data`, `$providers`). |
| `fluent_player/pre_process_email_provider` | filter | `app/Services/EmailCollectionService.php:46` | Default `null`. Return non-null to short-circuit a **single** provider call. 4 args (`$result`, `$providerType`, `$email`, `$config`). |
| `fluent_player/post_process_email_provider` | filter | `app/Services/EmailCollectionService.php:92` | Filters one provider's response. 4 args (`$response`, `$providerType`, `$email`, `$config`). |

## Notification-email hooks

These fire only for the `'email'` provider type (the wp_mail notification).

| Hook | Type | Source | Notes |
|---|---|---|---|
| `fluent_player/email_template` | filter | `app/Services/EmailCollectionService.php:134` | The formatted email body after placeholder replacement. 3 args (`$formattedBody`, `$email`, `$config`). |
| `fluent_player/email_data` | filter | `app/Services/EmailCollectionService.php:163` | The full `wp_mail()` argument set — `to`, `subject`, `body`, `headers`, `attachments`. 3 args (`$emailData`, `$email`, `$config`). All five keys are read back unconditionally, so never drop one. |
| `fluent_player/email_styles` | filter | `app/Services/EmailCollectionService.php:268` | The inline CSS map: `header_border`, `content`, `paragraph`, `heading`, `footer`, `link`. 1 arg. `paragraph` is read unconditionally right after — keep the key. |

## Registry & export hooks

| Hook | Type | Source | Notes |
|---|---|---|---|
| `fluent_player/email_provider_placeholder_meta` | filter | `app/Services/EmailProviderService.php:202` | Default `[]`. Only consulted when Pro is **not** active — lets a free build advertise upgrade-only providers in the UI. 1 arg. |
| `fluent_player/email_provider_meta` | filter | `app/Services/EmailProviderService.php:210` | The provider metadata map shown in the admin (title, description, logo, settings fields). 1 arg. |
| `fluent_player/email_export_columns` | filter | `app/Services/EmailProviderService.php:305` | Columns for the captured-email export. Default `['email', 'media_id', 'preset_slug', 'created_at']`. 1 arg. |

::: warning `email_export_columns` output is intersected, not trusted
Your return value is run through `array_intersect()` against `EmailProviderService::ALLOWED_EXPORT_COLUMNS` (`app/Services/EmailProviderService.php:268-272`, applied at `:309`) to prevent SQL injection. Any column not in that constant is **silently dropped**, and if nothing survives the export falls back to `['email', 'created_at']` (`:311-313`).

The allowed set is: `id`, `email`, `media_id`, `preset_slug`, `layer_id`, `video_time`, `ip_address`, `browser`, `device`, `user_id`, `meta`, `created_at`, `updated_at`.
:::

```php
add_filter('fluent_player/email_export_columns', function ($columns) {
    $columns[] = 'ip_address'; // allowed
    $columns[] = 'my_custom';  // silently dropped by the intersect

    return $columns;
});
```

## See also

- Action: [`fluent_player/email_collected`](/hooks/actions#fluent-player-email-collected) — fires after a submission is stored (and again for a repeat submission from the same address).
- Action: [`fluent_player/register_email_providers`](/hooks/actions#fluent-player-register-email-providers) — the place to call `EmailProviderService::registerProvider()`.
- Guide: [Build a Custom Email Provider](/extending/custom-email-provider).
