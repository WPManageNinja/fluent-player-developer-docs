---
title: "Media Endpoints"
description: "FluentPlayer REST endpoints for managing media items and tags."
---

# Media Endpoints

**Prefix:** `media` · **Policy:** `MediaPolicy` (requires `manage_options`) · **Controller:** `MediaController` · **Source:** `app/Http/Routes/api.php:8`

All endpoints below require an authenticated admin request (WordPress REST nonce, see the [REST API overview](/rest-api/)). Paths are relative to the `media` prefix.

## Media items

| Method | Path | Controller method | Purpose |
|---|---|---|---|
| `GET` | `/` | `get` | List media items. |
| `GET` | `/metadata` | `getMetadata` | Metadata for the media list (counts, filters). |
| `GET` | `/search` | `search` | Search media. |
| `GET` | `{id}` | `find` | Fetch a single media item. |
| `POST` | `/` | `store` | Create a media item. |
| `PUT` | `{id}` | `update` | Update a media item. |
| `PUT` | `{id}/restore` | `restore` | Restore a trashed media item. |
| `DELETE` | `{id}` | `delete` | Trash a media item. |
| `DELETE` | `{id}/force` | `forceDelete` | Permanently delete a media item. |
| `POST` | `/do-bulk-action` | `handleBulkActions` | Run a bulk action over multiple media. |

## Preview

| Method | Path | Controller method | Purpose |
|---|---|---|---|
| `GET` | `/page-builder-preview` | `pageBuilderPreview` | Render a preview for a page builder. |
| `GET` | `/playlist-page-builder-preview` | `playlistPageBuilderPreview` | Render a playlist preview for a page builder. |

## Tags

| Method | Path | Controller method | Purpose |
|---|---|---|---|
| `GET` | `/tags` | `getTags` | List media tags. |
| `POST` | `/tags` | `createTag` | Create a tag. |
| `PUT` | `/tags` | `renameTag` | Rename a tag. |
| `DELETE` | `/tags` | `deleteTag` | Delete a tag. |

## Selected request/response shapes

### `GET /` — list media

Returns a paginated media collection (`Media::paginate($request)`). Pagination and filter params are read from the request.

```json
{
  "data": [ { "ID": 123, "post_title": "Intro", "settings": { } } ],
  "total": 42,
  "per_page": 15,
  "current_page": 1
}
```

### `POST /` — create media

Send the media payload as the request body. On success:

```json
{
  "success": true,
  "message": "Media Created",
  "media": { "ID": 124, "post_title": "New media" }
}
```

Firing this endpoint runs the [`fluent_player/after_save_media`](/hooks/actions#fluent-player-after-save-media) action.

### `PUT {id}` — update media

Same payload shape as create; targets the media `{id}` in the path. Returns the updated media object.

::: tip Regenerating this table
The method + path + handler rows are verified against `app/Http/Routes/api.php` via `npm run extract:routes`. For the remaining endpoints, read the matching method in `app/Http/Controllers/MediaController.php` to document its exact params and response.
:::
