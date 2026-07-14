---
name: fluentplayer-dev-code-to-docs
description: Orchestrator that keeps FluentPlayer DEVELOPER docs in lockstep with the plugin source. Use when updating dev docs for a new plugin release, or when the user says "sync dev docs", "what hooks/routes changed since <tag>", "document the new filter", "regenerate the hooks reference", or any request needing the plugin's hooks/routes/base-classes read before writing. Runs the hybrid extractors (hooks + routes), diffs the surface since a tag, flags new/changed/removed items, then routes to fluentplayer-hooks-reference / fluentplayer-rest-reference / fluentplayer-extension-guide.
---

# FluentPlayer Dev Code-to-Docs Orchestrator

Bridges two repos:

| Repo | Path | Purpose |
|---|---|---|
| **Plugin source** | `/Volumes/Projects/work/forms/wp-content/plugins/fluent-player` | WPFluent PHP (`app/`) + JS (`resources/`). **Read-only.** |
| **Dev docs** | `/Volumes/Projects/work/fluentplayer-developer-docs` | The VitePress developer site. Edits go here. |

The **hybrid** model: extract the *set* of hooks/routes from source (always correct), then curate each entry by hand (readable). Extraction guarantees coverage; curation gives meaning.

Pro adds hooks/routes not in this free tree — mark and verify Pro items separately.

---

## Workflow

### 0. Load the surface map FIRST
Read `.claude/plugin-memory/DEV-SURFACE.md` — the hook groups, route groups+policies, extension points, and JS API map. It scopes the run without rescanning everything.

### 1. Confirm scope
- **Full resync** ("sync dev docs to 1.2.0"): re-extract everything, diff against the last documented version.
- **Since a tag** ("what hooks changed since 1.0.9"): diff the extracted surface between the tag and HEAD.
- **Single item** ("document `fluent_player/email_export_columns`"): read that one call site + callers.

### 2. Extract the surface (the scripts to build under `bin/`)
These `bin/` scripts don't exist yet — create them on first real run (they're small), then reuse. Until then, run the grep fallbacks inline.

**Hooks** — `bin/extract-hooks.mjs` (fallback greps):
```bash
P=/Volumes/Projects/work/forms/wp-content/plugins/fluent-player
grep -rnE "do_action\(\s*['\"]fluent_player/[a-z0-9_/]+"  "$P/app" | sort -t: -k1     # actions, with file:line
grep -rnE "apply_filters\(\s*['\"]fluent_player/[a-z0-9_/]+" "$P/app" | sort -t: -k1  # filters, with file:line
```
For each: capture name, `file:line`, and the **accepted-args count** (count the args after the hook name in the call). Emit a markdown stub table per group (grouping from DEV-SURFACE §2).

**Routes** — `bin/extract-routes.mjs` (fallback): parse each `$router->prefix('X')->withPolicy('Y')->group(...)` block in `app/Http/Routes/{api,routes}.php`, and the `->get/post/put/delete('path', 'Controller@method')` lines inside. Emit method + path + controller@method + policy + `file:line` per group.

### 3. Diff since the last documented version
```bash
git -C "$P" fetch --tags --quiet
git -C "$P" tag --sort=-creatordate | head
```
Extract the surface at the previous tag (via `git -C "$P" show <tag>:app/...` or a worktree) and at HEAD, then diff the **name sets**:
- **New** hooks/routes → need new reference entries.
- **Removed** → mark deprecated/removed in the docs + changelog.
- **Changed arg count / path / policy** → update the entry; this is the highest-risk drift.

Report the three buckets explicitly.

### 4. Route to the specialist to write/curate
- New/changed **hooks** → `fluentplayer-hooks-reference`
- New/changed **routes** → `fluentplayer-rest-reference`
- New **base class / registry** → `fluentplayer-extension-guide` (and add it to `DEV-SURFACE.md` §4)
- Always load `fluentplayer-dev-doc-writer` (master) for voice/conventions.

Curate each stub: read the call site (hooks) or controller+policy (routes) to name args/params, write the description, add one runnable example. Never ship raw extractor output.

### 5. Update the changelog + memory
- Prepend a `changelog.md` entry (dev-facing): hooks/routes added, changed, removed for this version.
- Update `DEV-SURFACE.md` counts and any new/removed items.
- Run `npm run build`; fix dead links.

---

## Hard rules
- **The extractor defines the set; you write the meaning.** Never hand-maintain the hook/route *list* (it drifts); never ship the extractor's raw dump (it's unreadable).
- **Verify every arg/param/capability against source.** Wrong signatures are worse than missing pages — they break readers' code.
- **Never edit the plugin** (read-only). **Never commit/push** in either repo unless asked.
- **Mark Pro items**; verify against the Pro build or the user before claiming availability.
- **No secrets/nonces/customer data** in examples.

---

## Reporting format

```
## Dev docs sync summary

**Source:** /Volumes/Projects/work/forms/wp-content/plugins/fluent-player (<branch> @ <sha>)
**Range:** <tag>..HEAD

### Hooks
- + `fluent_player/<new>` (action|filter, N args) — page: hooks/<group>
- ~ `fluent_player/<changed>` — arg count 2→3 — updated hooks/<group>
- - `fluent_player/<removed>` — marked removed + changelog

### Routes
- + `POST <prefix>/<path>` (<Policy>) — page: rest-api/<group>
- ~ `GET <prefix>` — policy changed — updated

### Extension points
- <new base class / registry, if any> — guide: extending/<x>

### Deferred / open questions
- <e.g. namespace version to confirm; Pro-only items pending Pro build>
```

After the summary, update `changelog.md` and `DEV-SURFACE.md`, then stop (no commit).
