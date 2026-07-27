#!/usr/bin/env node
// Extracts every action/filter dispatch from the FluentPlayer plugin trees.
// Emits a JSON map and a grouped markdown stub. The set it produces is authoritative;
// descriptions/examples are curated by hand afterward (the hybrid workflow).
//
// Scans BOTH the free and pro repos and tags every hook free/pro/both.
//
// Covers four dispatch forms, not just the bare WordPress functions:
//   do_action('fluent_player/x')            apply_filters('fluent_player/x')
//   $app->doAction('fluent_player/x')       $app->applyFilters('fluent_player/x')
// The WPFluent wrappers matter: `fluent_player/admin_vars` and `fluent_player/base_url`
// are dispatched only via applyFilters() and are invisible to an apply_filters-only regex.
//
// Scans app/ + boot/ + root-level .php in each repo. Test trees (dev/, tests/) and
// vendor/node_modules are excluded so counts reflect the shipped surface.
//
// Usage:
//   node bin/extract-hooks.mjs [freePath] [proPath]

import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, basename, resolve } from 'node:path'

// Resolution order: CLI args → env vars → a plugins dir next to this checkout → the common
// local layout. Hardcoding a single absolute path is what broke the previous version of this
// script (it pointed at a machine that no longer existed), so every step is overridable.
const CANDIDATE_PLUGIN_DIRS = [
  process.env.FLP_PLUGINS_DIR,
  resolve(process.cwd(), '../../wp-content/plugins'),   // docs checked out inside a WP install
  '/Volumes/Projects/forms/wp-content/plugins',         // the maintainers' local layout
].filter(Boolean)
const DEFAULT_PLUGINS = CANDIDATE_PLUGIN_DIRS
  .find(d => existsSync(join(d, 'fluent-player-dev'))) || CANDIDATE_PLUGIN_DIRS[0]
const FREE = process.argv[2] || process.env.FLP_FREE || join(DEFAULT_PLUGINS, 'fluent-player-dev')
const PRO = process.argv[3] || process.env.FLP_PRO || join(DEFAULT_PLUGINS, 'fluent-player-pro')

if (!existsSync(FREE)) {
  console.error(`✖ Free plugin source not found: ${FREE}`)
  console.error('  Set FLP_FREE / FLP_PRO (or FLP_PLUGINS_DIR), or pass paths:')
  console.error('    node bin/extract-hooks.mjs <freePath> <proPath>')
  process.exit(1)
}
const OUT = join(process.cwd(), '_generated')
const PREFIX = 'fluent_player/'

// Directories scanned inside each repo, relative to its root.
const SCAN_DIRS = ['app', 'boot']
// Never walk into these, at any depth.
const SKIP_DIRS = new Set(['vendor', 'node_modules', 'dev', 'tests', 'test', 'assets', 'dist', 'language'])

// Group a hook name by keyword. First match wins; order matters.
const GROUPS = [
  ['Access & gating', /(locked|access_denied|can_view_media|authoring_capability|behavior_can_report)/],
  ['Dynamic sources', /dynamic_source/],
  ['Analytics & progression', /(watch_recorded|progression|coverage|external_tracked|milestone|track_event)/],
  ['Email providers & export', /(email_provider|email_data|email_export|email_template|email_styles|email_collect|register_email|email_submission|email_submit|provider_config|raw_request_data|submission_data)/],
  ['Media rendering', /(block_media|media_block|media_default|default_preload|allowed_media|audio_extensions|allowed_html|link_new_tab|media_bulk|media_paginate|media_locked|render_media|before_render|player_settings|global_vars)/],
  ['Media lifecycle', /(save_media|delete_media|media_taxonomies|media_status_changed|default_media_status|media_discoverable|media_page_noindex|media_tags_request)/],
  ['FluentCommunity', /fluent_community/],
  ['Playlist', /playlist/],
  ['Hosted streaming', /(mux|bunny|cloudflare|gumlet|r2_|storyboard)/],
  ['Integrations', /^integrations$|integration|fluentcrm|learndash|webhook_/],
  ['Page builders', /(divi|elementor|page_builders)/],
  ['Bootstrap & admin', /(^loaded$|admin_vars|base_url|admin_notices|admin_menu|daily_cleanup|settings_section)/],
  ['Admin & i18n', /(admin_translations|frontend_translations|translation)/],
  ['Smartcodes', /smartcode/],
]

function groupOf(name) {
  const bare = name.slice(PREFIX.length)
  for (const [label, re] of GROUPS) if (re.test(bare)) return label
  return 'Other'
}

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const p = join(dir, entry)
    const s = statSync(p)
    if (s.isDirectory()) walk(p, acc)
    else if (entry.endsWith('.php')) acc.push(p)
  }
  return acc
}

// Every PHP file that ships: the scanned dirs plus root-level .php
// (boot/app.php holds fluent_player/loaded; the root file holds the plugin header).
function phpFiles(root) {
  if (!existsSync(root)) return []
  const acc = []
  for (const d of SCAN_DIRS) walk(join(root, d), acc)
  for (const entry of readdirSync(root)) {
    if (entry.endsWith('.php') && statSync(join(root, entry)).isFile()) acc.push(join(root, entry))
  }
  return acc
}

// From the index of the '(' after the dispatch call, return the argument-list
// substring (paren-balanced, quote-aware) so we can count top-level args.
function readArgList(src, openParen) {
  let depth = 0, i = openParen, quote = null, out = ''
  for (; i < src.length; i++) {
    const c = src[i]
    if (quote) {
      out += c
      if (c === quote && src[i - 1] !== '\\') quote = null
      continue
    }
    if (c === '"' || c === "'") { quote = c; out += c; continue }
    if (c === '(') { depth++; if (depth === 1) continue }
    if (c === ')') { depth--; if (depth === 0) return out }
    out += c
  }
  return out
}

// Count top-level comma-separated args in an arg-list substring.
function countArgs(argList) {
  let depth = 0, quote = null, n = argList.trim() ? 1 : 0
  for (let i = 0; i < argList.length; i++) {
    const c = argList[i]
    if (quote) { if (c === quote && argList[i - 1] !== '\\') quote = null; continue }
    if (c === '"' || c === "'") { quote = c; continue }
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') depth--
    else if (c === ',' && depth === 0) n++
  }
  return n
}

// Bare WP functions and the WPFluent wrappers. applyCustomFilters/doActionCustom are
// deliberately excluded: they prepend the hook prefix with no separator, producing names
// outside the fluent_player/ namespace (see the naming-bug note in the docs).
// The leading class excludes ':' so a static call like Foo::apply_filters() is not mistaken
// for the WordPress function.
const CALL_RE = /(?:^|[^\w$>:])(do_action|apply_filters)\s*\(|->\s*(doAction|applyFilters)\s*\(/g

const hooks = new Map() // name -> { name, type, callbackArgs, free, pro, occurrences: [] }
const problems = []     // anything that would otherwise be dropped silently

// Blank out comments so a commented-out dispatch is never published as a live hook, while
// preserving byte offsets so line numbers stay exact.
function stripComments(src) {
  let out = '', i = 0, quote = null
  while (i < src.length) {
    const c = src[i], n = src[i + 1]
    if (quote) {
      out += c
      if (c === '\\') { out += n ?? ''; i += 2; continue }
      if (c === quote) quote = null
      i++
      continue
    }
    if (c === '"' || c === "'") { quote = c; out += c; i++; continue }
    if (c === '/' && n === '*') {
      const end = src.indexOf('*/', i + 2)
      const stop = end === -1 ? src.length : end + 2
      for (let k = i; k < stop; k++) out += src[k] === '\n' ? '\n' : ' '
      i = stop
      continue
    }
    if ((c === '/' && n === '/') || c === '#') {
      while (i < src.length && src[i] !== '\n') { out += ' '; i++ }
      continue
    }
    out += c
    i++
  }
  return out
}

function scan(root, edition) {
  for (const file of phpFiles(root)) {
    const src = stripComments(readFileSync(file, 'utf8'))
    const re = new RegExp(CALL_RE.source, 'g')
    let m
    while ((m = re.exec(src))) {
      const fn = m[1] || m[2]
      const open = src.indexOf('(', m.index + (m[0].length - 1))
      const argList = readArgList(src, open)
      const line = src.slice(0, m.index).split('\n').length + (m[0].startsWith('\n') ? 1 : 0)
      const loc = `${basename(root)}/${relative(root, file)}:${line}`
      const nameMatch = argList.match(/^\s*['"]([^'"]+)['"]/)
      if (!nameMatch) {
        // A variadic forward — doAction(...$args) — is the framework wrapper's own definition,
        // not a dispatch site. Skip it; it has no hook name to report.
        if (/^\s*\.\.\.\$/.test(argList)) continue
        // Anything else is a genuinely dynamic dispatch whose name cannot be read statically.
        // Record it loudly rather than dropping what may be a real extension point.
        problems.push(`DYNAMIC dispatch, name not statically resolvable: ${fn}(${argList.split(',')[0].trim()}) at ${loc}`)
        continue
      }
      const name = nameMatch[1]
      if (!name.startsWith(PREFIX)) continue
      const totalArgs = countArgs(argList)
      const callbackArgs = Math.max(totalArgs - 1, 0)
      const type = (fn === 'do_action' || fn === 'doAction') ? 'action' : 'filter'
      if (!hooks.has(name)) {
        hooks.set(name, {
          name, type, callbackArgs,
          argCounts: [], free: false, pro: false, occurrences: [],
          dynamic: /\{?\$/.test(name), // interpolated, e.g. settings_section/{$section}
        })
      }
      const h = hooks.get(name)
      if (h.type !== type) problems.push(`TYPE CONFLICT: ${name} dispatched as both action and filter (${loc})`)
      h.argCounts.push(callbackArgs)
      // Report the MINIMUM across call sites: that is the contract a callback can rely on.
      // Promising the max hands nulls to callbacks registered against the larger signature.
      h.callbackArgs = Math.min(...h.argCounts)
      h[edition] = true
      h.occurrences.push(loc)
    }
  }
}

scan(FREE, 'free')
scan(PRO, 'pro')

// Hooks with no literal dispatch site: cron callbacks, or dispatched through a variable.
// Each is verified by hand against source. `free`/`pro` mean DISPATCHED BY, never merely
// subscribed to — Pro subscribing to a free hook does not make it "both".
const MANUAL = [
  {
    name: 'fluent_player/daily_cleanup',
    type: 'action',
    callbackArgs: 0,
    free: true,
    pro: false, // Pro subscribes (pro app/Hooks/actions.php:59-60); it does not dispatch.
    occurrences: ['fluent-player-dev/app/Hooks/Handlers/ScheduledCleanupHandler.php:9'],
    note: 'Cron hook — scheduled via wp_schedule_event(), never dispatched by a literal do_action().',
  },
  {
    name: 'fluent_player/media_milestone',
    type: 'action',
    callbackArgs: 1,
    free: true,
    pro: false,
    occurrences: ['fluent-player-dev/app/Hooks/Handlers/AbstractBehaviorHandler.php:156'],
    note: 'Dispatched dynamically as do_action($this->eventName(), $ctx). The name is the constant '
      + 'BehaviorRegistry::TRIGGER_MILESTONE (app/Integrations/FluentCrm/BehaviorRegistry.php:17), '
      + 'returned by MediaMilestoneHandler::eventName().',
  },
  {
    name: 'fluent_player/layer_event',
    type: 'action',
    callbackArgs: 1,
    free: true,
    pro: false,
    occurrences: ['fluent-player-dev/app/Hooks/Handlers/AbstractBehaviorHandler.php:156'],
    note: 'Dispatched dynamically as do_action($this->eventName(), $ctx). The name is the constant '
      + 'BehaviorRegistry::TRIGGER_LAYER (app/Integrations/FluentCrm/BehaviorRegistry.php:18), '
      + 'returned by LayerEventHandler::eventName().',
  },
]
for (const h of MANUAL) {
  const existing = hooks.get(h.name)
  if (!existing) {
    hooks.set(h.name, { argCounts: [h.callbackArgs], dynamic: false, ...h })
    continue
  }
  // The source gained a literal dispatch for a name we were carrying by hand. Keep the curated
  // note, take the real dispatch data, and say so — never let a MANUAL entry vanish silently.
  problems.push(`MANUAL entry "${h.name}" now has a literal dispatch site (${existing.occurrences[0]}) — review whether the hand-written entry is still needed.`)
  existing.note = h.note
}

const all = [...hooks.values()].sort((a, b) => a.name.localeCompare(b.name))
const edition = h => (h.free && h.pro ? 'both' : h.free ? 'free' : 'pro')

const freeAll = all.filter(h => h.free)
const proOnly = all.filter(h => !h.free && h.pro)
const count = (list, t) => list.filter(h => h.type === t).length

// Group for the markdown report.
const grouped = {}
for (const h of all) (grouped[groupOf(h.name)] ??= []).push(h)

let md = `# FluentPlayer Hooks — generated stub\n\n`
md += `_Generated from \`${FREE}\` and \`${PRO}\`._\n\n`
md += `- **Free:** ${count(freeAll, 'action')} actions, ${count(freeAll, 'filter')} filters\n`
md += `- **Pro-only:** ${count(proOnly, 'action')} actions, ${count(proOnly, 'filter')} filters\n`
md += `- **Total distinct:** ${all.length}\n\n`
md += `Curate descriptions/examples by hand; this file only guarantees the set, the edition, and arg counts.\n\n`
md += `**Edition** = which plugin DISPATCHES the hook. Pro merely subscribing to a free hook does `
md += `not make it \`both\`; \`both\` means Pro re-dispatches it too.\n\n`
md += `**Callback args** is the MINIMUM across all dispatch sites — the contract a callback can `
md += `safely rely on. Hooks whose sites disagree are listed under "Varying arg counts" below.\n\n`

const dynamicHooks = all.filter(h => h.dynamic)
if (dynamicHooks.length) {
  md += `## ⚠️ Dynamic hook names\n\nThese are NOT copy-pasteable — the \`$\` segment is interpolated at runtime.\n\n`
  md += `| Pattern | Type | Callback args | Source |\n|---|---|---|---|\n`
  for (const h of dynamicHooks) {
    md += `| \`${h.name}\` | ${h.type} | ${h.callbackArgs} | \`${h.occurrences[0]}\` |\n`
  }
  md += `\n`
}

const varying = all.filter(h => h.argCounts && new Set(h.argCounts).size > 1)
if (varying.length) {
  md += `## ⚠️ Varying arg counts\n\n| Hook | Counts seen | Safe minimum |\n|---|---|---|\n`
  for (const h of varying) {
    md += `| \`${h.name}\` | ${[...new Set(h.argCounts)].sort().join(', ')} | ${h.callbackArgs} |\n`
  }
  md += `\n`
}

for (const label of Object.keys(grouped).sort()) {
  md += `## ${label}\n\n| Hook | Type | Callback args | Edition | Source |\n|---|---|---|---|---|\n`
  for (const h of grouped[label].sort((a, b) => a.name.localeCompare(b.name))) {
    const extra = h.occurrences.length > 1 ? ` _(+${h.occurrences.length - 1} more)_` : ''
    const flag = h.dynamic ? ' ⚠️' : ''
    md += `| \`${h.name}\`${flag} | ${h.type} | ${h.callbackArgs} | ${edition(h)} | \`${h.occurrences[0]}\`${extra} |\n`
  }
  md += `\n`
}

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'hooks.json'), JSON.stringify(all, null, 2))
writeFileSync(join(OUT, 'hooks.md'), md)

console.log(`free:     actions=${count(freeAll, 'action')} filters=${count(freeAll, 'filter')}`)
console.log(`pro-only: actions=${count(proOnly, 'action')} filters=${count(proOnly, 'filter')}`)
console.log(`total distinct=${all.length}`)
console.log(`wrote ${join(OUT, 'hooks.json')}`)
console.log(`wrote ${join(OUT, 'hooks.md')}`)

// Every dynamic dispatch must be accounted for by a MANUAL entry. Anything left over is a real
// extension point about to go undocumented — fail rather than under-report.
const KNOWN_DYNAMIC_SITES = new Set([
  // Resolves to fluent_player/media_milestone and fluent_player/layer_event — both carried
  // as MANUAL entries above.
  'fluent-player-dev/app/Hooks/Handlers/AbstractBehaviorHandler.php:156',
  // doAction($slug . '_loading_app') → registers as the separator-less name
  // "fluent-player_loading_app", which is OUTSIDE the fluent_player/ namespace this tool
  // reports. Tracked as a source-side naming bug, not a documented hook.
  'fluent-player-dev/app/Hooks/Handlers/AdminMenuHandler.php:318',
])
const unaccounted = problems.filter(p => {
  if (!p.startsWith('DYNAMIC')) return true
  return ![...KNOWN_DYNAMIC_SITES].some(site => p.includes(site))
})
if (unaccounted.length) {
  console.error(`\n✖ ${unaccounted.length} problem(s) — output written but NOT trustworthy:`)
  for (const p of unaccounted) console.error(`  - ${p}`)
  process.exit(1)
}
if (problems.length) {
  console.log(`note: ${problems.length} dynamic dispatch site(s), all covered by MANUAL entries`)
}
console.log('✓ every dispatch either resolved to a literal name or is a known dynamic site')
