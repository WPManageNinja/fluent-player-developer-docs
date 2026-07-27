---
title: "Media Endpoints"
description: "FluentPlayer REST endpoints for managing media items and tags."
---

# Media Endpoints

**Prefix:** `media` · **Policy:** `MediaPolicy` (requires `edit_others_posts`) · **Controller:** `MediaController` · **Source:** `app/Http/Routes/api.php:8`

`MediaPolicy` gates media **authoring**, not site administration. It calls `current_user_can(Helper::authoringCapability())`, which defaults to `edit_others_posts` and is filterable via `fluent_player/authoring_capability` — see [Authentication](/rest-api/#authentication). The policy carries an explicit note in source:

> Media authoring (block editor). Editors/Authors, not admin-only.
>
> — `app/Http/Policies/MediaPolicy.php:15`

So an Editor, not only an administrator, can call every endpoint on this page. Requests still need the WordPress REST nonce (`X-WP-Nonce`). Paths below are relative to the `media` prefix — `GET /` is `GET /wp-json/fluent-player/v2/media/`.

## Media items

| Method | Path | Controller method | Purpose |
|---|---|---|---|
| `GET` | `/` | `get` | List media items (paginated). |
| `GET` | `/metadata` | `getMetadata` | Resolve oEmbed/classification metadata for a single URL. |
| `GET` | `/search` | `search` | Lightweight media search (id/title/status only). |
| `GET` | `{id}` | `find` | Fetch a single media item. |
| `POST` | `/` | `store` | Create a media item. |
| `PUT` | `{id}` | `update` | Update a media item. |
| `PUT` | `{id}/restore` | `restore` | Restore a trashed media item. |
| `DELETE` | `{id}` | `delete` | Trash a media item. |
| `DELETE` | `{id}/force` | `forceDelete` | Permanently delete a media item. |
| `POST` | `/do-bulk-action` | `handleBulkActions` | Run a bulk action over multiple media. |

::: warning `/metadata` is not "metadata for the media list"
Despite the name, `GET /metadata` does **not** return counts or filters for the list view. It resolves a single external URL (oEmbed / local attachment / direct-file classification) during authoring. See [`GET /metadata`](#get-metadata).
:::

## Preview

| Method | Path | Controller method | Purpose |
|---|---|---|---|
| `GET` | `/page-builder-preview` | `pageBuilderPreview` | Rendered, self-contained player HTML for a media id. |
| `GET` | `/playlist-page-builder-preview` | `playlistPageBuilderPreview` | Rendered playlist HTML for a playlist id. **Requires Pro.** |

::: danger `/playlist-page-builder-preview` fails silently without Pro
The playlist block lives in Pro. Without Pro this route still returns **HTTP 200** with `{"html": ""}` — an empty success, not an error. Detect it by checking for an empty `html` string, not by checking the status code. Source: `app/Http/Controllers/MediaController.php:69-73` (docblock: *"The block lives in Pro; without Pro this is empty."*) and `:81-83` (the unconditional `sendSuccess`).
:::

## Tags **(Pro)**

| Method | Path | Controller method | Purpose |
|---|---|---|---|
| `GET` | `/tags` | `getTags` | List media tags. |
| `POST` | `/tags` | `createTag` | Create a tag. |
| `PUT` | `/tags` | `renameTag` | Rename a tag. |
| `DELETE` | `/tags` | `deleteTag` | Delete a tag. |

These four routes **are registered by the free plugin** (`app/Http/Routes/api.php:15-18`), but free owns no tag implementation. Every handler funnels through `MediaController::dispatchMediaTagRequest()` (`app/Http/Controllers/MediaController.php:382-396`), which hands off through the `fluent_player/media_tags_request` filter. Pro implements that filter (Pro `app/Hooks/filters.php:55`) and dispatches to its `TagController`.

Without Pro active, all four return:

```
HTTP 403
{ "message": "Tags are a Pro feature" }
```

(`MediaController.php:420-423`.) An older Pro build that does not register the filter is still supported via a legacy direct call into `FluentPlayerPro\App\Http\Controllers\TagController` (`:398-418`).

## Pro extensions on the `media` prefix

FluentPlayer Pro registers six more routes under the same `media` prefix and the same `MediaPolicy` (`edit_others_posts`). They do not exist at all without Pro.

| Method | Path | Handler | Source |
|---|---|---|---|
| `POST` | `{id}/subtitles` | `SubtitleController@uploadSubtitle` | Pro `app/Http/Routes/api.php:129` |
| `DELETE` | `{id}/subtitles/{subtitleId}` | `SubtitleController@removeSubtitle` | Pro `app/Http/Routes/api.php:130` |
| `GET` | `{id}/youtube-captions` | `SubtitleController@getYouTubeCaptions` | Pro `app/Http/Routes/api.php:131` |
| `POST` | `{id}/youtube-captions` | `SubtitleController@importYouTubeCaptions` | Pro `app/Http/Routes/api.php:132` |
| `POST` | `{id}/youtube-storyboard` | `SubtitleController@generateYouTubeStoryboard` | Pro `app/Http/Routes/api.php:133` |
| `PUT` | `{id}/timed-content` | `TimedContentController@updateTimedContent` | Pro `app/Http/Routes/api.php:146` |

The subtitle routes form one group (Pro `api.php:128`); timed content is a separate group (Pro `api.php:145`). See [Pro REST surface](/rest-api/pro#media-prefix-extensions).

## Request/response shapes

### `GET /` — list media

Returns a `LengthAwarePaginator` produced by `Media::paginate($request)` (`app/Models/Media.php:389-416`), which delegates to `MediaService::paginate()`.

**Query parameters** — all optional:

| Param | Type | Notes |
|---|---|---|
| `per_page` | int | Page size. |
| `status` | string | Post status filter. |
| `orderby` | string | Column to sort by. |
| `order` | string | `ASC` / `DESC`. |
| `query` | string | Free-text search. |
| `tag` | string | Single tag; folded into `tags` when `tags` is empty. |
| `tags[]` | array | Multiple tags. |
| `provider` | string | Provider filter (`youtube`, `wordpress`, `bunny`, …). |
| `media_type` | string | `video` / `audio`. |
| `with_settings` | bool | **Defaults to `true`.** Parsed with `filter_var(…, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE)`, falling back to a plain cast when that returns `null`. When falsy, items come back without `settings` / `tags`. |

**Response** — the paginator's `toArray()` emits **13 keys**, not 4 (`vendor/wpfluent/framework/src/WPFluent/Pagination/LengthAwarePaginator.php:166-183`):

```json
{
  "current_page": 1,
  "data": [
    { "ID": 123, "post_title": "Intro", "settings": {}, "tags": [] }
  ],
  "first_page_url": "…?page=1",
  "from": 1,
  "last_page": 3,
  "last_page_url": "…?page=3",
  "links": [],
  "next_page_url": "…?page=2",
  "path": "…",
  "per_page": 15,
  "prev_page_url": null,
  "to": 15,
  "total": 42
}
```

Do not assume only `data` / `total` / `per_page` / `current_page` exist — `links`, `path`, `from`, `to` and the four `*_page_url` keys are always present.

### `GET /search` — lightweight search

`Media::search($request->get())` (`app/Models/Media.php:418-445`). Selects only `ID`, `post_title`, `post_status`, `post_date`, and excludes `auto-draft`.

| Param | Type | Notes |
|---|---|---|
| `q` | string | LIKE match against `post_title`, `ID`, or `post_status`. |
| `medias` | array \| JSON string | Restrict to specific media IDs; a JSON string is decoded. |
| `offset` | int | |
| `limit` | int | |
| `status` | string | |
| `order_by` | string | Uppercased; anything other than `ASC` / `DESC` falls back to `DESC`. |

### `GET /metadata` — resolve a URL {#get-metadata}

`MediaController::getMetadata()` (`app/Http/Controllers/MediaController.php:482-561`).

| Param | Required | Notes |
|---|---|---|
| `url` | **yes** | Missing/empty → `400 {"message": "URL is required"}` (`:484-487`). Rejected by `esc_url_raw()` → `400 {"message": "Invalid URL"}` (`:488-491`). |

YouTube variants are normalized before lookup (`:492-494`): `m.youtube.com` and `music.youtube.com` become `www.youtube.com`, and `/live/<id>` / `/shorts/<id>` become `/watch?v=<id>`.

Resolution order: WordPress oEmbed (with discovery disabled) → a YouTube fallback built from the extracted video id → local-attachment lookup for same-site upload URLs → local classification for any other playable URL. Arbitrary hosts are **never** fetched, keeping the SSRF surface at zero (`:523-524`).

```json
{
  "success": true,
  "metaData": {
    "url": "https://www.youtube.com/watch?v=abc123",
    "title": "Intro",
    "thumbnail_url": "https://i.ytimg.com/…",
    "provider_name": "YouTube",
    "type": "video"
  }
}
```

Unresolvable → `404 {"message": "Could not fetch metadata for this URL"}` (`:560`).

### `GET /page-builder-preview` — rendered player HTML

| Param | Required | Notes |
|---|---|---|
| `media_id` | **yes** | Cast with `(int)`; falsy → `400 {"message": "A media id is required."}` (`MediaController.php:57-60`). |

Returns `{"html": "<self-contained player markup>"}`. The markup is self-contained because a REST response never prints the enqueued/localized player scripts (`:62-66`).

### `GET /playlist-page-builder-preview` — rendered playlist HTML **(Pro)**

| Param | Required | Notes |
|---|---|---|
| `playlist_id` | **yes** | Cast with `(int)`; falsy → `400 {"message": "A playlist id is required."}` (`MediaController.php:76-79`). |

With a valid id but no Pro, returns `200 {"html": ""}` — see the warning above.

### `GET {id}` — fetch one media

`MediaController::find()` (`app/Http/Controllers/MediaController.php:86-108`).

```json
{
  "media": {
    "ID": 123,
    "post_title": "Intro",
    "settings": {},
    "view_url": "https://example.com/…",
    "post_content": "<!-- wp:fluent-player/media … -->",
    "tags": []
  }
}
```

Not found → `404 {"message": "Media not found"}` (`:91`).

The response is decorated beyond the stored row (`:95-102`):

- `view_url` — `get_permalink($id)`
- `post_content` — read with `get_post_field()`
- `tags` — term names from the `flp_media_tag` taxonomy, or `[]` when that taxonomy is not registered

::: warning `settings.src` may be a short-lived signed URL
Before responding, `settings` is passed through the `fluent_player/player_settings` filter (`:105`), which applies signed CDN / DRM URLs so the block-editor preview can play immediately. The `src` you get back is therefore **not necessarily the stored value**, and it can expire. Do not cache this response as if it were the persisted record.
:::

The same decoration runs on create and update via `prepareResponseMedia()` (`:355-370`), so those responses carry the same caveat.

### `POST /` — create media

Send the media payload as the request body; `settings` may be an array or a JSON string. Validation rules live in `prepareMedia()` (`MediaController.php:205-226`): `settings.preset_slug`, `settings.src` (must be a URL) and `settings.provider` are required, and `settings.attachment_id` is required when the provider is `wordpress`.

```json
{
  "success": true,
  "message": "Media Created",
  "media": { "ID": 124, "post_title": "New media" }
}
```

Validation failures return the validator's error bag; any other exception returns `{"message": "Failed to save media"}` (`:119-126`).

Creating fires the [`fluent_player/after_save_media`](/hooks/actions#fluent-player-after-save-media) action (`:116`).

### `PUT {id}` — update media

Same payload shape as create, targeting the media in the path.

```json
{
  "success": true,
  "message": "Media Updated",
  "media": { "ID": 123, "post_title": "Intro" }
}
```

`MediaController.php:147`. Three behaviours worth knowing:

1. **The route `{id}` overrides any `id` in the body.** The controller sets `$payload['id'] = absint($id)` before validation (`:140`), with an explicit note at `:137-139`: request payloads may already contain merged route params, and a custom client could send a conflicting body id.
2. **`fluent_player/after_save_media` fires on update too** (`:145`), not only on create — same hook, with the normalized payload as its second argument.
3. **Omitting `settings.post_status` preserves the current status** instead of defaulting to `draft`, so a visibility change made in the WordPress editor is not clobbered (`:287-298`).

Failures mirror create, with `{"message": "Failed to update media"}` (`:151-155`).

### `POST /do-bulk-action` — bulk operations

Handled by `MediaService::manageBulkActions()` (`app/Services/MediaService.php:382-425`).

| Param | Required | Notes |
|---|---|---|
| `action` | **yes** | One of `trash`, `restore`, `delete_permanently`, `change_status`, `add_tags`, `remove_tags`, `add_to_playlist`. |
| `media_ids` | **yes** | Array of media IDs. |
| `status` | only for `change_status` | One of `publish`, `private`, `draft` (`MediaService.php:373`). |

Error responses — all `WP_Error`, mapped to the status carried in their error data by `MediaController::handleBulkActions()` (`:464-474`):

| Status | Code | When |
|---|---|---|
| `422` | `fp_bulk_empty` | `media_ids` is empty after sanitization (`MediaService.php:387-389`). |
| `422` | `fp_bulk_too_many` | More than `BulkActionHelper::MAX` (**200**) ids — constant at `app/Helpers/BulkActionHelper.php:16`, check at `MediaService.php:391-398`. |
| `422` | `fp_bulk_invalid_status` | `change_status` with a status outside the whitelist (`:407-413`). |
| `422` | `fp_bulk_invalid_action` | Unrecognised `action` (`:424`). |
| `403` | `fp_bulk_pro_only` | `add_tags` / `remove_tags` / `add_to_playlist` with no Pro handler on the `fluent_player/media_bulk_action` filter (`:416-422`). |

Success shape — `BulkActionHelper::format()` (`app/Helpers/BulkActionHelper.php:90-104`):

```json
{
  "message": "…",
  "data": {
    "affected_ids": [1, 2],
    "affected_count": 2,
    "failed_ids": [3],
    "failed_count": 1
  }
}
```

Rows of the wrong post type, already-trashed rows (for `trash` / `change_status`) and non-trashed rows (for `restore`) are skipped rather than erroring — they land in `failed_ids`.

::: tip Regenerating these tables
Method + path + handler rows are verified against `app/Http/Routes/api.php` in both source repos via `npm run extract:routes`, which scans `fluent-player-dev` and `fluent-player-pro` by default.
:::
