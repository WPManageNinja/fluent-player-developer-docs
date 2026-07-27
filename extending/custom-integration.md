---
title: "Build a Custom Integration"
description: "Add a hosted-streaming or storage service to FluentPlayer by extending AbstractIntegration and registering it on the fluent_player/integrations filter."
---

# Build a Custom Integration

An **integration** is a third-party service FluentPlayer stores credentials for and talks to — hosted video, object storage, a transcoder. It is the base class behind all six of FluentPlayer Pro's hosted-streaming providers: `BunnyCDNStreamIntegration`, `BunnyCDNStorageIntegration`, `CloudflareStreamIntegration`, `GumletIntegration`, `MuxIntegration`, and `R2Integration` **(Pro)** — every one of them a subclass of `app/Integrations/AbstractIntegration.php:9`.

You register one with the `fluent_player/integrations` filter (`app/Services/IntegrationService.php:41`).

::: danger This is not the email-provider contract
`AbstractIntegration` and `AbstractEmailProvider` have **different abstract sets**. Renaming the parent class on an email-provider skeleton is a fatal error, because PHP will not instantiate a class with an unimplemented abstract method.

| | `AbstractEmailProvider` | `AbstractIntegration` |
|---|---|---|
| Abstract | `validateSettings`, `sanitizeSettings`, `getSettingsFields`, `subscribe`, `isConfigured` | `validateSettings`, `getSettingsFields`, **`testConnection`** |
| No equivalent of | — | `subscribe()`, `isConfigured()`, `sanitizeSettings()` |
| Registered with | an object instance | a **class-name string** |
| `enabled` stored as | boolean | the string `'yes'` / `'no'` |
| Option key | `fluent_player_email_providers` | `fluent_player_integrations_settings` |
| Admin location | Settings → Integrations | Settings → Storage |

There is **no `sanitizeSettings()` hook on `AbstractIntegration`** — whatever the REST layer hands you is what gets validated and stored. Sanitize inside `validateSettings()` is not an option either (its return value is discarded unless it is a `\WP_Error`); sanitize defensively wherever you *read* the settings.
:::

## Prerequisites

- FluentPlayer installed and active. Nothing here requires Pro.
- PHP 7.4+ (FluentPlayer's floor).
- As with email providers, do **not** depend on `FluentPlayer\Framework\*` — those are WPFluent internals rewritten per build by the namespace-prefixer. Use WP core helpers plus `FluentPlayer\App\Integrations\AbstractIntegration`.

## 1. The contract

Source: `app/Integrations/AbstractIntegration.php`.

### Abstract — you must implement all three

| Method | Line | Returns | Purpose |
|---|---|---|---|
| `validateSettings($settings)` | `:215` | `bool\|\WP_Error` | Return `\WP_Error` to block the save. |
| `getSettingsFields()` | `:221` | `array` | Indexed list of field descriptors, each carrying its own `key`. |
| `testConnection($settings = null)` | `:228` | `bool\|\WP_Error` | Reach the service. Called on save *and* from the "Test Connection" button. `$settings` is `null` when the button is not supplying an unsaved draft — fall back to `getSettings()`. |

### Optional override

| Method | Line | Purpose |
|---|---|---|
| `handleAction($action, $data = [])` | `:236` | Provider-specific RPC. Base returns a `not_implemented` `\WP_Error`. Note the signature is **two** args — `AbstractEmailProvider::handleAction()` takes three. |
| `saveSettings($settings)` | `:141` | Override to run post-save work; call `parent::saveSettings()` first and bail on `is_wp_error()`. See **(Pro)** `CloudflareStreamIntegration.php:86-96`. |

### Concrete helpers you inherit

| Member | Line | Purpose |
|---|---|---|
| `INTEGRATIONS_SETTINGS_KEY` | `:44` | `'fluent_player_integrations_settings'` — the WP option holding all integrations as JSON. |
| `getIntegration()` / `getName()` / `getDescription()` / `getLogo()` | `:60` / `:69` / `:78` / `:87` | Identity accessors. |
| `getDefaultSettings()` | `:100` | Returns `$defaultSettings`. |
| `getSettingsWithDefaults()` | `:109` | `wp_parse_args(getSettings(), getDefaultSettings())`. This is what the REST list endpoint returns. |
| `getSettings()` | `:118` | This integration's slice of the option. **Per-instance cached** (`:120-122`, `:133`) — cleared on save. |
| `saveSettings($settings)` | `:141` | Normalize `enabled` → validate → test connection → persist. |
| `isEnabled()` | `:204` | `$settings['enabled'] === 'yes'`, strictly (`:207`). |

::: warning `enabled` is the string `'yes'` / `'no'`, not a boolean
`saveSettings()` normalizes it at `:146-148` with a strict `=== 'yes'` comparison, and `isEnabled()` compares strictly at `:207`. The admin UI writes it correctly for you: `resources/admin/composables/useProviderConfig.js:47` stores checkbox values as `'yes'` / `'no'` when the config source is `'standard'` (integrations) and as booleans otherwise (email providers).

Set `'enabled' => 'no'` in `$defaultSettings` and compare against `'yes'` in your own code — or use `isEnabled()`.
:::

### What `saveSettings()` actually does

`:141-182`, in order:

1. Read the whole option (`:144`).
2. Coerce `enabled` to `'yes'` / `'no'` (`:146-148`).
3. **If disabled:** delete this integration's slice entirely (`:150-153`), write the option, clear the instance cache, return `[]`. Validation and connection tests are skipped. Disabling therefore **discards the stored credentials** — the admin must re-enter them to re-enable.
4. **If enabled:** `validateSettings()` (`:163`) — bail on `\WP_Error`. Then `testConnection($settings)` (`:169`) — bail on `\WP_Error`. **A save cannot succeed while the service is unreachable.**
5. Store `$settings` verbatim under the integration key (`:175`), write, clear the cache, return the stored slice (`:181`).

Note step 5: the array written is the one you were *given*, not anything `validateSettings()` returned.

## 2. The integration class

```php
<?php

namespace MyPlugin\FluentPlayer;

use FluentPlayer\App\Integrations\AbstractIntegration;

class MyCdnIntegration extends AbstractIntegration
{
    protected $integration = 'my_cdn';
    protected $name        = 'My CDN';
    protected $description = 'Host and stream video from My CDN.';

    // Third-party integrations must use an absolute http(s) URL: getLogo()
    // (AbstractIntegration.php:87-94) resolves anything else against
    // FluentPlayer's own built asset directory, where your file does not exist.
    protected $logo = 'https://cdn.my-cdn.com/badge.svg';

    protected $defaultSettings = [
        'enabled'         => 'no',
        'api_key'         => '',
        'library_id'      => '',
        'use_signed_urls' => 'no',
        'signing_key'     => '',
    ];

    public function getSettingsFields()
    {
        return [
            [
                'key'          => 'setup_instructions',
                'type'         => 'setup_instructions',
                'label'        => __('Setup Instructions', 'my-plugin'),
                'instructions' => [
                    'title' => __('My CDN Setup Guide', 'my-plugin'),
                    'steps' => [
                        [
                            'title'   => __('Step 1: Create an API key', 'my-plugin'),
                            'content' => __('In the My CDN dashboard open Account → API Keys and create a key with Video Read/Write scope.', 'my-plugin'),
                            'type'    => 'text',
                            'link'    => [
                                'url'  => 'https://my-cdn.com/dashboard/api-keys',
                                'text' => __('Open API Keys', 'my-plugin'),
                            ],
                        ],
                        [
                            'title'   => __('Step 2: Copy your Library ID', 'my-plugin'),
                            'content' => __('Open the video library you want to use and copy the ID from the URL.', 'my-plugin'),
                            'type'    => 'text',
                        ],
                    ],
                ],
            ],
            [
                'key'         => 'enabled',
                'type'        => 'checkbox',
                'label'       => __('Enable My CDN', 'my-plugin'),
                'description' => __('Use My CDN for video hosting and streaming.', 'my-plugin'),
            ],
            [
                'key'         => 'api_key',
                'type'        => 'password',
                'label'       => __('API Key', 'my-plugin'),
                'required'    => true,
                'description' => __('From Account → API Keys in the My CDN dashboard.', 'my-plugin'),
                'placeholder' => __('Enter your API key', 'my-plugin'),
            ],
            [
                'key'         => 'library_id',
                'type'        => 'text',
                'label'       => __('Library ID', 'my-plugin'),
                'required'    => true,
                'placeholder' => __('e.g. 41827', 'my-plugin'),
            ],
            [
                'key'         => 'use_signed_urls',
                'type'        => 'checkbox',
                'label'       => __('Enable Signed URLs', 'my-plugin'),
                'description' => __('Mint short-lived playback tokens for private assets.', 'my-plugin'),
            ],
            [
                'key'         => 'signing_key',
                'type'        => 'password',
                'label'       => __('Signing Key', 'my-plugin'),
                'description' => __('Required when signed URLs are enabled.', 'my-plugin'),
                'depends_on'  => 'use_signed_urls',
            ],
        ];
    }

    public function validateSettings($settings)
    {
        // Not being turned on? Nothing to check.
        if (($settings['enabled'] ?? 'no') !== 'yes') {
            return true;
        }

        if (empty($settings['api_key'])) {
            return new \WP_Error(
                'my_cdn_missing_api_key',
                __('An API Key is required to enable My CDN.', 'my-plugin')
            );
        }

        if (empty($settings['library_id'])) {
            return new \WP_Error(
                'my_cdn_missing_library_id',
                __('A Library ID is required to enable My CDN.', 'my-plugin')
            );
        }

        if (($settings['use_signed_urls'] ?? 'no') === 'yes' && empty($settings['signing_key'])) {
            return new \WP_Error(
                'my_cdn_missing_signing_key',
                __('A Signing Key is required when signed URLs are enabled.', 'my-plugin')
            );
        }

        // Only a WP_Error is acted on; `true` just means "proceed".
        return true;
    }

    public function testConnection($settings = null)
    {
        $settings = $settings ?: $this->getSettings();

        if (($settings['enabled'] ?? 'no') !== 'yes') {
            return true;
        }

        $apiKey    = sanitize_text_field($settings['api_key'] ?? '');
        $libraryId = sanitize_text_field($settings['library_id'] ?? '');

        if (!$apiKey || !$libraryId) {
            return new \WP_Error(
                'my_cdn_missing_credentials',
                __('API Key and Library ID are required.', 'my-plugin')
            );
        }

        $response = wp_remote_get(
            'https://api.my-cdn.com/v1/libraries/' . rawurlencode($libraryId) . '/videos?limit=1',
            [
                'timeout' => 15,
                'headers' => ['Authorization' => 'Bearer ' . $apiKey],
            ]
        );

        if (is_wp_error($response)) {
            return new \WP_Error(
                'my_cdn_connection_failed',
                __('Could not reach My CDN. Please check your network and credentials.', 'my-plugin')
            );
        }

        $code = (int) wp_remote_retrieve_response_code($response);

        if ($code < 200 || $code > 299) {
            return new \WP_Error(
                'my_cdn_connection_failed',
                sprintf(
                    /* translators: %d: HTTP status code returned by My CDN */
                    __('My CDN returned HTTP %d. Check your API Key and Library ID.', 'my-plugin'),
                    $code
                )
            );
        }

        return true;
    }

    /**
     * Optional. Two args — NOT the three-arg AbstractEmailProvider signature.
     */
    public function handleAction($action, $data = [])
    {
        if ($action === 'libraries') {
            return $this->fetchLibraries();
        }

        return parent::handleAction($action, $data);
    }

    protected function fetchLibraries()
    {
        if (!$this->isEnabled()) {
            return new \WP_Error('my_cdn_disabled', __('My CDN is not enabled.', 'my-plugin'));
        }

        $settings = $this->getSettings();
        $response = wp_remote_get('https://api.my-cdn.com/v1/libraries', [
            'timeout' => 15,
            'headers' => ['Authorization' => 'Bearer ' . sanitize_text_field($settings['api_key'] ?? '')],
        ]);

        if (is_wp_error($response)) {
            return $response;
        }

        return json_decode(wp_remote_retrieve_body($response), true) ?: [];
    }
}
```

::: warning `testConnection()` runs on every save
Because `saveSettings()` calls it at `:169` and aborts the save on `\WP_Error`, a slow or flaky endpoint makes the settings page unsavable. Keep the request cheap (a `limit=1` list, not a full sync) and always pass an explicit `timeout`. Return `true` early when the integration is being saved in a disabled state.
:::

## 3. Register it

`fluent_player/integrations` maps **slug → fully-qualified class-name string**. `IntegrationService::getIntegration()` checks `class_exists()` (`:68`), then does `new $className()` with **no constructor arguments** (`:73`) and caches the instance statically (`:76`).

```php
add_filter('fluent_player/integrations', function ($integrations) {
    $integrations['my_cdn'] = \MyPlugin\FluentPlayer\MyCdnIntegration::class;
    return $integrations;
});
```

Requirements that follow from that:

- **Pass the class name, not an object.** `new MyCdnIntegration()` in the filter will fail `class_exists()`.
- **Your constructor must work with zero arguments.** Prefer not defining one at all.
- **Handle an empty incoming array.** Pro services call `apply_filters('fluent_player/integrations', [])` directly with an empty default to look up a single class (for example **(Pro)** `app/Services/MuxService.php:24`), so your callback must not assume the array already has entries.
- The key you use here must match your `$integration` property — `getSettings()` (`:118`) and `saveSettings()` (`:141`) index the option by `$this->integration`, while the REST routes and admin URL use the filter key.

::: tip `IntegrationService::register()` exists but has no dispatch point
`app/Services/IntegrationService.php:29` is a static registrar writing to `self::$integrations`, which starts empty (`:16`) and is never populated by free or Pro. There is no `register_integrations` action to call it from. The filter at `:41` is the working path.
:::

## 4. Field descriptors

Integration fields use the same descriptor shape as email-provider fields — an **indexed list**, each element carrying its own `key`. They are rendered by `resources/admin/modules/settings/components/ConfigFormFields.vue` via `StorageConfigPage.vue:179-187`.

Supported `type` values: `text`, `number`, `textarea`, `password`, `api_key`, `checkbox`, `switch`, `select`, `radio`, `checkbox_group`, `media_select`, `notice`, `setup_instructions`, `complex_array`, `array`. Anything unrecognised renders as a plain text input (`ConfigFormFields.vue:349-355`). Full descriptions are in the [email-provider guide](/extending/custom-email-provider#supported-type-values) — the renderer is shared.

Integration-specific notes:

- **`context` is not used here.** There is no second surface to filter for; every field shows on the config page.
- **`enabled` is rendered separately.** `ConfigFormFields.vue:20` excludes `key === 'enabled'` from the form body and `:83-94` renders a dedicated "Enable Integration" toggle instead. Declaring an `enabled` descriptor is still worthwhile — it documents the key and seeds `default` handling in `StorageConfigPage.vue:68-74`.
- **`setup_instructions` is hoisted.** `ConfigFormFields.vue:19` pulls those fields out and renders them as a "Setup Required" alert above the form (`:97-112`), opening a dialog with your `instructions` array. See **(Pro)** `GumletIntegration.php:74` for a full example.
- **`required` drives client-side validation** before save and before "Test Connection" (`useProviderConfig.js:85-92`). It is skipped entirely when `enabled` is off (`:78-81`).
- **`depends_on`** hides a field until its dependency is truthy (`ConfigFormFields.vue:35`, `:22-33`). It accepts a plain key string or a condition object (`{key, value}`, `{key, in: []}`, `{all: []}`, `{key, nonempty: true}`).

## 5. REST surface

Routes are registered in `app/Http/Routes/api.php:38-43` under the `fluent-player/v2` namespace, all behind `SettingsPolicy`:

| Method | Path | Controller | Returns |
|---|---|---|---|
| `GET` | `integrations` | `IntegrationController@getIntegrations` (`:18`) | `getSettingsWithDefaults()` for every registered integration. |
| `GET` | `integrations/fields` | `IntegrationController@getIntegrationFields` (`:126`) | `name` / `description` / `logo` / `fields` per integration, from `IntegrationService::getAllSettingsFields()` (`app/Services/IntegrationService.php:85`). |
| `POST` | `integrations/{integration}` | `IntegrationController@saveIntegrationSettings` (`:43`) | Runs `saveSettings()`; a `\WP_Error` becomes a 400 with your message. |
| `POST` | `integrations/{integration}/test-connection` | `IntegrationController@testConnection` (`:87`) | Runs `testConnection()` against the posted (possibly unsaved) settings. |

::: warning Credentials are returned to the admin UI
`GET integrations` returns every stored value including API keys and signing secrets. The `SettingsPolicy` gate is what protects them. Do not add a public route that echoes `getSettings()`.
:::

`handleAction()` has **no REST route in the free plugin** — nothing in `api.php` maps to `IntegrationService::handleAction()` (`app/Services/IntegrationService.php:144`). If your integration needs a browser-callable action, register your own route or AJAX endpoint and call `handleAction()` from it.

## 6. Verify

1. **Registered.** `IntegrationService::getIntegrations()` includes your key, and `IntegrationService::getIntegration('my_cdn')` returns an instance (not `null` — `null` means `class_exists()` failed at `:68`).
2. **Listed.** Open **Settings → Storage** (`resources/admin/modules/settings/index.vue:49`). Your integration appears with its name, description and logo.
3. **Config page.** Click it — the URL is `/settings/storage/my_cdn` (route `settings.storage.config`, `resources/admin/router/routes.js:94`). Your fields render; `setup_instructions` shows as the alert at the top; `depends_on` fields stay hidden until their dependency is on.
4. **Test Connection.** The button posts your current form values to `integrations/my_cdn/test-connection`. A `\WP_Error` surfaces as the failure toast with your message.
5. **Save.** Flip the enable toggle and save. Confirm `get_option('fluent_player_integrations_settings')` now contains `"my_cdn":{"enabled":"yes",…}` — with the string `"yes"`, not `true`.
6. **Disable and re-check.** Toggling off and saving **removes** the whole `my_cdn` slice (`AbstractIntegration.php:150-153`). Confirm that is the behavior you want before shipping.

## Reference

- Base class: `app/Integrations/AbstractIntegration.php:9`
- Registry: `app/Services/IntegrationService.php:10`, filter at `:41`
- Controller: `app/Http/Controllers/IntegrationController.php:11`
- Routes: `app/Http/Routes/api.php:38-43`
- Admin: `resources/admin/modules/settings/components/StorageConfigPage.vue`, `ConfigFormFields.vue`
- **(Pro)** subclasses to read: `app/Integrations/GumletIntegration.php:9`, `app/Integrations/CloudflareStreamIntegration.php:22`, `app/Integrations/MuxIntegration.php:9`, `app/Integrations/BunnyCDNStreamIntegration.php:9`, `app/Integrations/BunnyCDNStorageIntegration.php:9`, `app/Integrations/R2Integration.php:9` — all registered in `fluent-player-pro/app/Hooks/filters.php:19-27`
- [Free → Pro hook contract](/extending/free-pro-contract) — `fluent_player/integrations` is one of the 27 Pro-bound hooks
