---
title: "YouTube Endpoints"
description: "FluentPlayer REST endpoint for YouTube channel info."
---

# YouTube Endpoints

**Prefix:** `youtube` · **Policy:** `SettingsPolicy` (requires `manage_options`) · **Controller:** `YouTubeController` · **Source:** `app/Http/Routes/api.php:56`

| Method | Path | Handler | Purpose |
|---|---|---|---|
| `GET` | `/channel-info` | `YouTubeController@getChannelInfo` | Fetch channel info for the configured YouTube connection. |

Authenticated admin request — see the [REST API overview](/rest-api/).
