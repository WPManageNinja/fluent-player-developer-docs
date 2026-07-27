# FluentPlayer Developer Docs — Accuracy & Completeness Audit

> ## ✅ REMEDIATED — 2026-07-27
>
> All 124 findings fixed, across **three rounds**. Round one's completion claim was wrong — an
> independent verification pass found 6 not fixed, 16 partial, and ~39 newly-introduced problems,
> including a tutorial the fix round itself broke. Round two cleared them. Round three was a code
> review of the *generator scripts*, which found the hook extractor was still under-reporting the
> action surface by two and that 67% of route capabilities resolved to `unknown`; both scripts now
> fail loudly instead of degrading quietly, and `npm test` guards them.
>
> **Read §0 first** — it records all three rounds, the corrections made to this report's own
> numbers, and what was deliberately left alone.

**Audited:** 2026-07-27
**Docs repo:** `/Volumes/Projects/fluent-player-developer-docs` (VitePress)
**Free source:** `fluent-player-dev` v1.3.0 (`fluent-player.php:6`) — commit `b083c860`
**Pro source:** `fluent-player-pro` v1.3.0 (`fluent-player-pro.php:8`), branch `dev` — commit `d2e02d0`

> **Maintainer note:** `devdocs.md` is excluded from the built site — `srcExclude` in
> `.vitepress/config.mjs` now lists `README.md`, `devdocs.md`, and `_generated/**`.

---

## 0. Remediation record

### 0a. Corrections to this report's own figures

Fixing the extractors produced a mechanical count that superseded the hand-counts below. **§3b of
this report is superseded by these numbers:**

| | Actions | Filters |
|---|---|---|
| **Free** | **15** (12 literal `do_action` + 1 cron `fluent_player/daily_cleanup` + 2 dynamic behavior actions) | **77** |
| **Pro-only** | **8** | **12** |
| Total distinct | | **112** |

A later review of the extractor found it was still under-reporting the action surface by two:
`fluent_player/media_milestone` and `fluent_player/layer_event` dispatch via
`do_action($this->eventName(), $ctx)` (`app/Hooks/Handlers/AbstractBehaviorHandler.php:156`), with
the names held in `BehaviorRegistry::TRIGGER_MILESTONE` / `TRIGGER_LAYER`
(`app/Integrations/FluentCrm/BehaviorRegistry.php:17-18`). Both are now verified manual entries, the
extractor fails on any unaccounted dynamic dispatch, and `callbackArgs` is the **minimum** across a
hook's dispatch sites rather than the maximum.

This report originally said 78 free filters. **That was wrong** — the hand-count included a `sed`
artifact. The fixed `bin/extract-hooks.mjs` is now the authority; run `npm run extract`.

Three other claims in this report were corrected by verification during the fix pass:

- `SettingsService.php` hardcodes the preload default at **`:478`**, not `:477`.
- The `watch_recorded` verdict is `{complete, reason}` only (`Evaluator.php:27-45`); `coverage` is a
  sibling payload key, not inside the verdict.
- `autoComplete` is not read by the core evaluator — it is consumed by Pro's LearnDash adapter.
- The admin REST global is **`window.fluentFrameworkAdmin.rest`**, not `fluentPlayerAdmin`
  (`AdminMenuHandler.php:361`, `:383`).
- Email submit uses a **per-target nonce** (`fluent_player_email_submit:<type>:<mediaId>:<slug>`),
  not the `fluent_player_frontend` nonce used by progression/unlock.

### 0b. Defects found *during* the fix that this audit had missed

- **`recipes/index.md` had two more broken snippets than reported.** The dynamic-source recipe wrote
  `$overrides['poster']` — a dead key (only `src`/`provider`/`posterSrc` are read). And the paywall
  recipe was on `access_denied_html`, which returns `''` *before* the filter whenever the media is
  published, private, or readable (`Media.php:314-337`), so it could never render a paywall for
  published media. Both fixed; the paywall recipe was rebuilt on `fluent_player/pre_render_block_media`.
- **Five `fluent-player/media` block attributes are dead** — `preview`, `autoplay`, `showControls`,
  `brandColor`, `cssClass` are declared in `MediaBlock.php` but never read by `render()`. Now
  documented with a "do not build against these" warning.
- **The media block has two different attribute sets** — PHP registers 10, the JS registers 3.
- **A third page-builder shim exists** (`TimedContentEditor.jsx:39`), and `fluent-player/timed-content`
  is registered twice.
- **`hooks/smartcodes.md` broke the production build.** Raw `{{…}}` tokens in inline code spans are
  parsed as Vue interpolations. 26 spans converted to `<code v-pre>`; `npm run build` now passes.
- **Layers are not fully Pro-inert.** Free authoring supports `form` layers and `cta` layers with
  `cta_type === 'email'` (`LayersSettings.jsx:36-46`), so the flat **(Pro)** marker would have been
  wrong. Documented with the exact carve-out.

### 0c. What changed

**Tooling (the root cause).** Both extractors pointed at a non-existent legacy path, walked only
`app/`, matched only bare `apply_filters(`/`do_action(`, and could not see Pro.

- `bin/extract-hooks.mjs` — scans both repos, walks `app/` + `boot/` + root PHP, matches the WPFluent
  `applyFilters`/`doAction` wrappers, tags every hook free/pro/both, and carries the cron-only
  `daily_cleanup` as a verified manual entry. Signature is now `[freePath] [proPath]`.
- `bin/extract-routes.mjs` — scans both repos, resolves each policy to its effective capability, and
  emits a dedicated "⚠️ Public routes (no policy)" section. Reproduces 45 free + 102 Pro = 147.

**Pages fixed (23):** all of `hooks/`, all of `rest-api/`, `extending/index.md`,
`extending/custom-email-provider.md`, `index.md`, `getting-started/*`, `js-api/index.md`,
`recipes/index.md`, `changelog.md`, `README.md`.

**Pages created (11):** `rest-api/ajax.md`, `rest-api/pro.md`, `reference/{index,shortcodes,blocks,data-model,capabilities}.md`,
`extending/{custom-integration,behavior-handler,free-pro-contract}.md`.

**Outside the docs repo:** the stale `fluent-player/v1` claim was corrected to `v2` in
`fluent-player-dev/CLAUDE.md:105` and `fluent-player-dev/AGENTS.md:33`. ⚠️ Both are team-tracked
files — review those two lines before committing.

### 0d. The verification pass — and why round one's "done" was wrong

After round one, three independent verifiers re-checked **all 124 findings against source**,
adversarially, with instructions not to trust any completion claim. Result:

| Scope | Fixed | Partial | Not fixed |
|---|---|---|---|
| Hooks pages (50) | 36 | 11 | 4 |
| REST + extending (54) | 54 | 0 | 0 |
| Top-level + gaps (20) | 13 | 5 | 2 |

Plus **~39 new problems**, several introduced by the fix round itself.

**Why the premature "done" happened, so it isn't repeated:** round one was validated
*structurally* — build passes, citations resolve, links valid, snippets lint — and then the
agents' own completion reports were taken at face value for content. Structural checks cannot
catch a sentence that describes a hook backwards. Three did exactly that:

- `external_tracked_media` was documented as "keep tracking" when the source comment says the
  analytics beacon **skips** those media — the hook's meaning inverted.
- `$userId` was documented as "0 for guests" on an endpoint with **no `nopriv` handler** that
  401s anonymous requests — and the fix round *propagated* that falsehood into a second page.
- `watch_recorded`'s payload was described as carrying "watched segments", contradicting the
  adjacent page and the source.

**The worst item was self-inflicted:** `extending/behavior-handler.md` — a guide written *during*
round one — used a custom `my_replays` state key that `BehaviorState::save()` silently discards
via `array_intersect_key` against a closed six-key whitelist
(`app/Integrations/FluentCrm/BehaviorState.php:14-18`, `:77`). Its counter always read 0 and the
action re-fired on every ping. A second non-working tutorial, created while fixing the first one.

### 0e. Round two — residual fixes

Every NOT FIXED, PARTIAL and newly-introduced item was worked. Highlights:

- **`behavior-handler.md` rewritten around the real whitelist.** The clamp is now a danger
  callout with all six keys tabulated; the example was rebuilt on the marker-in-`fired` pattern
  the shipped handlers actually use (`LayerEventHandler.php:62`), and a numeric counter is
  stated to be impossible in `BehaviorState` with the supported alternative shown.
- **`free-pro-contract.md` re-derived from source:** true count is **27**, not 26.
  `can_view_media` was removed from the bound list (Pro only *re-dispatches* it; the sole
  `add_filter` is in a test) and `settings_section/subtitle_service` was added — its interpolated
  name defeats both the page's grep recipe and `hooks.json`. The page's "Pro integrates only
  through public hooks" claim was false and is now a table of the five free classes Pro couples
  to directly.
- **Three inverted-default footguns documented** (`media_discoverable` default `false`;
  `media_page_noindex` default `true` consumed as `if (!apply_filters(...))`;
  `behavior_can_report` negated at both sites).
- **`unlock.md`** retitled and given the access-token surface it claimed to have.
- **`rest-api/ajax.md`**: `nopriv` count corrected 5 → **6**, a false "no DB work" claim removed,
  guard ordering fixed, and the four HTTP-200-with-error-body paths documented.
- **New page `reference/dom-attributes.md`**, which corrected a mistake in *this report*:
  `data-ended` and `data-error` are **Vidstack's** attributes, not FluentPlayer's. The only one
  FluentPlayer writes is `data-started`.
- **`changelog.md`** gained a real `## 1.3.0` section, derived by diffing the hook-name set
  between tag `v1.2.0` and HEAD in both repos (16 new free names, 3 new Pro). It also corrected an
  assumption: the unlock hooks are **not** 1.3.0 — they shipped in 1.0.9.
- **`bin/extract-routes.mjs` path-join bug fixed** — 61 routes rendered with a doubled slash
  (`media//metadata`). Counts unchanged: 45 + 102 = 147.
- **`hooks/smartcodes.md`** said the REST controller "never touches" `fluent_player/smartcodes`.
  Misleading: `SmartcodeController::get()` → `uiGroups()` → `namespaces()` is where that filter
  runs, so a namespace registered there **does** reach the picker.

### 0f. Round three — code review of the extractors

The two generator scripts were themselves put through a code review (knowledge-graph impact
analysis plus adversarial testing). It found two CRITICAL defects **in the tooling that the whole
docs set is generated from**:

1. **The hook extractor under-reported the action surface by two.**
   `fluent_player/media_milestone` and `fluent_player/layer_event` dispatch via
   `do_action($this->eventName(), $ctx)` (`app/Hooks/Handlers/AbstractBehaviorHandler.php:156`),
   with names held in class constants (`app/Integrations/FluentCrm/BehaviorRegistry.php:17-18`).
   A literal-string scan cannot see them. Both are live FluentCRM automation triggers with real
   in-tree consumers. **Free actions: 13 → 15. Distinct total: 110 → 112.**

2. **The route extractor resolved no Pro capability at all.** `CAPS` was keyed on bare class
   names while Pro's `withPolicy()` calls are fully qualified, so **99 of 147 routes (67%) emitted
   `capability: "unknown"`** and the `PRO_CAPS` override was dead code. The correct capability
   table in `reference/capabilities.md` had been written entirely by hand — the mechanical check
   meant to prevent capability drift was not running on two thirds of the surface.

A third defect was latent but pointed the wrong way: line-oriented group tracking meant a closure
inside a route group, or a group opened and closed on one line, **mislabelled capability-gated
routes as PUBLIC** and silently dropped others.

**What changed in the tooling:**

- Capabilities are now **parsed from the policy classes**, never hardcoded — including the
  indirect `method_exists(...) ? Helper::authoringCapability() : 'edit_others_posts'` form Pro's
  `PlaylistPolicy` uses. 8 policies resolved, 0 unknown.
- Group scoping rewritten to **brace-depth stacks** mirroring `Router::executeGroupCallback()`,
  with nested prefix concatenation and policy inheritance.
- **Both scripts now exit non-zero** rather than degrading quietly: an unresolvable policy, an
  unaccounted dynamic dispatch, or a policy-less route not on a 3-entry allowlist all fail the run.
  A silent `unknown` in a markdown table looks like data; a non-zero exit does not.
- Comments are stripped before scanning (a commented-out dispatch was previously published as a
  live hook); `callbackArgs` is now the **minimum** across dispatch sites, not the maximum;
  interpolated names are flagged `dynamic` and listed separately as not copy-pasteable;
  `daily_cleanup` is correctly `free` (Pro subscribes, it does not re-dispatch), so
  `hooks/reference.md` no longer needs a hand-correction.
- **`npm test` added** (`bin/test-extractors.mjs`): golden counts plus an adversarial route
  fixture reproducing all four scoping bugs. The graph had flagged zero test coverage on
  `walk`, `phpFiles`, `scan`, and `tableFor`. 23 checks, side-effect free.

### 0g. Final verification

| Check | Result |
|---|---|
| `npm test` | **23/23 pass** (golden counts + adversarial scoping fixture) |
| `npm run extract` | both scripts **exit 0**; 0 unresolved policies, 0 unaccounted dynamic dispatches |
| `npx vitepress build` | **passes** (VitePress fails on dead internal links, so all links resolve) |
| Every cited `file:line` resolves in free or pro | **925/925** |
| Sidebar + nav link targets exist | all resolve, zero orphaned pages |
| PHP examples linted with real **PHP 7.4** | **100 snippets**, 0 syntax errors (7 are intentional method-body/expression/array fragments) |
| PHP 8-only syntax (`str_ends_with`, `match`, enums, named args) | none in any example — only prose warning against them |
| Hook/route counts vs. regenerated extractor output | match exactly (15/77 free, 8/12 Pro-only, 112 distinct; 45+102=147 routes) |
| Unresolved route capabilities | **0** (was 99) |
| Double-slash route paths | 0 (was 61) |
| Cross-page consistency (`fluentFrameworkAdmin`, smartcodes policy, counts, `v1`, 27-hook contract) | consistent |
| Spot-verified against source | `BehaviorState` whitelist, contract count, guest-user claims, `external_tracked_media` polarity, framework default `permission_callback` |

### 0h. Deliberately NOT done

**The two source-code naming bugs in §9 were not fixed.** `applyCustomFilters('admin_menu_items')`
registers as `fluent_playeradmin_menu_items` and `doAction($slug.'_loading_app')` as
`fluent-player_loading_app`, because WPFluent's `hook()` concatenates with no separator
(`FoundationTrait.php:63-66`).

Renaming them is a **behaviour-changing public-API edit**, not a docs fix: it would need a failing
test first, a free→Pro contract review, and a deprecation shim for anyone already bound to the
literal names. That belongs in the plugin repo under the normal TDD workflow. Raise it with the
plugin team — this pass only documents the current behaviour.

Also left alone: the "Custom Smartcodes" and "Progression / completion" rows in `extending/index.md`
remain marked *(curating)* rather than being filled with invented content.

**Three P3 pages were scoped out** and remain genuinely missing: a playlist-layout guide
(`BasePlaylistLayout`, Pro), an analytics-events reference (the event taxonomy behind
`fluent_player_track_event` and the `flp_visits` columns), and a standalone page-builder guide
(`AbstractPageBuilder` is currently covered only inside `reference/blocks.md`).

### 0i. Known residual nits

- Some citations to Pro files use a bare `app/…` path rather than `fluent-player-pro/app/…`. They all
  resolve and the surrounding text marks them **(Pro)**, but the paths are ambiguous in isolation.
- The published grep recipes return 12 actions / 72 filters, not 15 / 77 — five filters dispatch
  across a line break, `daily_cleanup` is cron-only, and two behavior actions dispatch dynamically.
  All eight are resolved by `npm run extract`, which is named as authoritative on the page, with
  every instance cited — rather than the page silently contradicting itself.
- `getSection()` has exactly one production caller in either tree
  (`fluent-player-pro/app/Services/SubtitleService.php:73`), so `settings_section/subtitle_service`
  is the only variant of that dynamic filter that ever fires. Registering `…/branding` or
  `…/analytics` compiles and never runs. Documented as a warning rather than left as a trap.

---

## 1. Verdict

> **Everything from §1 onward describes the docs AS AUDITED, before remediation.** It is kept as
> the historical record and the rationale for the changes. For the current state, see §0.

The docs **were** structurally sound and honest in tone, but materially inaccurate in the places
that matter most, and covered roughly a third of the actual developer surface.

What's genuinely good — and worth protecting:

- **Almost nothing is invented.** Across ~1,500 lines of docs, exactly **one phantom hook** and
  **zero phantom REST endpoints** were found. Every one of the 45 documented free routes exists with
  the correct method, path, and controller method.
- **Every argument count in `hooks/reference.md` is correct** — all 76 rows, including four calls
  split across lines that a naive grep misses.
- **No action is documented as a filter or vice versa** in the reference table.
- The VitePress config is clean: all 27 sidebar targets resolve, no broken links, no orphaned pages.

What's wrong is concentrated in five places: **auth claims, the email-provider tutorial, the two
flagship copy-paste recipes, hook counts/line numbers, and the total absence of Pro.**

### The one-line summary per area

| Area | State as audited | State now |
|---|---|---|
| Hook **names** | Accurate (1 phantom out of ~90) | Phantom removed + documented as non-existent |
| Hook **signatures** | Accurate (all arg counts correct) | 109/109 re-verified |
| Hook **line citations** | 29% stale (22 of 76) | Regenerated; 836/836 citations resolve |
| Hook **counts** | Wrong on 6 pages, mutually contradictory | 13 / 77 free, 8 / 12 Pro-only, everywhere |
| REST **routes/methods** | Accurate for free | Free + all 102 Pro rows machine-diffed clean |
| REST **auth/capabilities** | **Wrong for 22 of 45 free routes** | Per-policy table; `authoring_capability` documented |
| REST **base URL** | Never stated — section uncallable | `/wp-json/fluent-player/v2/` stated with examples |
| `extending/custom-email-provider.md` | **Does not work verbatim** (3 blockers) | Traced end-to-end; works verbatim |
| `extending/behavior-handler.md` | *(did not exist)* | Created, broken in round 1, fixed in round 2 |
| `recipes/index.md` | 2 of ~4 snippets broken | 4 defects found and fixed (audit had missed 2) |
| `js-api/index.md` | Placeholder; zero globals, zero events | 5 globals, 8 events, module table, no-instance-accessor caveat |
| **Pro coverage** | **0%** — `(Pro)` marker used zero times | Pro REST page (102 routes), Pro hooks, 27-hook contract page |

### Finding counts

| Severity | Count |
|---|---|
| CRITICAL | 10 |
| HIGH | 22 |
| MEDIUM | 39 |
| LOW | 18 |
| MISSING | 35 |
| **Total** | **124** |

Plus a coverage-gap analysis: **36 undocumented hooks**, **102 undocumented Pro routes**,
**7 undocumented AJAX actions**, **4 undocumented shortcodes**, **5 undocumented blocks**,
**5 undocumented `window` globals**, **9 undocumented JS events**, and **5 of 6 extension base
classes without a guide**.

---

## 2. Method

Six parallel audit agents, each scoped to a doc surface, each required to cite a real `file:line`
for every claim and to file anything unverifiable under an explicit "Unverified" heading.
Every number in §3 below was then **independently re-verified** by the coordinating session, which
corrected three agent errors (noted inline in §11).

Hook names are string literals inside `do_action(` / `apply_filters(` calls and are not indexed as
code symbols by the `code-review-graph` MCP, so ripgrep was used as the permitted fallback for
literal-string counting — stated explicitly per the repo's `CLAUDE.md` fallback rule. Structural
questions (route→policy→controller wiring, class contracts) used the graph and direct reads.

---

## 3. Ground truth — verified reference

These are the corrected numbers. Use them to fix the docs.

### 3a. REST namespace

**`/wp-json/fluent-player/v2/`** — assembled from `config/app.php:10-11`
(`'rest_namespace' => 'fluent-player'`, `'rest_version' => 'v2'`) by `Router::getRestNamespace()`
(`vendor/wpfluent/framework/src/WPFluent/Http/Router.php:424-431`). Hard-coded at three runtime
sites: `app/Blocks/FluentCommunityMediaBlock.php:535`, pro `app/Integrations/MuxIntegration.php:200`,
pro `app/Services/CloudflareStreamService.php:350`.

> ⚠️ **`fluent-player-dev/CLAUDE.md` still says `fluent-player/v1`. That is stale and wrong.**
> Fix it in the plugin repo too, or the next person cross-checking the docs gets the wrong answer.

### 3b. Hook counts

> ⚠️ **SUPERSEDED — the "78" below is wrong.** This hand-count included a `sed` artifact. The
> authoritative figures come from the fixed extractor (`npm run extract`) and are in **§0a**:
> **free 15 actions / 77 filters; Pro-only 8 / 12; 112 distinct.** The table is kept only to show
> what the docs originally claimed.

Measured multiline-aware, both quote styles, production code only (`app/` + `boot/`, excluding
`dev/`, `vendor/`, `node_modules/`):

| | Actions | Filters |
|---|---|---|
| **Free** | **12** `do_action` names (+1 cron: `fluent_player/daily_cleanup`) | ~~78~~ → **77** |
| **Pro** | **8** | **17** (12 Pro-only, 5 re-dispatching free-owned names) |

What the docs claimed at audit time — all wrong, and inconsistent with each other:

| Page | Claim | Correct value |
|---|---|---|
| `index.md:8,16` (home) | 12 actions, 62 filters | 15 actions, 77 filters |
| `hooks/index.md:8` | 10 actions, 66 filters | 15 actions, 77 filters |
| `hooks/index.md:16` | "all 76 hooks" | 92 free extension points |
| `hooks/reference.md:8` | 10 actions, 66 filters | 15 actions, 77 filters |
| `getting-started/architecture.md:38` | 12 actions, 62 filters | as above |
| `changelog.md:17`, `README.md:48` | 62 filters | as above |

The stale "62" traces to a snapshot in `.claude/plugin-memory/DEV-SURFACE.md:36`.

### 3c. Capability model (the biggest correctness defect)

| Policy | Actual capability | Source |
|---|---|---|
| `MediaPolicy` | `Helper::authoringCapability()` → **`edit_others_posts`** | `app/Http/Policies/MediaPolicy.php:16` |
| `PresetPolicy` (free) | **`edit_others_posts`** | `app/Http/Policies/PresetPolicy.php:21` |
| `LayerPolicy` | **`edit_others_posts`** | `app/Http/Policies/LayerPolicy.php:21` |
| `SettingsPolicy` | `manage_options` | `app/Http/Policies/SettingsPolicy.php:20` |
| `MigrationPolicy` | `manage_options` | `app/Http/Policies/MigrationPolicy.php:18` |
| Pro `AnalyticsPolicy` | `manage_options` | pro `app/Http/Policies/AnalyticsPolicy.php:12` |
| Pro `PlaylistPolicy` | `edit_others_posts` | pro `app/Http/Policies/PlaylistPolicy.php:21-25` |
| Pro `PresetPolicy` | `manage_options` | pro `app/Http/Policies/PresetPolicy.php:17` |

`Helper::authoringCapability()` is itself filterable:
`apply_filters('fluent_player/authoring_capability', 'edit_others_posts')` — `app/Helpers/Helper.php:1113`.
**This filter is undocumented**, despite being the single lever that re-tunes access to 22 routes.

### 3d. Route totals

**45 free + 102 Pro = 147 routes.** The docs cover 45 — **30.6%**.

### 3e. Public / unauthenticated surface

Three Pro routes register with **no policy at all**:

| Route | Source | Auth |
|---|---|---|
| `GET bunny/storage/stream` | pro `app/Http/Routes/api.php:34` | none by design (frontend video proxy) |
| `POST cloudflare-stream/webhook` | pro `app/Http/Routes/api.php:57` | `Webhook-Signature` header |
| `POST mux/webhook` | pro `app/Http/Routes/api.php:109` | `Mux-Signature` header |

Plus **7 admin-ajax actions, 5 of them `nopriv`** — see §7.3.

---

## 4. CRITICAL findings (10) — ✅ all fixed

### ✅ C-1 · The email-provider tutorial does not work — registration body is an empty stub
**Doc:** `extending/custom-email-provider.md:85-101`

The page offers two registration paths. The first is a comment-only stub; the second is wrong.

The **action name is correct** — `fluent_player/register_email_providers` really does fire
(`app/Services/EmailProviderService.php:35`, consumed at `app/Hooks/actions.php:231`). The defect is
that the callback body is empty, so the page never shows the actual registration call.

The offered fallback is worse: `fluent_player/email_providers`
(`app/Hooks/Handlers/EmailCollectionHandler.php:103`) is **not a provider registry**. It filters the
per-layer config list whose elements are `['enabled' => bool, 'type' => string, 'config' => array]`
(consumed at `app/Services/EmailCollectionService.php:317-336`). An `AbstractEmailProvider` object
injected there has no `enabled` key, so `Arr::isTrue()` is false and the entry is **skipped
silently** — nothing fatals, nothing runs.

**Fix:**
```php
add_action('fluent_player/register_email_providers', function () {
    \FluentPlayer\App\Services\EmailProviderService::registerProvider(new MyServiceProvider());
});
```
Delete the `fluent_player/email_providers` example from this page entirely.

### ✅ C-2 · Tutorial provider can never be selected in a capture layer
**Doc:** `extending/custom-email-provider.md:36-79`

The editor's provider dropdown only lists providers whose **saved settings** have a truthy `enabled`
(`resources/blocks/media/components/EmailProviderSettings.jsx:1024`), seeded from
`getDefaultSettings()` (`app/Services/EmailProviderService.php:85-88`). The tutorial class declares
no `$defaultSettings` and no `enabled` field → invisible in every capture layer → `subscribe()` is
never reached.

**Fix:** add `protected $defaultSettings = ['enabled' => false, 'api_key' => ''];` and prepend an
`enabled` switch field. Compare pro `app/EmailProviders/WebhookProvider.php:18-21`.

### ✅ C-3 · `getSettingsFields()` example returns the wrong shape — every field binds to `undefined`
**Doc:** `extending/custom-email-provider.md:42-50`

Documented as an assoc array keyed by field name. The real contract is an **indexed list of
descriptors, each carrying its own `key`** — see `app/Integrations/FluentCrm/EmailCaptureProvider.php:80-110`
and pro `WebhookProvider.php:106-172`. Consumers index on `field.key`
(`resources/admin/modules/settings/components/ConfigFormFields.vue:117`), so with the documented
shape `field.key === undefined` for every field and the API key is never persisted.

### ✅ C-4 · Docs state the wrong capability for four of nine free route groups
**Doc:** `rest-api/index.md:13` — "each policy requires the `manage_options` capability"

Only `SettingsPolicy` and `MigrationPolicy` do. `MediaPolicy`, `PresetPolicy`, and `LayerPolicy`
require `edit_others_posts` (Editor-level). **22 of 45 free routes are reachable by
non-administrators.** The docs understate the exposure. See §3c.

### ✅ C-5 · `media.md` claims `MediaPolicy` requires `manage_options`
**Doc:** `rest-api/media.md:8`, `:10`

`MediaPolicy.php:15` carries an explicit source comment saying the opposite: *"Media authoring
(block editor). Editors/Authors, not admin-only."*

### ✅ C-6 · `smartcodes.md` documents both the wrong policy and the wrong capability
**Doc:** `rest-api/smartcodes.md:8` — claims `SettingsPolicy` / `manage_options`

`app/Http/Routes/api.php:69` registers the group with `MediaPolicy`, and the source comment at
`:66-68` explains why (read-only token list for the block editor's inserter → authoring gate, not
the admin gate). **The single most misleading auth claim in the set** — an integrator reading it
would assume admin-only and skip their own gating.

### ✅ C-7 · `index.md` asserts the whole API is authenticated; three Pro routes are fully public
**Doc:** `rest-api/index.md:9` — "These are **authenticated admin endpoints**, not public APIs."

See §3e.

### ✅ C-8 · The REST base namespace is never stated anywhere in the docs
**Doc:** `rest-api/index.md:41-43`

The page declines to state the base, and wrongly claims it derives from the plugin slug — it comes
from two explicit config keys (§3a). **No page in the entire REST section contains a single
copy-pasteable URL.** The stated rationale ("to avoid drift across versions") is unfounded: the
namespace has been stable at v2 and is hard-coded at three runtime sites.

### ✅ C-9 · `hooks/actions.md` documents a phantom hook
**Doc:** `hooks/actions.md:81` — lists `fluent_player/before_save_media`

**Zero matches across both plugin trees.** No `do_action`, no `add_action`, no test, no changelog.
The only save-time action is `fluent_player/after_save_media`
(`app/Http/Controllers/MediaController.php:116`, `:145`). There is no pre-save seam.

**Fix:** delete it. Point readers wanting pre-save mutation at
`fluent_player/default_media_status` (`app/Http/Controllers/MediaController.php:296`) or core's
`wp_insert_post_data`.

### ✅ C-10 · The flagship LMS recipe is a silent no-op
**Doc:** `recipes/index.md:38-43`

```php
if ($userId && !empty($payload['complete'])) {   // ← key does not exist
```
The real payload nests it: `$payload['verdict']['complete']`
(`app/Services/Progression/ProgressionService.php:187-194`). The condition is never true, so the
LMS step is never marked complete — and it fails silently, which is the worst failure mode for a
copy-paste recipe.

---

## 5. HIGH findings (22) — selected · ✅ all fixed

### ✅ H-1 · `recipes/index.md:51` uses PHP 8.0 syntax against a PHP 7.4 floor
`str_ends_with()` requires PHP 8.0. Both plugins declare `Requires PHP: 7.4` (`readme.txt:6`).
This **fatals** inside the email-capture AJAX filter on a supported host.
**Fix:** `substr($email, -12) === '@example.com'`.

### ✅ H-2 · The access-gating page documents the messages but not the gate
**Doc:** `hooks/access-gating.md` (whole page)

`fluent_player/can_view_media` (`app/Models/Media.php:302`, 2 args, boolean, falsy = block) is the
plugin's **only real access-control filter**, and it appears nowhere on the docs site. The page
documents four cosmetic message/HTML filters instead. Pro re-dispatches it at
pro `app/Hooks/Handlers/PlaylistShortcodeHandler.php:292`.

### ✅ H-3 · The `media_locked_html` example makes locked media permanently un-unlockable
**Doc:** `hooks/access-gating.md:39-41`

The example replaces `$html` wholesale — but `$html` **is the password-entry form**
(`app/Services/MediaRenderer.php:362-373`). Following the example removes the only way to unlock.

### ✅ H-4 · `progression.md:16` documents a policy key that does not exist
Claims a `basis` key. The real policy (`app/Services/Progression/ProgressionService.php:25-38`) has
**four** keys: `threshold` (0.9), `countMutedAutoplay` (false), `autoComplete` (false),
`accumulate` (false). None is `basis`; three of the four are undocumented.

### ✅ H-5 · `watch_recorded` payload is documented with 5 keys; it passes 6
The omitted key is `context` (`ProgressionService.php:193`) — the only way an LMS listener knows
which step a watch belongs to.

### ✅ H-6 · `player_settings` is filed under FluentCommunity but is a core render-time filter
**Doc:** `hooks/reference.md:131`

It fires at **four** sites, only one of which is FluentCommunity. The primary is
`app/Services/MediaRenderer.php:191` — the main front-end render path, applied *before*
`wp_localize_script` so Pro can inject signed CDN/DRM URLs. Filing it under FluentCommunity leads
readers to believe it only runs on portal pages; a callback registered on that assumption fires on
**every** front-end render.

### ✅ H-7 · `media_locked_message` has two call sites with different `$mediaId` semantics
`app/Services/MediaRenderer.php:329` passes literal `0` (building the global JS string);
`:359` passes the real `$mediaId`. A callback branching on `$mediaId` — the obvious "custom message
per video" use case — will mishandle the global pass and can leak a per-media message into the
global string.

### ✅ H-8 · `dynamic_source_overrides` documents keys that do not exist
**Doc:** `hooks/dynamic-sources.md:18`, `:25-31`

Documented as `url` / `provider` / `poster`. Actual keys are **`src` / `provider` / `posterSrc`**
(`app/Services/DynamicMediaSourceResolver.php:185-189`). The example writes a key nothing reads.

### ✅ H-9 · The "bundled reference implementation" is a deprecated shim
**Doc:** `extending/custom-email-provider.md:10`, `:113`

`app/EmailProviders/FluentCRMProvider.php:10-17` is explicitly `@deprecated` — a 38-line back-compat
shim kept only because released Pro references the class path. The real implementation is
`app/Integrations/FluentCrm/EmailCaptureProvider.php:19`.

### ✅ H-10 · `$settings` in `subscribe()` is the per-layer config, not global settings
The only method passing global settings is `EmailProviderService::subscribeToProviders()`
(`:221-241`), which is **test-only dead code**. At runtime `subscribe()` receives the layer's
`config` array (`app/Services/EmailCollectionService.php:75`). `api_key` only works because the
editor special-cases that literal key name (`EmailProviderSettings.jsx:289-291`).

### ✅ H-11 · `layers.md:18` calls interactive layers "largely a Pro feature" — the REST surface is 100% free
All three `layer/*` routes, the controller, policy, and `LayerService` live in free. Pro registers
**zero** `layer/*` routes. The Pro dependency is *timed content*, a different prefix.

### ✅ H-12 · `presets.md` calls the group read-only; Pro adds three write routes
Under a **stricter** policy (`manage_options`) than the free reads (`edit_others_posts`) — so the
group has two different capabilities depending on method. pro `api.php:150-152`.

### ✅ H-13 · `media.md` presents the tag endpoints as free; they are Pro-gated at runtime
Routes are registered in free (`api.php:15-18`) but every handler funnels through
`MediaController::dispatchMediaTagRequest()` (`:382-397`). Without Pro: **HTTP 403
`Tags are a Pro feature`**.

### ✅ H-14 · `media.md:32` doesn't flag `/playlist-page-builder-preview` as Pro-dependent
Without Pro it returns **`200` with `{"html": ""}`** — a silent empty success
(`MediaController.php:70-73`).

### ✅ H-15 · `js-api/index.md:16` inverts what AnalyticsTracker does
Claims it "emits play / progress / complete events". It emits **nothing** — it *listens* to native
Vidstack events and POSTs to `admin-ajax.php`. This is exactly the Vidstack/plugin conflation the
page's own intro promises to avoid.

### ✅ H-16 · Analytics and Layers presented as free JS surface with no `(Pro)` marker
`wp_ajax_fluent_player_track_event` is registered **only in Pro**
(pro `app/Hooks/Handlers/AnalyticsHandler.php:56-57`), and free's `MediaRenderer` never populates
`settings.layers`. Both modules are **inert without Pro**.

### ✅ H-17 · `reference.md` claims to be exhaustive; its generator structurally cannot be
`bin/extract-hooks.mjs:14` sets `const APP = join(PLUGIN, 'app')` and matches only bare
`apply_filters(` / `do_action(`. It is therefore blind to:
- `boot/app.php:34` → `fluent_player/loaded` (the plugin's primary bootstrap action)
- `boot/globals.php:547` → a second `allowed_html_tags` site
- `$app->applyFilters()` dispatches → `admin_vars` (`AdminMenuHandler.php:382`), `base_url` (`:253`)
- cron-dispatched actions → `daily_cleanup`

### ✅ H-18 · `extending/index.md:12` propagates the wrong registration mechanism
Same defect as C-1, one layer up.

---

## 6. MEDIUM / LOW findings — themes · ✅ all fixed

Full per-finding detail is in the six agent reports (paths in §12). The recurring themes:

**Stale line citations (systemic).** 22 of 76 source citations in `hooks/reference.md` are wrong
(29%) — e.g. `media_locked_html` cited at `MediaRenderer.php:285`, actually `:376`;
`before_render_media` cited at `:95`, actually `:175`. Also 4 stale in `hooks/access-gating.md`
(off by 17–90 lines), 2 in `hooks/community.md` (one now lands on a *different* hook), 1 in
`hooks/media-rendering.md:12`, and 7 of 9 group citations in `rest-api/*`.
This defeats the site's own stated promise at `hooks/index.md:11` — *"Signatures on this site are
cited with a `file:line` so you can confirm against your installed version."*
`hooks/actions.md`, `hooks/unlock.md`, and `hooks/progression.md` are clean.

**Broken tooling is the root cause.** Both extractors default to a path that does not exist:
`bin/extract-hooks.mjs:13` and `bin/extract-routes.mjs:12` both point at
`/Volumes/Projects/work/forms/wp-content/plugins/fluent-player` — the **legacy** folder, not the
source-of-truth `fluent-player-dev`. Neither can scan Pro. The documented regeneration commands in
`hooks/index.md:34-38`, `hooks/reference.md:162`, `rest-api/index.md:36-39`, and
`getting-started/architecture.md:52-54` all fail or under-report for the same reason.

**No request parameters documented anywhere.** Not one endpoint documents its params, though many
return 4xx when they're missing — `GET media/metadata` needs `url` (400 otherwise),
`GET media/page-builder-preview` needs `media_id`, `POST media/do-bulk-action` needs `action` +
`media_ids` with a 7-value whitelist, etc.

**Response shapes are absent or wrong.** `media.md:49-56` shows a 4-key list envelope; the real
`LengthAwarePaginator` emits **13** keys. `PUT {id}` is documented as returning "the updated media
object" but actually returns `{success, message, media}`. `presets` returns a *bare array*, the only
free group without an envelope.

**`migration.md` never names the source.** The entire migration surface is **Presto Player specific**
(every method docblock says so, e.g. `MigrationController.php:27`), but the docs describe it
generically as "another player plugin", implying a pluggable source that does not exist.

**Semantic gaps in otherwise-correct entries.** `dynamic_source_overrides` return-null semantics;
`settings_section/{$section}` never says what `{$section}` resolves to (a reader could plausibly
register the literal string); `default_preload` example is a no-op (`'metadata'` is already the
default); `media-rendering.md:8` says "All are filters" while its own table lists an action.

---

## 7. Coverage gaps — what was missing · ✅ closed (3 P3 pages scoped out, see §0g)

### ✅ 7.1 Undocumented hooks — 36 (14 free + 22 Pro-only)

Highest-value free omissions:

| Hook | Source | Why it matters |
|---|---|---|
| `fluent_player/loaded` | `boot/app.php:34` | The bootstrap action every add-on needs. The plugin's own `CLAUDE.md` presents it as *the* canonical extension example. |
| `fluent_player/can_view_media` | `app/Models/Media.php:302` | The master access gate (see H-2). |
| `fluent_player/authoring_capability` | `app/Helpers/Helper.php:1113` | Re-tunes access to 22 REST routes. |
| `fluent_player/global_vars` | `app/Services/MediaRenderer.php:339` | The only filter for the frontend runtime's global config object. |
| `fluent_player/admin_vars` | `app/Hooks/Handlers/AdminMenuHandler.php:382` | **Live free→Pro contract** (pro consumes at `filters.php:147`). |
| `fluent_player/media_status_changed` | `app/Hooks/actions.php:38` | Cache invalidation seam for integrations. |
| `fluent_player/daily_cleanup` | `app/Hooks/Handlers/ScheduledCleanupHandler.php:9` | Cron seam; Pro attaches two callbacks. |
| `fluent_player/default_media_status` | `app/Http/Controllers/MediaController.php:296` | The real answer to the phantom `before_save_media`. |
| `fluent_player/media_discoverable` / `media_page_noindex` | `FluentPlayerMediaCPT.php:107`, `:120` | SEO seams. |
| `fluent_player/behavior_can_report` | `AbstractBehaviorHandler.php:46` | Consent gate for behavior reporting. |
| `fluent_player/media_data_rate_limit` | `FluentCommunityMediaBlock.php:774` | Throttles the public `nopriv` endpoint. |

Plus ~11 undocumented email-pipeline hooks including `pre_process_email_submit`
(`EmailCollectionHandler.php:77` — return non-null to short-circuit the whole submission) and
`provider_config` (`EmailCollectionService.php:327` — the sanctioned way to adjust a third-party
provider's config without owning the class).

### ✅ 7.2 Pro is 100% undocumented

`getting-started/architecture.md:46` declares that Pro-only items are marked **(Pro)**.
**The `(Pro)` marker appears zero times in any content page.** Not "thinly covered" — there is not
one Pro hook, route, class, block, shortcode, table, or event described anywhere.

| Pro area | Real surface | Documented |
|---|---|---|
| Mux | **8 hooks**, 26 routes across 2 capability tiers + public webhook | No |
| Analytics | 17 routes, `flp_visits` table, public AJAX ingest | No |
| Playlists | 8 hooks, 8 routes, CPT, block, shortcode | No |
| BunnyCDN (Stream + Storage) | 15 routes + 1 public stream endpoint | No |
| Cloudflare Stream / R2 | 12 routes + public webhook | No — not even in the "Pro adds…" sentence |
| Gumlet | 9 routes | No — also absent from that sentence |
| Subtitles / storyboards | 5 routes | No |
| Timed content | 1 route + block-markup contract | Mentioned once, never explained |
| Playlist layouts | `BasePlaylistLayout` + 3 layouts + factory | No |
| Licensing | 3 routes | No |

### ✅ 7.3 Undocumented AJAX surface — 7 actions, 5 `nopriv`

A repo-wide search of the docs for `admin-ajax`, `wp_ajax`, or any of these action names returns
**zero matches**. These are the only *public* entry points most integrators need.

| Action | nopriv | Handler |
|---|---|---|
| `fluent_player_email_submit` | ✅ | `EmailCollectionHandler.php:57-58` — writes to `flp_email_collections` |
| `fluent_player_unlock` | ✅ | `UnlockHandler.php:21-22` — sets HttpOnly per-media cookie |
| `fluent_player_get_media_data` | ✅ | `FluentCommunityMediaBlock.php:65-66` |
| `fluent_player_media_milestone` | ✅ | `AbstractBehaviorHandler.php:34-36` (FluentCRM-gated) |
| `fluent_player_layer_event` | ✅ | `AbstractBehaviorHandler.php:34-36` (FluentCRM-gated) |
| `fluent_player_track_event` | ✅ | **Pro** `AnalyticsHandler.php:56-57` |
| `fluent_player_progression` | ❌ by design | `ProgressionHandler.php:21` |

Nonce actions differ by surface: `fluent_player_frontend` (progression/unlock) vs
`fluent_player_behavior` (behavior handlers, plus a 60s rate limit and 15s lock TTL).

The docs currently describe the *filters inside* these endpoints (`hooks/email.md`,
`hooks/unlock.md`) without ever naming the endpoints — which makes those pages half-useful.

### ✅ 7.4 No shortcode reference — 4 shortcodes, 16 attributes

Registered via `$app->addShortCode()` (a WPFluent wrapper), which is why a plain `add_shortcode`
grep finds nothing:

| Tag | Registration |
|---|---|
| `[fluentplayer]` | `app/Hooks/actions.php:179` |
| `[fluentmedia]` (alias) | `app/Hooks/actions.php:180` |
| `[fluentplayer_timestamp]` | `app/Hooks/actions.php:204` |
| `[fluentplaylist]` | pro `app/Hooks/actions.php:33` |

`[fluentplayer]` accepts 16 attributes (`MediaShortcodeHandler.php:59-79`). The handler's own
docblock (`:16-57`) already contains the non-obvious semantics — source precedence, setting
precedence, `preset="ambient"` silently downgrading on free, and the trap that **any source or
playback override forces the player-only render path, so timed-content InnerBlocks do not render.**
None of it is on the site.

### ✅ 7.5 No data-model page

The only data sentence on the whole site is *"IDs are WordPress post IDs (media are a custom post
type)"* (`rest-api/index.md:48`).

Undocumented: **3 tables** (`flp_email_collections` free, `flp_visits` pro, plus the **dropped**
`flp_play_resumes` — worth documenting *because* third-party code may still read it), **2 CPTs**
with custom rewrite rules, the `flp_media_tag` taxonomy, 5 meta keys, and 13 option keys.
Also undocumented: `flp_presets` was a table, then migrated into an option
(`database/DBMigrator.php:70`).

### ✅ 7.6 Five of six extension base classes have no guide

| Base class | Guide |
|---|---|
| `AbstractEmailProvider` | ✅ the one real page (though see C-1…C-3) |
| `AbstractIntegration` | ❌ **highest-value gap** — all six Pro hosted-streaming integrations subclass it; the registering filter *is* documented but is unusable without the contract. Note its abstract set **differs** from `AbstractEmailProvider` (`testConnection` instead of `subscribe`/`isConfigured`/`sanitizeSettings`) — readers who "generalize the pattern" per `extending/index.md:18` will fatal. |
| `AbstractPageBuilder` | ❌ paired with a documented filter + an undocumented `registerEarly()` lifecycle hook |
| `AbstractBehaviorHandler` | ❌ not even listed in `extending/index.md` — this is the FluentCRM automation-trigger seam |
| `BasePlaylistLayout` (Pro) | ❌ |
| `RemoteDriver` (Pro) | ❌ |

### ✅ 7.7 JS API is a placeholder

`js-api/index.md` names zero globals and zero events. Reality: **5 `window` globals** —
`FluentPlayer` (`resources/js/fluent-player.js:214`), `FluentPlaylist`, `initFluentPlaylists`
(the single most likely thing a third-party dev needs, for AJAX-loaded content),
`FluentBrowserStorage`, `fluentPlayerMediaCache` — and **9 custom events**.

⚠️ `window.FluentPlayer` is the **class constructor, not an instance**. Live instances live in a
module-private `Map` with no exported accessor — so there is currently no supported way to reach a
running player from outside. That is a real API gap worth stating plainly.

Naming is inconsistent and should be called out: runtime events are kebab-case
(`fluent-player-play`), editor events are slash-namespaced (`fluentPlayer/mediaUpdated`).

---

## 8. Prioritized remediation plan — ✅ P0/P1/P2 complete

**✅ P0 — the docs are actively misleading until these land** — all 6 done

1. ✅ **Correct every capability claim** (`rest-api/index.md:13`, `media.md:8,10`, `smartcodes.md:8`).
   Security-relevant: readers are being told endpoints are admin-only when they are Editor-level.
2. ✅ **State the REST base**: `/wp-json/fluent-player/v2/`. Also fix `fluent-player-dev/CLAUDE.md`,
   which still says v1.
3. ✅ **Rewrite `extending/custom-email-provider.md`** — C-1, C-2, C-3 and H-9, H-10. Currently the
   tutorial cannot produce a working provider.
4. ✅ **Fix the two broken recipes** (C-10, H-1) and re-verify every remaining snippet.
5. ✅ **Delete the phantom `before_save_media`** (C-9).
6. ✅ **Document the 3 public Pro routes and the 5 `nopriv` AJAX actions** — the unauthenticated
   surface is exactly what a security-conscious integrator needs and it is currently invisible.

**✅ P1 — required to build anything non-trivial** — all 6 done

7. ✅ Fix both extractors (`bin/extract-*.mjs`) to point at `fluent-player-dev`, walk `app/` + `boot/`
   + root PHP, match the `applyFilters`/`doAction` wrappers, and emit free/pro tags. Then regenerate
   — this fixes the counts and all 30+ stale line citations mechanically.
8. ✅ Add the 14 missing free hooks, leading with `loaded`, `can_view_media`, `authoring_capability`.
9. ✅ New page: **shortcode reference** (§7.4).
10. ✅ New page: **AJAX endpoint reference** (§7.3).
11. ✅ New guide: **`AbstractIntegration`** (§7.6).
12. ✅ New page: **data model** (§7.5).

**✅ P2 — close the Pro hole** — all 3 done

13. ✅ Either apply `(Pro)` markers for real, or add a `/pro/` section. Minimum viable: Pro hooks table
    (22), Pro REST table (102 routes / 12 groups with the 3 public routes flagged), and a playlist page.
14. ✅ **Free→Pro hook contract page.** ~~26~~ **27** free hooks are bound by Pro and are de-facto
    public API (count re-derived from source in round two — see §0e).
    `hooks/index.md:10` currently just warns that "hook names and signatures can change between
    releases" with no tiering — which tells a developer nothing is safe to build on.
15. ✅ Expand `js-api/` (§7.7), including the "no instance accessor" caveat.

**⚠️ P3 — completeness** — mostly done:

- ✅ Block attribute reference (`reference/blocks.md`)
- ✅ Capabilities page (`reference/capabilities.md`)
- ✅ DOM-attribute reference (`reference/dom-attributes.md` — added in round two)
- ✅ i18n and text domains (on `getting-started/architecture.md`)
- ✅ Versioning / migration history (`reference/data-model.md`)
- ✅ Real `settings_section/{$section}` values enumerated — including the finding that only
  `…/subtitle_service` ever fires
- ⬜ Playlist-layout guide (`BasePlaylistLayout`, Pro)
- ⬜ Analytics-events reference (`fluent_player_track_event` taxonomy + `flp_visits` columns)
- ⬜ Standalone page-builder guide (`AbstractPageBuilder` is currently covered only inside
  `reference/blocks.md`)

---

## 9. Two source-code issues surfaced by this audit — ⬜ NOT fixed (by design, see §0g)

Not docs bugs — worth raising with the plugin team separately.

1. **Two hooks have malformed literal names.** WPFluent's `hook()` concatenates with **no separator**
   (`vendor/wpfluent/framework/src/WPFluent/Foundation/Concerns/FoundationTrait.php:63-66`), so
   `applyCustomFilters('admin_menu_items', …)` (`AdminMenuHandler.php:303`) registers as
   **`fluent_playeradmin_menu_items`**, and `doAction($slug . '_loading_app')` (`:318`) registers as
   **`fluent-player_loading_app`**. Anyone guessing the conventional `fluent_player/…` name silently
   no-ops. No consumer was found for either, so these look like latent naming bugs rather than
   intentional API.

2. **`fluent_player/media_milestone`** appears in `dev/wp-browser/tests/Integration/Behavior/CASES.md:8`
   and `docs/fluentcrm/automation-events-spec.md:107` but is dispatched nowhere in production code.
   Appears planned, not shipped — correctly absent from the docs, but worth confirming.

---

## 10. What the docs get right

Recorded so this audit is falsifiable and so the good parts aren't lost in a rewrite:

- **No phantom REST endpoints.** All 45 free `Controller@method` pairs verified against the classes.
- **Every documented path, HTTP method, and param placeholder syntax is correct** for free.
- **Every arg count in `hooks/reference.md` is correct** — all 76 rows.
- **No action/filter type confusion** anywhere in the reference table.
- **All 8 code examples in `hooks/actions.md` + `hooks/media-rendering.md`** have correct
  `$accepted_args` and valid PHP; all filter examples `return`.
- **All `file:line` citations in `hooks/actions.md`, `hooks/unlock.md`, `hooks/progression.md`** are
  exact, including secondary call sites.
- **The free/Pro split in `extending/custom-email-provider.md:8` is correct** (free = FluentCRM only;
  Pro adds Webhook + Mailchimp).
- `X-WP-Nonce` guidance, the 401/403 behaviour, "45 routes across 9 groups" (for free), the
  `after_save_media` create-path citation, and the `settings_section` / `integrations` /
  `smartcodes` filter names are all correct.
- **VitePress config is clean** — 27 sidebar targets + nav links all resolve; no orphaned pages; the
  four cross-page anchors used by in-scope docs are valid.
- The class skeleton in the email-provider tutorial **does compile** — all five abstract methods are
  implemented with byte-identical signatures. The failures are registration and data-shape, not syntax.

---

## 11. Corrections applied to agent output

Three agent claims were wrong and were corrected by direct verification before inclusion:

1. **Filter count.** Agents reported 72 and 77. I concluded **78** — and *I* was the one who was
   wrong: that hand-count included a `sed` artifact. The agent reporting **77** was correct, as the
   fixed extractor later confirmed. The 72 figure missed 4 multi-line calls. Recorded here because
   the coordinator over-ruling a correct agent is exactly the failure mode worth remembering.
2. **Progression policy keys.** One agent reported the policy has 3 keys and named 2 as
   undocumented. It has **4** — the agent missed `accumulate` (`ProgressionService.php:36`).
3. **Email-provider registration hook.** One agent implied the documented hook name was wrong. The
   name `fluent_player/register_email_providers` is **correct** (`EmailProviderService.php:35`);
   the defect is that the docs leave the callback body an empty stub and never show
   `EmailProviderService::registerProvider()`.

---

## 12. Source reports

Per-finding detail with full `file:line` evidence, including every MEDIUM/LOW finding summarized
only thematically in §6:

```
scratchpad/audit-hooks-1.md    hooks/{index,reference,actions,media-rendering}.md   27 findings
scratchpad/audit-hooks-2.md    hooks/{access-gating,unlock,community,progression}   23 findings
scratchpad/audit-extending.md  extending/* + hooks/{dynamic-sources,email,smartcodes} 26 findings
scratchpad/audit-rest.md       rest-api/* (incl. full 147-route source-of-truth table) 28 findings
scratchpad/audit-misc.md       index, getting-started, js-api, recipes, changelog, config 20 findings
scratchpad/audit-gaps.md       coverage-gap analysis (undocumented surface)
```

Scratchpad root:
`/private/tmp/claude-502/-Volumes-Projects-forms-wp-content-plugins-fluent-player-dev/bfc53503-954b-4044-bce7-04b5e04b69ae/scratchpad/`

`audit-rest.md` contains the complete **147-row route table** (method / path / controller@method /
policy / capability / free-pro / source line) — use it directly to write the Pro REST pages.

---

## 13. Caveats

- **Pro handler existence is unverified.** All 45 free `Controller@method` targets were confirmed
  against their classes. For Pro, the 102 route *declarations* were read but not all 14 Pro
  controller classes were opened to confirm each target resolves.
- **All findings are from static reading.** No live WordPress instance was hit; no
  `/wp-json/fluent-player/v2/` index was fetched; the email-provider tutorial was not executed. The
  CRITICAL tutorial findings derive from reading the registry, the dispatch loop, and both UI
  consumers.
- **One route-ordering question is a source concern, not a docs finding:** `media/tags`
  (`api.php:15`) and `media/{id}` (`api.php:19`) could theoretically collide, since `{id}` compiles
  to a permissive pattern with no `where()` constraint. `GET media/tags` relies on `/tags` being
  registered first. Worth a live check.
- **JS event list may be incomplete** for `.emit()`-style emitters; the 9 `CustomEvent` dispatches
  are verified by `file:line`. Only `resources/` was scanned, not built bundles.
- **Divi playlist module attributes** were not enumerated.
- **Hook counts treat tests as non-authoritative** (`dev/`, `tests/` excluded). Counting them
  differently moves the free total by ~2.
