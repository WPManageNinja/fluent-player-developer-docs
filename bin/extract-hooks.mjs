#!/usr/bin/env node
// Extracts every do_action / apply_filters call under the plugin's app/ dir.
// Emits a JSON map and a grouped markdown stub. The set it produces is authoritative;
// descriptions/examples are curated by hand afterward (the hybrid workflow).
//
// Usage:
//   node bin/extract-hooks.mjs [pluginPath]
// Default pluginPath: /Volumes/Projects/work/forms/wp-content/plugins/fluent-player

import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const PLUGIN = process.argv[2] || '/Volumes/Projects/work/forms/wp-content/plugins/fluent-player'
const APP = join(PLUGIN, 'app')
const OUT = join(process.cwd(), '_generated')
const PREFIX = 'fluent_player/'

// Group a hook name by keyword. First match wins; order matters.
const GROUPS = [
  ['Access & gating', /(locked|access_denied)/],
  ['Dynamic sources', /(dynamic_source|external_tracked)/],
  ['Email providers & export', /(email_provider|email_data|email_export|email_template|email_styles|email_collect|register_email)/],
  ['Media rendering', /(block_media|media_block|media_default|default_preload|allowed_media|audio_extensions|allowed_html|link_new_tab|media_bulk|media_paginate|media_locked|render_media|before_render)/],
  ['Media lifecycle', /(save_media|delete_media|media_taxonomies)/],
  ['FluentCommunity', /fluent_community/],
  ['Playlist', /playlist/],
  ['Progression', /(watch_recorded|progression|coverage)/],
  ['Integrations', /^integrations$|integration/],
  ['Page builders', /(divi|elementor)/],
  ['Admin & i18n', /(admin_notices|admin_translations|frontend_translations|translation)/],
]

function groupOf(name) {
  const bare = name.slice(PREFIX.length)
  for (const [label, re] of GROUPS) if (re.test(bare)) return label
  return 'Other'
}

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    const s = statSync(p)
    if (s.isDirectory()) walk(p, acc)
    else if (entry.endsWith('.php')) acc.push(p)
  }
  return acc
}

// From the index of the '(' after do_action/apply_filters, return the argument-list
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

const callRe = /\b(do_action|apply_filters)\s*\(/g
const hooks = new Map() // name -> { type, callbackArgs, occurrences: [file:line] }

for (const file of walk(APP)) {
  const src = readFileSync(file, 'utf8')
  let m
  while ((m = callRe.exec(src))) {
    const fn = m[1]
    const open = src.indexOf('(', m.index)
    const argList = readArgList(src, open)
    const nameMatch = argList.match(/^\s*['"]([^'"]+)['"]/)
    if (!nameMatch) continue
    const name = nameMatch[1]
    if (!name.startsWith(PREFIX)) continue
    const totalArgs = countArgs(argList)
    const callbackArgs = Math.max(totalArgs - 1, 0)
    const line = src.slice(0, m.index).split('\n').length
    const loc = `${relative(PLUGIN, file)}:${line}`
    const type = fn === 'do_action' ? 'action' : 'filter'
    if (!hooks.has(name)) hooks.set(name, { name, type, callbackArgs, occurrences: [] })
    const h = hooks.get(name)
    h.callbackArgs = Math.max(h.callbackArgs, callbackArgs)
    h.occurrences.push(loc)
  }
}

const all = [...hooks.values()].sort((a, b) => a.name.localeCompare(b.name))
const actions = all.filter(h => h.type === 'action')
const filters = all.filter(h => h.type === 'filter')

// Group for the markdown report.
const grouped = {}
for (const h of all) (grouped[groupOf(h.name)] ??= []).push(h)

let md = `# FluentPlayer Hooks — generated stub\n\n`
md += `_Generated from \`${relative(process.cwd(), APP)}\`. ${actions.length} actions, ${filters.length} filters. `
md += `Curate descriptions/examples by hand; this file only guarantees the set + arg counts._\n\n`
for (const label of Object.keys(grouped).sort()) {
  md += `## ${label}\n\n| Hook | Type | Callback args | Source |\n|---|---|---|---|\n`
  for (const h of grouped[label].sort((a, b) => a.name.localeCompare(b.name))) {
    md += `| \`${h.name}\` | ${h.type} | ${h.callbackArgs} | \`${h.occurrences[0]}\` |\n`
  }
  md += `\n`
}

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'hooks.json'), JSON.stringify(all, null, 2))
writeFileSync(join(OUT, 'hooks.md'), md)

console.log(`actions=${actions.length} filters=${filters.length} total=${all.length}`)
console.log(`wrote ${join(OUT, 'hooks.json')}`)
console.log(`wrote ${join(OUT, 'hooks.md')}`)
