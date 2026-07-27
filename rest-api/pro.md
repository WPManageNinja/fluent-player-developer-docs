---
title: "Pro REST Surface"
description: "The 102 REST routes FluentPlayer Pro adds — storage providers, analytics, playlists, licensing, and the three unauthenticated routes."
---

# Pro REST Surface

FluentPlayer Pro registers **102 REST routes**: 99 inside **11 prefixed groups**, plus **3 unprefixed public routes** declared at the top level of the routes file. They sit on the same base namespace as free — `/wp-json/fluent-player/v2/`. Together with the [45 free routes](/rest-api/#free-route-groups-45-routes-9-groups) that is **147 routes** in total.

The 11 prefixes and their route counts: `bunny/stream` 10, `bunny/storage` 5, `r2` 6, `cloudflare-stream` 6, `mux` 26 (two groups), `gumlet` 9, `media` 6 (two groups), `settings/license` 3, `presets` 3, `analytics` 17, `playlist` 8.

::: tip `(root)` in `_generated/routes.json` is not a prefix
The extractor buckets the three unprefixed routes under a synthetic `(root)` key, which makes the file look like it has 12 prefixes. It has 11 — plus three routes that were never inside a `prefix()` group at all.
:::

All routes below come from Pro `app/Http/Routes/api.php`. The `Source` column is that file's line number.

::: danger Three of these routes have no policy — no capability is checked
They are declared outside any `withPolicy()` group, so **the router runs no authorization at all**. Anyone on the internet can reach them.

| Method | Path | Handler | Verification | Source |
|---|---|---|---|---|
| `GET` | `bunny/storage/stream` | `BunnyCDNStorageController@streamVideo` | None — public by design | `api.php:34` |
| `POST` | `cloudflare-stream/webhook` | `CloudflareStreamController@handleWebhook` | `Webhook-Signature` header | `api.php:57` |
| `POST` | `mux/webhook` | `MuxController@handleWebhook` | `Mux-Signature` header | `api.php:109` |

`bunny/storage/stream` is intentional — the source comment at `api.php:33` reads *"Public stream endpoint — no auth required; serves video to frontend visitors"*. It streams video bytes to ordinary site visitors, so it cannot require a capability.

The two webhooks are provider callbacks. They are not capability-gated because the caller is Cloudflare or Mux, not a WordPress user; their authenticity rests entirely on **signature verification inside the controller**, not on the router. If you fork or wrap either handler, that signature check is the only thing standing between the internet and your asset state.

Their URLs are hard-coded elsewhere in Pro so the provider dashboards can be configured: `app/Integrations/MuxIntegration.php:200` and `app/Services/CloudflareStreamService.php:350`.
:::

## Capability map

| Policy | Capability | Prefixes |
|---|---|---|
| `\FluentPlayer\App\Http\Policies\MediaPolicy` | `edit_others_posts` | `bunny/stream`, `bunny/storage`, `r2`, `cloudflare-stream`, `mux` (media ops), `gumlet`, `media` |
| `\FluentPlayer\App\Http\Policies\SettingsPolicy` | `manage_options` | `mux` (infrastructure), `settings/license` |
| `FluentPlayerPro\App\Http\Policies\AnalyticsPolicy` | `manage_options` | `analytics` |
| `FluentPlayerPro\App\Http\Policies\PlaylistPolicy` | `edit_others_posts` | `playlist` |
| `FluentPlayerPro\App\Http\Policies\PresetPolicy` | `manage_options` | `presets` (writes) |
| *(none)* | **no check** | the three public routes above |

Pro reuses the **free** `MediaPolicy` and `SettingsPolicy` classes by fully-qualified name, so a site that filters `fluent_player/authoring_capability` shifts every Pro `MediaPolicy` route at the same time. See [Authentication](/rest-api/#authentication).

::: warning The Mux capability split is a real trap
The `mux` prefix is registered **twice**, with two different policies:

- **Media operations** (assets, uploads, tracks, live-stream CRUD, delivery usage, captions) — `MediaPolicy`, so **`edit_others_posts`**. An Editor can create and delete Mux assets. Group at `api.php:60`.
- **Sensitive infrastructure** (signing keys, playback restrictions, live stream-key reset) — `SettingsPolicy`, so **`manage_options`**. Group at `api.php:97`.

The escalation is deliberate. The source comment at `api.php:93-96` explains it: signing keys sign playback tokens, a stream-key reset disrupts a live stream, and playback restrictions control who can play — *"These must NOT fall under the editor-level authoring capability that now gates the free MediaPolicy."*

Because both groups share the `mux/` prefix, you cannot infer the capability from the URL. `GET mux/live-streams` needs `edit_others_posts`; `POST mux/live-streams/{id}/reset-stream-key` needs `manage_options`.
:::

---

## Bunny Stream — `bunny/stream`

**Policy:** `MediaPolicy` · **Capability:** `edit_others_posts` · **Group:** `api.php:11` · **10 routes**

| Method | Path | Handler | Source |
|---|---|---|---|
| `GET` | `/libraries` | `BunnyCDNController@getLibraries` | `:12` |
| `GET` | `/videos` | `BunnyCDNController@getVideos` | `:13` |
| `POST` | `/videos` | `BunnyCDNController@createVideo` | `:14` |
| `POST` | `/videos/upload` | `BunnyCDNController@uploadVideo` | `:15` |
| `PUT` | `/videos/{id}` | `BunnyCDNController@updateVideo` | `:16` |
| `DELETE` | `/videos/{id}` | `BunnyCDNController@deleteVideo` | `:17` |
| `GET` | `/collections` | `BunnyCDNController@getCollections` | `:18` |
| `POST` | `/collections` | `BunnyCDNController@createCollection` | `:19` |
| `PUT` | `/collections/{id}` | `BunnyCDNController@updateCollection` | `:20` |
| `DELETE` | `/collections/{id}` | `BunnyCDNController@deleteCollection` | `:21` |

## Bunny Storage — `bunny/storage`

**Policy:** `MediaPolicy` · **Capability:** `edit_others_posts` · **Group:** `api.php:25` · **5 routes + 1 public**

| Method | Path | Handler | Source |
|---|---|---|---|
| `GET` | `/videos` | `BunnyCDNStorageController@listVideos` | `:26` |
| `POST` | `/videos/upload` | `BunnyCDNStorageController@uploadVideo` | `:27` |
| `DELETE` | `/videos/delete` | `BunnyCDNStorageController@deleteVideo` | `:28` |
| `GET` | `/video` | `BunnyCDNStorageController@getVideo` | `:29` |
| `POST` | `/directories` | `BunnyCDNStorageController@createDirectory` | `:30` |
| `GET` | `/stream` | `BunnyCDNStorageController@streamVideo` | `:34` — **PUBLIC, no policy** |

`bunny/storage/stream` is declared standalone at `api.php:34`, outside the group — that is why it inherits no policy.

## Cloudflare R2 — `r2`

**Policy:** `MediaPolicy` · **Capability:** `edit_others_posts` · **Group:** `api.php:37` · **6 routes**

Server-proxied upload plus browse/CRUD over existing objects.

| Method | Path | Handler | Source |
|---|---|---|---|
| `POST` | `/upload` | `R2Controller@uploadVideo` | `:38` |
| `GET` | `/objects` | `R2Controller@listObjects` | `:39` |
| `POST` | `/folder` | `R2Controller@createFolder` | `:40` |
| `POST` | `/folder/rename` | `R2Controller@renameFolder` | `:41` |
| `DELETE` | `/folder` | `R2Controller@deleteFolder` | `:42` |
| `DELETE` | `/object` | `R2Controller@deleteObject` | `:43` |

## Cloudflare Stream — `cloudflare-stream`

**Policy:** `MediaPolicy` · **Capability:** `edit_others_posts` · **Group:** `api.php:47` · **6 routes + 1 public**

Direct-creator upload, status poll, browse existing.

| Method | Path | Handler | Source |
|---|---|---|---|
| `POST` | `/uploads` | `CloudflareStreamController@createUpload` | `:48` |
| `POST` | `/upload` | `CloudflareStreamController@uploadFromWpMedia` | `:49` |
| `GET` | `/videos` | `CloudflareStreamController@listVideos` | `:50` |
| `GET` | `/videos/{id}` | `CloudflareStreamController@getVideoStatus` | `:51` |
| `POST` | `/videos/{id}/rename` | `CloudflareStreamController@renameVideo` | `:52` |
| `DELETE` | `/videos/{id}` | `CloudflareStreamController@deleteVideo` | `:53` |
| `POST` | `/webhook` | `CloudflareStreamController@handleWebhook` | `:57` — **PUBLIC, no policy** |

Note `POST /uploads` (plural) and `POST /upload` (singular) are different endpoints: the first creates a direct-creator upload URL, the second uploads an existing WordPress attachment server-side.

## Mux — media operations

**Policy:** `MediaPolicy` · **Capability:** `edit_others_posts` · **Group:** `api.php:60` · **18 routes**

| Method | Path | Handler | Source |
|---|---|---|---|
| `GET` | `/assets` | `MuxController@getAssets` | `:62` |
| `GET` | `/assets/{id}` | `MuxController@getAsset` | `:63` |
| `POST` | `/assets` | `MuxController@createAsset` | `:64` |
| `PUT` | `/assets/{id}` | `MuxController@updateAsset` | `:65` |
| `DELETE` | `/assets/{id}` | `MuxController@deleteAsset` | `:66` |
| `PUT` | `/assets/{id}/mp4-support` | `MuxController@updateMp4Support` | `:67` |
| `POST` | `/uploads` | `MuxController@createUpload` | `:70` |
| `POST` | `/uploads/from-attachment` | `MuxController@uploadFromAttachment` | `:72` |
| `GET` | `/uploads/{id}` | `MuxController@getUploadStatus` | `:73` |
| `POST` | `/assets/{id}/tracks` | `MuxController@createTrack` | `:76` |
| `DELETE` | `/assets/{assetId}/tracks/{trackId}` | `MuxController@deleteTrack` | `:77` |
| `POST` | `/assets/{assetId}/tracks/{trackId}/generate-subtitles` | `MuxController@generateSubtitles` | `:78` |
| `GET` | `/live-streams` | `MuxController@getLiveStreams` | `:81` |
| `POST` | `/live-streams` | `MuxController@createLiveStream` | `:82` |
| `GET` | `/live-streams/{id}` | `MuxController@getLiveStream` | `:83` |
| `DELETE` | `/live-streams/{id}` | `MuxController@deleteLiveStream` | `:84` |
| `GET` | `/delivery-usage` | `MuxController@getDeliveryUsage` | `:87` |
| `GET` | `/assets/{id}/captions` | `MuxController@getAssetCaptions` | `:90` |

## Mux — sensitive infrastructure

**Policy:** `SettingsPolicy` · **Capability:** `manage_options` · **Group:** `api.php:97` · **8 routes**

Same URL prefix, stricter gate. See the warning above.

| Method | Path | Handler | Source |
|---|---|---|---|
| `POST` | `/signing-keys/generate` | `MuxController@createAndStoreSigningKey` | `:98` |
| `GET` | `/signing-keys` | `MuxController@getSigningKeys` | `:99` |
| `POST` | `/signing-keys` | `MuxController@createSigningKey` | `:100` |
| `DELETE` | `/signing-keys/{id}` | `MuxController@deleteSigningKey` | `:101` |
| `POST` | `/live-streams/{id}/reset-stream-key` | `MuxController@resetStreamKey` | `:102` |
| `GET` | `/playback-restrictions` | `MuxController@getPlaybackRestrictions` | `:103` |
| `POST` | `/playback-restrictions` | `MuxController@createPlaybackRestriction` | `:104` |
| `DELETE` | `/playback-restrictions/{id}` | `MuxController@deletePlaybackRestriction` | `:105` |

## Mux — webhook

**Policy:** none · **1 route**

| Method | Path | Handler | Source |
|---|---|---|---|
| `POST` | `mux/webhook` | `MuxController@handleWebhook` | `:109` — **PUBLIC, no policy**, verified via `Mux-Signature` |

## Gumlet — `gumlet`

**Policy:** `MediaPolicy` · **Capability:** `edit_others_posts` · **Group:** `api.php:112` · **9 routes**

| Method | Path | Handler | Source |
|---|---|---|---|
| `GET` | `/assets` | `GumletController@getVideos` | `:114` |
| `GET` | `/assets/{id}` | `GumletController@getVideo` | `:115` |
| `GET` | `/assets/{id}/status` | `GumletController@getStatus` | `:116` |
| `POST` | `/upload` | `GumletController@createUpload` | `:117` |
| `POST` | `/assets/{id}/rename` | `GumletController@renameVideo` | `:118` |
| `DELETE` | `/assets/{id}` | `GumletController@deleteVideo` | `:119` |
| `POST` | `/live` | `GumletController@createLive` | `:122` |
| `GET` | `/live/{id}` | `GumletController@getLiveStatus` | `:123` |
| `DELETE` | `/live/{id}` | `GumletController@deleteLive` | `:124` |

## `media` prefix extensions

**Policy:** `MediaPolicy` · **Capability:** `edit_others_posts` · **6 routes**

Pro extends the free [`media`](/rest-api/media) prefix with two separate groups.

**Subtitles** — group at `api.php:128`, 5 routes:

| Method | Path | Handler | Source |
|---|---|---|---|
| `POST` | `/{id}/subtitles` | `SubtitleController@uploadSubtitle` | `:129` |
| `DELETE` | `/{id}/subtitles/{subtitleId}` | `SubtitleController@removeSubtitle` | `:130` |
| `GET` | `/{id}/youtube-captions` | `SubtitleController@getYouTubeCaptions` | `:131` |
| `POST` | `/{id}/youtube-captions` | `SubtitleController@importYouTubeCaptions` | `:132` |
| `POST` | `/{id}/youtube-storyboard` | `SubtitleController@generateYouTubeStoryboard` | `:133` |

**Timed content** — group at `api.php:145`, 1 route:

| Method | Path | Handler | Source |
|---|---|---|---|
| `PUT` | `/{id}/timed-content` | `TimedContentController@updateTimedContent` | `:146` |

Timed content — not interactive layers — is the Pro-only part of the overlay stack. All `layer/*` routes are free; see [Layers](/rest-api/layers).

## License — `settings/license`

**Policy:** `SettingsPolicy` · **Capability:** `manage_options` · **Group:** `api.php:136` · **3 routes**

| Method | Path | Handler | Source |
|---|---|---|---|
| `GET` | `/` | `LicenseController@getLicenseDetails` | `:139` |
| `POST` | `/` | `LicenseController@activateLicense` | `:140` |
| `DELETE` | `/` | `LicenseController@deactivateLicense` | `:141` |

## Presets — writes {#presets-writes}

**Policy:** `FluentPlayerPro\App\Http\Policies\PresetPolicy` · **Capability:** `manage_options` · **Group:** `api.php:149` · **3 routes**

| Method | Path | Handler | Source |
|---|---|---|---|
| `POST` | `/` | `PresetController@store` | `:150` |
| `PUT` | `/{slug}` | `PresetController@update` | `:151` |
| `DELETE` | `/{slug}` | `PresetController@delete` | `:152` |

These sit on the **same prefix as the free read routes but require a stricter capability** — `manage_options` here versus `edit_others_posts` for `GET`. See [Presets](/rest-api/presets).

## Analytics — `analytics` {#analytics}

**Policy:** `AnalyticsPolicy` · **Capability:** `manage_options` · **Group:** `api.php:156` · **17 routes**

Dashboard-level:

| Method | Path | Handler | Source |
|---|---|---|---|
| `GET` | `/stats` | `AnalyticsController@getStats` | `:158` |
| `GET` | `/top-videos` | `AnalyticsController@getTopVideos` | `:159` |
| `GET` | `/top-users` | `AnalyticsController@getTopUsers` | `:160` |
| `GET` | `/location-breakdown` | `AnalyticsController@getLocationBreakdown` | `:161` |
| `GET` | `/new-returning-viewers` | `AnalyticsController@getNewReturningViewers` | `:162` |
| `GET` | `/performance-over-time/{scope?}/{id?}` | `AnalyticsController@getPerformanceOverTime` | `:163` |
| `GET` | `/retention` | `AnalyticsController@getRetention` | `:164` |
| `GET` | `/devices` | `AnalyticsController@getDevices` | `:165` |

Per-video:

| Method | Path | Handler | Source |
|---|---|---|---|
| `GET` | `/video/{id}/stats` | `AnalyticsController@getVideoStats` | `:168` |
| `GET` | `/video/{id}/retention` | `AnalyticsController@getVideoRetention` | `:169` |
| `GET` | `/video/{id}/devices` | `AnalyticsController@getVideoDevices` | `:170` |
| `GET` | `/video/{id}/location-breakdown` | `AnalyticsController@getVideoLocationBreakdown` | `:171` |
| `GET` | `/video/{id}/top-users` | `AnalyticsController@getVideoTopViewers` | `:172` |

Per-user:

| Method | Path | Handler | Source |
|---|---|---|---|
| `GET` | `/user/{id}` | `AnalyticsController@getUser` | `:175` |
| `GET` | `/user/{id}/stats` | `AnalyticsController@getUserStats` | `:176` |
| `GET` | `/user/{id}/top-videos` | `AnalyticsController@getUserTopVideos` | `:177` |
| `GET` | `/user/{id}/retention` | `AnalyticsController@getUserRetention` | `:178` |

::: warning `{scope?}` and `{id?}` are optional — all three URL shapes are valid
`GET analytics/performance-over-time/{scope?}/{id?}` is the **only route in either plugin** that uses optional path parameters. Do not assume the segments are required.

The WPFluent route compiler strips the `?`, builds the usual named group, then wraps it in a **non-capturing optional group** — `fluent-player-dev/vendor/wpfluent/framework/src/WPFluent/Http/Route.php:862-863` and `:880-882` — and records `required = false` in the route args (`:884`). The framework ships only with the free plugin. All of these therefore match the same route:

```
GET /wp-json/fluent-player/v2/analytics/performance-over-time
GET /wp-json/fluent-player/v2/analytics/performance-over-time/video
GET /wp-json/fluent-player/v2/analytics/performance-over-time/video/12
```

Because the parameters are optional, `scope` and `id` may be absent from the request entirely — read them defensively.
:::

## Playlists — `playlist`

**Policy:** `PlaylistPolicy` · **Capability:** `edit_others_posts` · **Group:** `api.php:181` · **8 routes**

Playlists are authored content, so they use the same **editor-level** gate as media rather than `manage_options`. `PlaylistPolicy` calls `Helper::authoringCapability()` when the free build provides it, falling back to a hard-coded `edit_others_posts` for older free builds (Pro `app/Http/Policies/PlaylistPolicy.php:21-25`).

| Method | Path | Handler | Source |
|---|---|---|---|
| `GET` | `/` | `PlaylistController@get` | `:182` |
| `POST` | `/do-bulk-action` | `PlaylistController@handleBulkActions` | `:183` |
| `GET` | `/{id}` | `PlaylistController@find` | `:184` |
| `POST` | `/` | `PlaylistController@store` | `:185` |
| `PUT` | `/{id}` | `PlaylistController@update` | `:186` |
| `PUT` | `/{id}/restore` | `PlaylistController@restore` | `:187` |
| `DELETE` | `/{id}/force` | `PlaylistController@forceDelete` | `:188` |
| `DELETE` | `/{id}` | `PlaylistController@delete` | `:189` |

::: warning Unqualified handler strings are not a per-group feature
This group does chain `->namespace('FluentPlayerPro\App\Http\Controllers')` (`api.php:181`), but that is **redundant** and is not what makes `'PlaylistController@get'` resolve. Pro wraps the *entire* routes file in an ambient controller namespace before requiring it:

```php
// fluent-player-pro/app/Core/Application.php:160-167
$router->namespace($this->bindings['__namespace__'] . '\App\Http\Controllers')
       ->group(function ($router) {
           require_once $this['path.http'] . 'Routes/api.php';
       });
```

So **every** Pro route may write its handler unqualified, whether or not its group sets a namespace — the Bunny Stream group at `api.php:11` sets none yet uses `'BunnyCDNController@getLibraries'` at `:12`. Most Pro groups nevertheless spell handlers out in full (`'FluentPlayerPro\App\Http\Controllers\MuxController@…'`), and that resolves to the same class: `Application::parseRestHandler()` **strips** the ambient namespace from the handler string if it is already there, then prepends it again (`fluent-player-dev/vendor/wpfluent/framework/src/WPFluent/Foundation/Concerns/FoundationTrait.php:91-97`), and `getControllerNamespace()` contributes nothing once the handler carries a namespace (`:433-440`).

Both styles appear in the same file and mean exactly the same thing. Neither tells you anything about the group's policy.
:::

---

::: warning Scope of verification
Everything on this page is documented **from the route declarations** in Pro `app/Http/Routes/api.php` — method, path, prefix, policy and handler string. Regenerate it with `npm run extract:routes`, which scans `fluent-player-dev` and `fluent-player-pro` by default and writes `_generated/routes.json`.

The existence and signature of each Pro **controller method** was not exhaustively re-verified, and no Pro request parameters or response shapes are documented here. Read the controller before depending on a payload.
:::
