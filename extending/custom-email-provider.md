---
title: "Build a Custom Email Provider"
description: "Deliver FluentPlayer email-capture submissions to a custom service by extending AbstractEmailProvider."
---

# Build a Custom Email Provider

FluentPlayer's email-capture layer sends submitted emails to one or more **providers**. The free build ships a FluentCRM provider; Pro adds Mailchimp and Webhook. You can register your own by extending `AbstractEmailProvider`.

The bundled reference implementation to read alongside this guide is `app/Integrations/FluentCrm/EmailCaptureProvider.php:18` — the class `app/Hooks/actions.php:237` actually instantiates. For a richer example (settings page, repeatable `complex_array` fields, per-layer field), read **(Pro)** `app/EmailProviders/WebhookProvider.php:11`.

::: warning `app/EmailProviders/FluentCRMProvider.php` is not the reference implementation
It is a 38-line `@deprecated` back-compat shim (`app/EmailProviders/FluentCRMProvider.php:11-17`) that subclasses `EmailCaptureProvider` and exists only because released Pro references that class path. Do not model your provider on it.
:::

## Prerequisites

- FluentPlayer installed and active.
- Your code in a small plugin or a `functions.php`-style snippet. The namespaces you consume are `FluentPlayer\App\EmailProviders\AbstractEmailProvider` and `FluentPlayer\App\Services\EmailProviderService`.
- PHP 7.4+ (FluentPlayer's floor).

::: danger Do not depend on `FluentPlayer\Framework\*`
`Arr`, `Sanitizer`, `Validator` and everything else under `FluentPlayer\Framework\` are WPFluent internals whose namespace is rewritten per build by the plugin's namespace-prefixer. They are not a supported third-party dependency and can move without notice. Use WP core helpers (`sanitize_text_field()`, `rest_sanitize_boolean()`, `wp_remote_post()`, `is_wp_error()`) plus the two supported classes above.
:::

## 1. Extend the base class

`app/EmailProviders/AbstractEmailProvider.php:9` is an `abstract class` defining five **abstract methods you must implement**, plus properties describing the provider.

| Member | Kind | Purpose |
|---|---|---|
| `$provider`, `$name`, `$description`, `$logo` | properties | Identity shown in the UI. |
| `$defaultSettings` | property | Seeded into the saved settings blob the first time the provider is read. **Must contain `enabled`** — see below. |
| `validateSettings($settings)` | **abstract** (`:95`) | Return `\WP_Error` to block a save. |
| `sanitizeSettings($settings)` | **abstract** (`:102`) | Sanitize settings — runs *before* validation. |
| `getSettingsFields()` | **abstract** (`:108`) | Indexed list of field descriptors. |
| `subscribe($email, $data, $settings)` | **abstract** (`:117`) | Deliver a captured email to your service. |
| `isConfigured($settings)` | **abstract** (`:124`) | Whether the provider has enough config to run. |

These signatures are stable — implement them exactly as listed. Line references are `app/EmailProviders/AbstractEmailProvider.php`.

`getProvider()` (`:45`), `getName()` (`:54`), `getDescription()` (`:63`), `getLogo()` (`:72`), `getDefaultSettings()` (`:85`), `handleAction($action, $settings, $data = [])` (`:133`), `validateField($field, $value)` (`:144`), and `verifyConnectionStatus($settings)` (`:156`) are already implemented — override only if you need to.

### Two rules that decide whether your provider works at all

::: danger 1. A provider whose saved settings have a falsy `enabled` is invisible
The capture-layer provider dropdown is built by `getAvailableProviderTypes()` (`resources/blocks/media/components/EmailProviderSettings.jsx:1017`) and only lists a provider when `availableProviders[key]?.enabled` is truthy (`:1024`). `availableProviders` is the saved settings blob returned by `EmailProviderService::getProvidersSettings()` (`app/Services/EmailProviderService.php:71`), which seeds missing providers from `getDefaultSettings()` (`:85-88`).

So if `$defaultSettings` has no `enabled` key, your provider never appears in any capture layer and `subscribe()` never runs — silently, with no error. Declare `'enabled' => false` in `$defaultSettings`, and make sure `sanitizeSettings()` preserves the key so the admin's enable toggle sticks.

Compare **(Pro)** `WebhookProvider.php:18-21` and `app/Integrations/FluentCrm/EmailCaptureProvider.php:25-32`.
:::

::: danger 2. `getSettingsFields()` returns an indexed list, not a keyed map
Every consumer reads `field.key` off each element: `ConfigFormFields.vue:117` (`:key="field.key"`), `IntegrationConfigPage.vue:79-86`, `useProviderConfig.js:85-92`, `EmailProviderSettings.jsx:607`. If you return `['api_key' => [...]]`, Vue's `v-for` iterates the *values*, `field.key` is `undefined` for every field, all fields collide on the same render key, and nothing is ever written back to `$settings['api_key']`.

Correct shape — each descriptor carries its own `key`:

```php
return [
    ['key' => 'enabled', 'type' => 'switch', 'label' => '…'],
    ['key' => 'api_key', 'type' => 'api_key', 'label' => '…'],
];
```
:::

### The provider class

```php
<?php

namespace MyPlugin\FluentPlayer;

use FluentPlayer\App\EmailProviders\AbstractEmailProvider;
use FluentPlayer\App\Services\EmailProviderService;

class MyServiceProvider extends AbstractEmailProvider
{
    protected $provider    = 'my_service';
    protected $name        = 'My Service';
    protected $description = 'Send captured emails to My Service.';

    // Third-party providers MUST use an absolute http(s) URL — see "Logos" below.
    protected $logo = 'https://cdn.my-service.com/badge.svg';

    protected $defaultSettings = [
        'enabled' => false,
        'api_key' => '',
        'list_id' => '',
    ];

    public function getSettingsFields()
    {
        return [
            [
                'key'     => 'enabled',
                'type'    => 'switch',
                'label'   => __('Enable My Service', 'my-plugin'),
                'help'    => __('Deliver captured emails to My Service.', 'my-plugin'),
                'context' => 'settings',
            ],
            [
                'key'      => 'api_key',
                'type'     => 'api_key',
                'label'    => __('API Key', 'my-plugin'),
                'required' => true,
                'help'     => __('Found under Settings → Developers in My Service.', 'my-plugin'),
                'context'  => 'settings',
            ],
            [
                'key'         => 'list_id',
                'type'        => 'text',
                'label'       => __('List ID', 'my-plugin'),
                'placeholder' => __('e.g. 4821', 'my-plugin'),
                'help'        => __('Which list this capture layer subscribes to.', 'my-plugin'),
                'context'     => 'preset_editor',
            ],
        ];
    }

    public function sanitizeSettings($settings)
    {
        return [
            'enabled' => rest_sanitize_boolean($settings['enabled'] ?? false),
            'api_key' => sanitize_text_field($settings['api_key'] ?? ''),
            'list_id' => sanitize_text_field($settings['list_id'] ?? ''),
        ];
    }

    public function validateSettings($settings)
    {
        if (!empty($settings['enabled']) && empty($settings['api_key'])) {
            return new \WP_Error(
                'my_service_missing_api_key',
                __('An API Key is required to enable My Service.', 'my-plugin')
            );
        }

        // Only a WP_Error is acted on — see "Save order" below.
        return $settings;
    }

    public function isConfigured($settings)
    {
        return !empty($settings['enabled']) && !empty($settings['api_key']);
    }

    public function subscribe($email, $data, $settings)
    {
        // $settings is the CAPTURE LAYER's config, not the global settings.
        // 'api_key' is auto-copied into it by the block editor; anything else
        // global must be read back explicitly.
        $globals = EmailProviderService::getProvidersSettings();
        $apiKey  = $settings['api_key'] ?? ($globals['my_service']['api_key'] ?? '');

        if (!$apiKey) {
            return new \WP_Error(
                'my_service_missing_api_key',
                __('My Service is not configured.', 'my-plugin')
            );
        }

        $response = wp_remote_post('https://api.my-service.com/v1/subscribers', [
            'timeout' => 15,
            'headers' => [
                'Authorization' => 'Bearer ' . $apiKey,
                'Content-Type'  => 'application/json',
            ],
            'body' => wp_json_encode([
                'email'   => $email,
                'list_id' => $settings['list_id'] ?? '',
                'name'    => $data['name'] ?? '',
            ]),
        ]);

        // Transport failure (DNS, timeout, TLS).
        if (is_wp_error($response)) {
            return $response;
        }

        // HTTP failure. wp_remote_post() returns an ARRAY for a 4xx/5xx, so
        // without this check a rejected request is recorded as a success.
        $code = (int) wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($code < 200 || $code > 299) {
            return new \WP_Error(
                'my_service_http_error',
                sprintf(
                    /* translators: %d: HTTP status code returned by My Service */
                    __('My Service returned HTTP %d.', 'my-plugin'),
                    $code
                ),
                ['status' => $code, 'body' => $body]
            );
        }

        return [
            'success' => true,
            'message' => __('Subscriber added to My Service.', 'my-plugin'),
            'data'    => $body,
        ];
    }
}
```

### Why the response-code check matters

`EmailCollectionService::processProvider()` branches **only** on `is_wp_error($result)` (`app/Services/EmailCollectionService.php:78-84`). Everything else becomes `['success' => true, …]` (`:86-90`). Since `wp_remote_post()` returns a normal array for an HTTP 401 or 500, a provider that returns the raw response reports every rejection as a successful subscription — in the stored `meta.provider_log`, in the `fluent_player/email_collected` payload, and in the admin UI.

## 2. Register the provider

There is exactly **one** registration mechanism: the `fluent_player/register_email_providers` action (fired at `app/Services/EmailProviderService.php:35`) plus a call to `EmailProviderService::registerProvider()`.

```php
add_action('fluent_player/register_email_providers', function () {
    \FluentPlayer\App\Services\EmailProviderService::registerProvider(
        new \MyPlugin\FluentPlayer\MyServiceProvider()
    );
});
```

`registerProvider()` (`:42`) type-hints `AbstractEmailProvider` and keys the registry by `getProvider()` (`:44-45`), so registering twice is idempotent. This is the same path free uses for FluentCRM (`app/Hooks/actions.php:231-243`).

::: tip Registration is lazy, so hook early
`EmailProviderService::init()` is not called at boot. It runs on demand from `EmailProviderController::__construct()` (`app/Http/Controllers/EmailProviderController.php:22`), from `EmailCollectionService::processProvider()` when the registry is empty (`app/Services/EmailCollectionService.php:55-57`), and from `TimelineArmingSource.php:28`. Add your `add_action()` at plugin file scope or on `plugins_loaded` so the callback is attached before any of those fire.
:::

::: danger `fluent_player/email_providers` is **not** a provider registry
`app/Hooks/Handlers/EmailCollectionHandler.php:103` filters the *per-layer config list* for one submission. Its elements are `['enabled' => bool, 'type' => string, 'config' => array]`, consumed at `app/Services/EmailCollectionService.php:318-337`.

Pushing an `AbstractEmailProvider` object into that array does not register anything. The object has no `enabled` key, so `Arr::isTrue($provider, 'enabled')` is false (`:319`) and the entry is skipped. Nothing fatals, nothing is logged, and nothing runs. Use it only for what it is — adjusting which already-registered providers a given submission is dispatched to. See [Email Provider Hooks](/hooks/email).
:::

## 3. Field descriptors

### Supported `type` values

Rendered by `resources/admin/modules/settings/components/ConfigFormFields.vue` (Integrations settings page) and `resources/blocks/media/components/EmailProviderSettings.jsx` (capture-layer editor).

| `type` | Renders as | Notes |
|---|---|---|
| `text` | single-line input | The default — any unrecognised `type` falls through to it (`ConfigFormFields.vue:349-355`). |
| `number` | numeric input | Same input, `type="number"` (`:353`). |
| `textarea` | multi-line input | `rows` supported in the block editor. |
| `password` | masked input with Show/Hide | `ConfigFormFields.vue:329-341`. |
| `api_key` | masked input with Show/Hide | Same renderer as `password`; see the `api_key` special case below. |
| `switch` / `checkbox` | toggle | `ConfigFormFields.vue:120`, `:222`. |
| `select` | dropdown | Add `multiple: true` for multi-select. Static `options` or `async` — see below. |
| `radio` | radio group | `:183`, `:295`. |
| `checkbox_group` | checkbox group | `:169`, `:264`. |
| `media_select` | WP media picker | `:197`, `:310`. |
| `notice` | inline notice, no input | Uses `text`, optional `variant` and `link` (`:138-157`). |
| `setup_instructions` | "Setup Required" alert + dialog | Pulled out ahead of the form (`:19`, `:97-112`). Carries an `instructions` array. |
| `complex_array` | repeatable group of sub-fields | Needs a nested `fields` list — see **(Pro)** `WebhookProvider.php:116-176`. |
| `array` | repeatable flat list | Handled by `IntegrationConfigPage.vue:155`, `:228`, `:379`. |

Common optional keys on any descriptor: `label`, `help` / `description`, `placeholder`, `default`, `required`, `indent`, `depends_on`, `context`.

### Field contexts

`context` decides **where** a field is shown. There are two surfaces and they filter in opposite directions:

| `context` | Integrations settings page | Capture-layer editor (block) |
|---|---|---|
| `'settings'` | shown | hidden |
| *(omitted)* | shown | hidden |
| `'preset_editor'` | hidden | shown |

- The settings page keeps everything except `preset_editor`: `IntegrationConfigPage.vue:53` filters with `f.context !== 'preset_editor'`.
- The capture-layer editor keeps only `preset_editor`: `EmailProviderSettings.jsx:602` returns `null` for `field.context && field.context !== 'preset_editor'`.
- **And** the provider must have a truthy saved `enabled` to be pickable at all (`EmailProviderSettings.jsx:1024`).

A field with no `context` therefore appears on the settings page and **never** reaches `subscribe()`.

::: tip The `enabled` descriptor is page chrome, not a form field
`ConfigFormFields.vue:20` filters `key !== 'enabled'` out of the rendered form body and renders a dedicated "Enable Integration" switch above it instead (`:83-94`). Declaring an `enabled` descriptor in `getSettingsFields()` is therefore **harmless but not what draws the toggle** — the toggle exists regardless, driven by the saved `enabled` value that `IntegrationConfigPage.vue:114` reads on save (and rolls back at `:125` when disabling fails).

Declare it anyway: it documents the key and matches shipped providers (**(Pro)** `WebhookProvider.php:109-115`). What you must **not** skip is `'enabled' => false` in `$defaultSettings` — that is what makes the key exist at all, and without it the provider never becomes selectable. The [integration guide](/extending/custom-integration#_4-field-descriptors) documents the identical behaviour for `AbstractIntegration`.
:::

### Async option loading

For `select` fields whose options come from your service, set `async: true` and an `endpoint`. The block editor strips everything before the last `/` and calls `handleAction()` with that as the action name (`EmailProviderSettings.jsx:232-256`, `:297`), routed through `EmailProviderService::handleProviderAction()` (`app/Services/EmailProviderService.php:250`).

```php
[
    'key'      => 'list_id',
    'type'     => 'select',
    'label'    => __('List', 'my-plugin'),
    'async'    => true,
    'endpoint' => 'email-providers/my_service/lists', // → handleAction('lists', …)
    'context'  => 'preset_editor',
],
```

Add `depends_on: 'other_field'` to defer the fetch until that field has a value; its value is passed through as a request param (`EmailProviderSettings.jsx:242-254`). See `EmailCaptureProvider.php:84-104` and `:198-213` for a working pair.

### Logos

`getLogo()` (`AbstractEmailProvider.php:72-79`) resolves any `$logo` that does **not** start with `http` against FluentPlayer's own built asset directory via `Vite::getEnqueuePath('images/' . $this->logo)`. A third-party provider setting `$logo = 'my-icon.svg'` therefore produces a URL inside FluentPlayer's `dist/` folder, where your file does not exist.

Use an absolute `http(s)` URL, or override `getLogo()` to return `plugins_url('assets/my-icon.svg', __FILE__)`.

## 4. What `$settings` actually is inside `subscribe()`

This is the single most common source of "my provider runs but has no config".

On the production path `subscribe()` is called from `EmailCollectionService::processProvider()` (`app/Services/EmailCollectionService.php:76`) as:

```php
$result = $provider->subscribe($email, $data, $config);
```

where `$config` is the **capture layer's own `config` array** — `Arr::get($provider, 'config', [])` at `:324`, after passing through the `fluent_player/provider_config` filter at `:327`.

It is **not** `EmailProviderService::getProvidersSettings()['my_service']`.

| What you want | Where it comes from |
|---|---|
| Fields declared `'context' => 'preset_editor'` | Present in `$settings` — they are what the layer editor writes into `config`. |
| `api_key` | Present. The block editor special-cases this literal key name and copies it from the global settings into every layer's `config` (`EmailProviderSettings.jsx:289-292`, `:415-416`, `:563-565`). No other global key is forwarded. |
| Any other global credential | **Absent.** Read it yourself: `EmailProviderService::getProvidersSettings()['my_service']['…']`. |
| The submitted form data | **Not in `$settings`, and mostly not in `$data` either** — see below. |

### `$data` is nearly empty

`processProvider()` builds `$data` from scratch (`:71-74`):

```php
$data = [];
if (!empty($config['name'])) {
    $data['name'] = $config['name'];
}
```

So `$data` contains at most a `name` key, sourced from the layer config — not from the visitor's submission. If you need the submitted payload, hook [`fluent_player/email_collected`](/hooks/actions#fluent-player-email-collected) or `fluent_player/pre_process_email_provider` (`:46`) instead of expecting it in `subscribe()`.

::: tip `EmailProviderService::subscribeToProviders()` is not the production path
`app/Services/EmailProviderService.php:221-241` *does* pass global settings to `subscribe()`, and its existence is why the "`$settings` is the global settings" assumption is so easy to make. It has no production caller — only tests. Do not design against it.
:::

## 5. Save order and validation

`EmailProviderService::saveProviderSettings()` (`:122-161`) runs, in this order:

1. `sanitizeSettings($settings)` — **first** (`:131`). Its return value replaces `$settings`.
2. `validateSettings($settings)` — **second** (`:134`), on the already-sanitized array.
3. If step 2 returned a `\WP_Error`, the save aborts and the error is returned (`:135-137`).
4. Otherwise the **sanitized** array is merged key-by-key into the stored blob (`:147-149`) and written to the `fluent_player_email_providers` option as JSON (`:152`), then the settings cache is cleared (`:154`).

::: warning Returning a modified array from `validateSettings()` has no effect
Step 4 merges the output of `sanitizeSettings()`, not of `validateSettings()`. Only a `\WP_Error` return is acted on. Put every transformation in `sanitizeSettings()`.
:::

## 6. `EmailProviderService` public API

All static. Source: `app/Services/EmailProviderService.php`.

| Member | Line | Purpose |
|---|---|---|
| `EMAIL_PROVIDERS_SETTINGS_KEY` | `:19` | `'fluent_player_email_providers'` — the WP option holding the JSON settings blob. |
| `registerProvider(AbstractEmailProvider $provider)` | `:42` | Register an instance. Keyed by `getProvider()`. |
| `getRegisteredProviders()` | `:52` | All registered instances, keyed by slug. |
| `getProvider($provider)` | `:62` | One instance, or `null`. |
| `getProvidersSettings()` | `:71` | The saved settings blob, seeded from each provider's `getDefaultSettings()` and passed through `verifyConnectionStatus()`. Statically cached. |
| `clearCache()` | `:111` | Drop that static cache. Call after writing the option yourself. |
| `saveProviderSettings($provider, $settings)` | `:122` | Sanitize → validate → merge → persist. |
| `getConfiguredProviders()` | `:167` | Settings for providers whose `isConfigured()` returns true. |
| `getProvidersMetaData()` | `:188` | `name` / `description` / `logo` / `settings_fields` per provider, for the UI. |
| `handleProviderAction($provider, $action, $data = [])` | `:250` | Dispatches to your `handleAction()` with the provider's global settings. |
| `validateProviderField($provider, $field, $value)` | `:653` | Dispatches to your `validateField()`. |
| `init()` | `:32` | Fires `fluent_player/register_email_providers`. Called lazily, not at boot. |

## 7. Verify

1. **Settings page.** Open **Settings → Integrations**. Your provider appears with the `name`, `description` and `logo` you set (from `getProvidersMetaData()`, `:188`). Only fields without `'context' => 'preset_editor'` are shown.
2. **Configure and save.** Enter the API key, flip the enable toggle, save. `sanitizeSettings()` then `validateSettings()` run; a `\WP_Error` surfaces as the save error message.
3. **Confirm `enabled` persisted.** `get_option('fluent_player_email_providers')` should now contain `"my_service":{"enabled":true,…}`. If `enabled` is missing or false, step 4 will not offer your provider.
4. **Capture layer.** Add an email-capture layer to a player. Your provider is now in the type dropdown. Selecting it renders only your `'preset_editor'` fields.
5. **Submit a test email.** Confirm your service received it, then hook [`fluent_player/email_collected`](/hooks/actions#fluent-player-email-collected) to inspect `$integrationResults` — a `\WP_Error` from `subscribe()` shows up there as `['success' => false, 'message' => …, 'code' => …]` (`app/Services/EmailCollectionService.php:78-84`).

## Reference

- Base class: `app/EmailProviders/AbstractEmailProvider.php:9`
- Registry: `app/Services/EmailProviderService.php:12`
- Dispatch loop: `app/Services/EmailCollectionService.php:308-341`
- Reference implementation: `app/Integrations/FluentCrm/EmailCaptureProvider.php:18`
- Richer example **(Pro)**: `app/EmailProviders/WebhookProvider.php:11`
- Hooks: [`register_email_providers`](/hooks/actions#fluent-player-register-email-providers), [`email_providers`](/hooks/email), [`email_collected`](/hooks/actions#fluent-player-email-collected)
- [Free → Pro hook contract](/extending/free-pro-contract) — why `register_email_providers` is safe to build on
