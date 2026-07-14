---
title: "Build a Custom Email Provider"
description: "Deliver FluentPlayer email-capture submissions to a custom service by extending AbstractEmailProvider."
---

# Build a Custom Email Provider

FluentPlayer's email-capture layer sends submitted emails to one or more **providers**. The free build ships a FluentCRM provider; Pro adds Mailchimp and Webhook. You can register your own by extending `AbstractEmailProvider`.

The bundled reference implementation to read alongside this guide is `app/EmailProviders/FluentCRMProvider.php`.

## Prerequisites

- FluentPlayer installed and active.
- Your code in a small plugin or a `functions.php`-style snippet. Namespaces referenced here are `FluentPlayer\App\...`.

## 1. Extend the base class

`app/EmailProviders/AbstractEmailProvider.php` defines five **abstract methods you must implement**, plus properties describing the provider:

| Member | Kind | Purpose |
|---|---|---|
| `$provider`, `$name`, `$description`, `$logo` | properties | Identity shown in the UI. |
| `$defaultSettings` | property | Default settings array. |
| `validateSettings($settings)` | **abstract** | Validate admin-entered settings. |
| `sanitizeSettings($settings)` | **abstract** | Sanitize settings before save. |
| `getSettingsFields()` | **abstract** | The settings form schema shown in the admin. |
| `subscribe($email, $data, $settings)` | **abstract** | Deliver a captured email to your service. |
| `isConfigured($settings)` | **abstract** | Whether the provider has enough config to run. |

`getProvider()`, `getName()`, `getDescription()`, `getLogo()`, `getDefaultSettings()`, `handleAction()`, `validateField()`, and `verifyConnectionStatus()` are already implemented on the base class — override only if you need to.

```php
use FluentPlayer\App\EmailProviders\AbstractEmailProvider;

class MyServiceProvider extends AbstractEmailProvider
{
    protected $provider    = 'my_service';
    protected $name        = 'My Service';
    protected $description = 'Send captured emails to My Service.';

    public function getSettingsFields()
    {
        return [
            'api_key' => [
                'type'  => 'text',
                'label' => 'API Key',
            ],
        ];
    }

    public function validateSettings($settings)
    {
        if (empty($settings['api_key'])) {
            return new \WP_Error('invalid', 'API Key is required.');
        }
        return $settings;
    }

    public function sanitizeSettings($settings)
    {
        $settings['api_key'] = sanitize_text_field($settings['api_key'] ?? '');
        return $settings;
    }

    public function isConfigured($settings)
    {
        return !empty($settings['api_key']);
    }

    public function subscribe($email, $data, $settings)
    {
        return wp_remote_post('https://api.my-service.com/subscribers', [
            'headers' => ['Authorization' => 'Bearer ' . $settings['api_key']],
            'body'    => ['email' => $email],
        ]);
    }
}
```

::: warning
Confirm the exact method signatures against `app/EmailProviders/AbstractEmailProvider.php` in your installed version before shipping — an abstract method left unimplemented is a fatal error.
:::

## 2. Register the provider

Register your instance during provider registration. Both the action and the filter are documented in the [hooks reference](/hooks/actions#fluent-player-register-email-providers).

```php
add_action('fluent_player/register_email_providers', function () {
    // If the plugin exposes a registry accessor, add your provider to it here.
    // Otherwise, inject via the email_providers filter below.
});

add_filter('fluent_player/email_providers', function ($providers, $data, $settings) {
    $providers['my_service'] = new MyServiceProvider();
    return $providers;
}, 10, 3);
```

Read `app/Services/EmailProviderService.php` (where `fluent_player/register_email_providers` fires) to confirm which registration path your version expects.

## 3. Verify

1. In the admin, open **Settings → Integrations** — your provider should appear with the name and description you set.
2. Configure it (enter the API key) and save; `validateSettings` / `sanitizeSettings` run here.
3. Add an email-capture layer to a player and submit a test email.
4. Confirm `subscribe()` ran — check your service, and hook [`fluent_player/email_collected`](/hooks/actions#fluent-player-email-collected) to inspect the `$integrationResults`.

## Reference

- Base class: `app/EmailProviders/AbstractEmailProvider.php`
- Bundled implementation: `app/EmailProviders/FluentCRMProvider.php`
- Hooks: [`register_email_providers`](/hooks/actions), [`email_providers`](/hooks/email), [`email_collected`](/hooks/actions)
