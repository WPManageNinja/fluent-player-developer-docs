---
title: "YouTube Endpoints"
description: "FluentPlayer REST endpoint for YouTube channel info."
---

# YouTube Endpoints

**Prefix:** `youtube` · **Policy:** `SettingsPolicy` (requires `manage_options`) · **Controller:** `YouTubeController` · **Source:** `app/Http/Routes/api.php:55`

| Method | Path | Handler | Purpose |
|---|---|---|---|
| `GET` | `/channel-info` | `YouTubeController@getChannelInfo` | Fetch subscriber count for a YouTube channel. |

Admin-only — `SettingsPolicy` requires `manage_options` (`app/Http/Policies/SettingsPolicy.php:20`). See the [REST API overview](/rest-api/).

## `GET /channel-info`

| Param | Required | Notes |
|---|---|---|
| `channel_id` | **yes** | Sanitized with `Sanitizer::sanitizeTextField`. Empty → `400 {"success": false, "message": "Channel ID is required"}` (`app/Http/Controllers/YouTubeController.php:27-32`). Must match `/^[a-zA-Z0-9_-]+$/`, else `400 {"success": false, "message": "Invalid channel ID format"}` (`:35-40`). |

The controller fetches `https://www.youtube.com/channel/{channelId}?hl=en` server-side with a 15-second timeout and extracts the subscriber count from the page HTML (`:61-104`). There is no YouTube Data API key involved.

Success:

```json
{ "success": true, "subscriber_count": "12.3K" }
```

`subscriber_count` is the **formatted label as YouTube renders it** — it may carry a `K`/`M`/`B` suffix or thousands separators, so treat it as a display string, not a number (`:132-139`).

Failure — connection error, or the count could not be located in the HTML — returns `404` with the underlying message (`:48-51`):

```json
{ "success": false, "message": "Could not retrieve subscriber count" }
```
