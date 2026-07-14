---
title: "Action Hooks"
description: "FluentPlayer do_action lifecycle hooks — media save/delete, email collected, watch recorded, and provider registration."
---

# Action Hooks

Actions fire at points in the plugin lifecycle. They return nothing — you use them to run side effects (logging, syncing, enqueuing). Below are the highest-signal actions in the free build; see the [Hooks overview](/hooks/) to discover the rest.

## `fluent_player/after_save_media`

**Type:** action · **Source:** `app/Http/Controllers/MediaController.php:116` (also `:145`)

Fires after a media item is created or updated through the admin REST API.

| Arg | Type | Description |
|---|---|---|
| `$mediaId` | `int` | ID of the saved media post. |
| `$data` | `array` | The request payload used to save it. |

```php
add_action('fluent_player/after_save_media', function ($mediaId, $data) {
    error_log("FluentPlayer media {$mediaId} saved");
}, 10, 2);
```

## `fluent_player/email_collected`

**Type:** action · **Source:** `app/Hooks/Handlers/EmailCollectionHandler.php:92` (also `:122`)

Fires when a viewer submits the email-capture layer.

| Arg | Type | Description |
|---|---|---|
| `$data` | `array` | Submitted data (email and associated fields). |
| `$submission` | `mixed` | The stored `EmailCollection` record (or the existing record). |
| `$created` | `bool` | `true` if a new record was created, `false` if it already existed. |
| `$integrationResults` | `array` | Results from each email provider the submission was sent to. |

```php
add_action('fluent_player/email_collected', function ($data, $submission, $created, $results) {
    if ($created) {
        // first time this email was captured
    }
}, 10, 4);
```

## `fluent_player/watch_recorded`

**Type:** action · **Source:** `app/Services/Progression/ProgressionService.php:187`

Fires when a watch/progression event is recorded for a media item and user.

| Arg | Type | Description |
|---|---|---|
| `$mediaId` | `int` | The media being watched. |
| `$userId` | `int` | The viewing user (0 for guests). |
| `$payload` | `array` | Watch evidence — watched segments, coverage, and completion state. |

```php
add_action('fluent_player/watch_recorded', function ($mediaId, $userId, $payload) {
    // e.g. mark an LMS step complete when coverage crosses your threshold
}, 10, 3);
```

## `fluent_player/register_email_providers`

**Type:** action · **Source:** `app/Services/EmailProviderService.php:35`

Fires while the plugin builds its email-provider registry. Hook here to register a custom provider — see [Build a Custom Email Provider](/extending/custom-email-provider).

```php
add_action('fluent_player/register_email_providers', function () {
    // register your provider instance
});
```

## Other actions

Also available (see the grep tip on the [Hooks overview](/hooks/) for exact signatures in your version):
`before_save_media`, `before_delete_media`, `after_delete_media`, `before_render_media`, `email_collection_hooks`, `register_media_taxonomies`, `fluent_community_enqueue_block_assets`.
