#!/usr/bin/env node
// Extracts REST routes from the plugin's app/Http/Routes/*.php (WPFluent router).
// Tracks the current prefix + policy from `->prefix('x')->withPolicy('Y')->group(...)`
// and assigns each `->get/post/put/delete('path','Controller@method')` to it.
//
// Scans BOTH the free and pro repos and tags every route free/pro. Pro registers routes
// on its own prefixes AND extends free prefixes (media, presets), so a free-only scan
// under-reports by ~2/3.
//
// Also resolves each policy to its effective capability and flags routes registered with
// no policy at all — those are public endpoints and the most important thing to surface.
//
// Usage:
//   node bin/extract-routes.mjs [freePath] [proPath]

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
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
  console.error('    node bin/extract-routes.mjs <freePath> <proPath>')
  process.exit(1)
}
const OUT = join(process.cwd(), '_generated')

// Effective capability per policy class, PARSED FROM SOURCE — never hardcoded.
// A hardcoded map silently goes stale the moment a policy changes its capability, which is
// exactly the drift this tool exists to prevent. Unknown policies are a hard error (see below).
//
// Policies are keyed by "<edition>\\<ClassName>" because the SAME class name means different
// capabilities in free vs Pro: free PresetPolicy is edit_others_posts, Pro's is manage_options.
const AUTHORING_CAP = 'edit_others_posts' // Helper::authoringCapability() default, filterable

function parsePolicies(root, edition, out) {
  const dir = join(root, 'app/Http/Policies')
  if (!existsSync(dir)) return out
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.php') || f === 'index.php') continue
    const src = readFileSync(join(dir, f), 'utf8')
    const cls = f.replace(/\.php$/, '')
    let cap = null
    // Order matters. A policy may resolve the capability through a variable with a
    // method_exists() fallback (Pro's PlaylistPolicy does exactly that), so look for the
    // authoring helper anywhere in the class before falling back to a literal.
    if (/authoringCapability\s*\(\s*\)/.test(src)) {
      cap = AUTHORING_CAP
    } else {
      // Direct literal: current_user_can('manage_options')
      const direct = src.match(/current_user_can\(\s*['"]([a-z_]+)['"]/)
      if (direct) {
        cap = direct[1]
      } else {
        // Indirect: $capability = 'x'; ... current_user_can($capability)
        const via = src.match(/current_user_can\(\s*\$(\w+)\s*\)/)
        if (via) {
          const assign = src.match(new RegExp(`\\$${via[1]}\\s*=\\s*['"]([a-z_]+)['"]`))
          if (assign) cap = assign[1]
        }
      }
    }
    if (cap) out[`${edition}\\${cls}`] = cap
  }
  return out
}

// Resolve a withPolicy() string to a capability. Handles bare names, leading-backslash FQNs,
// and Pro's fully-qualified FluentPlayerPro\... form. Returns null when unresolvable so the
// caller can fail loudly rather than emitting a plausible-looking "unknown" cell.
function resolveCapability(policy, routeEdition, table) {
  if (!policy) return { cap: 'PUBLIC — no policy', resolved: true }
  const cls = policy.split('\\').filter(Boolean).pop()
  // A fully-qualified name tells us which plugin owns the class, regardless of which
  // repo's route file declared it — Pro routes frequently reference free policies.
  const owner = /FluentPlayerPro\\/.test(policy) ? 'pro'
    : /FluentPlayer\\/.test(policy) ? 'free'
      : routeEdition
  const cap = table[`${owner}\\${cls}`] ?? table[`free\\${cls}`] ?? table[`pro\\${cls}`]
  return cap ? { cap, resolved: true } : { cap: 'UNRESOLVED', resolved: false }
}

const routes = []
const problems = []

const prefixRe = /->prefix\(\s*['"]([^'"]+)['"]\s*\)/
const withPolicyRe = /->withPolicy\(\s*['"]([^'"]+)['"]\s*\)/
// Global (not anchored to $router) so several routes on one line are all captured.
const methodReG = /\$router->(get|post|put|delete|patch)\(\s*['"]([^'"]*)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/g
const groupOpenRe = /->group\(\s*function/

// Scope tracking is brace-depth based, mirroring Router::executeGroupCallback(). Line-oriented
// state (the previous approach) breaks on a closure inside a group body, a group opened and
// closed on one line, or a nested group — and its failure mode is publishing a capability-gated
// route as PUBLIC, which is the worst possible direction to be wrong in.
function scan(root, edition, capTable) {
  const dir = join(root, 'app/Http/Routes')
  if (!existsSync(dir)) return
  const files = readdirSync(dir).filter(f => f.endsWith('.php') && f !== 'index.php')
  for (const f of files) {
    const file = join(dir, f)
    const lines = readFileSync(file, 'utf8').split('\n')
    const stack = []           // { prefix, policy, depth }
    let depth = 0
    // Attributes seen on the current chain but not yet attached to a group.
    let pendingPrefix = null, pendingPolicy = null

    lines.forEach((line, idx) => {
      const code = line.replace(/\/\/.*$/, '').replace(/#.*$/, '')

      const pm = code.match(prefixRe)
      if (pm) pendingPrefix = pm[1]
      const wp = code.match(withPolicyRe)
      if (wp) pendingPolicy = wp[1]

      // Routes are emitted before depth bookkeeping so a group opened and closed on one line
      // still sees its own scope — merged with the enclosing group, which it inherits from.
      const openedHere = groupOpenRe.test(code)
      const parent = stack.length ? stack[stack.length - 1] : { prefix: null, policy: null }
      const scopePrefix = openedHere
        ? ([parent.prefix, pendingPrefix].filter(Boolean).map(p => p.replace(/^\/+|\/+$/g, '')).join('/') || null)
        : parent.prefix
      const scopePolicy = openedHere ? (pendingPolicy || parent.policy) : parent.policy

      let rm
      methodReG.lastIndex = 0
      while ((rm = methodReG.exec(code))) {
        const path = (rm[2] || '').replace(/^\/+|\/+$/g, '')
        const base = (scopePrefix || '').replace(/^\/+|\/+$/g, '')
        const full = base ? (path ? `${base}/${path}` : `${base}/`) : path
        const { cap, resolved } = resolveCapability(scopePolicy, edition, capTable)
        const loc = `${basename(root)}/${relative(root, file)}:${idx + 1}`
        if (!resolved) problems.push(`UNRESOLVED policy "${scopePolicy}" for ${rm[1].toUpperCase()} ${full} (${loc})`)
        routes.push({
          method: rm[1].toUpperCase(),
          path: full,
          handler: rm[3],
          prefix: scopePrefix || '(root)',
          policy: scopePolicy || null,
          capability: cap,
          edition,
          loc,
        })
      }

      // Brace bookkeeping last: count this line's net depth change, push/pop group scopes.
      for (const ch of code) {
        if (ch === '{') {
          depth++
          if (openedHere && (stack.length === 0 || stack[stack.length - 1].depth !== depth)) {
            // Nested groups inherit from the parent: prefixes concatenate and a group with no
            // withPolicy() of its own stays gated by the enclosing group's policy — matching
            // Router::executeGroupCallback() / buildUriWithPrefix().
            const parent = stack.length ? stack[stack.length - 1] : { prefix: null, policy: null }
            const mergedPrefix = [parent.prefix, pendingPrefix]
              .filter(Boolean).map(p => p.replace(/^\/+|\/+$/g, '')).join('/') || null
            stack.push({
              prefix: mergedPrefix,
              policy: pendingPolicy || parent.policy,
              depth,
            })
            pendingPrefix = null; pendingPolicy = null
          }
        } else if (ch === '}') {
          if (stack.length && stack[stack.length - 1].depth === depth) stack.pop()
          depth--
        }
      }
      if (!openedHere && !/->/.test(code)) { pendingPrefix = null; pendingPolicy = null }
    })
  }
}

const CAP_TABLE = {}
parsePolicies(FREE, 'free', CAP_TABLE)
parsePolicies(PRO, 'pro', CAP_TABLE)

scan(FREE, 'free', CAP_TABLE)
scan(PRO, 'pro', CAP_TABLE)

const free = routes.filter(r => r.edition === 'free')
const pro = routes.filter(r => r.edition === 'pro')
const publicRoutes = routes.filter(r => !r.policy)

// Routes that are genuinely public by design. Anything else without a policy is a defect —
// either in the plugin or in this parser — and must not be published as "PUBLIC" unnoticed.
const PUBLIC_ALLOWLIST = new Set([
  'GET bunny/storage/stream',
  'POST cloudflare-stream/webhook',
  'POST mux/webhook',
])
for (const r of publicRoutes) {
  const key = `${r.method} ${r.path}`
  if (!PUBLIC_ALLOWLIST.has(key)) {
    problems.push(`UNEXPECTED public route (no policy, not on allowlist): ${key} (${r.loc})`)
  }
}
for (const key of PUBLIC_ALLOWLIST) {
  if (!publicRoutes.some(r => `${r.method} ${r.path}` === key)) {
    problems.push(`Allowlisted public route no longer found: ${key} — it may have gained a policy, or the parser missed it`)
  }
}

// Group for the markdown report, keeping free and pro separate.
function tableFor(list) {
  const byPrefix = new Map()
  for (const r of list) {
    if (!byPrefix.has(r.prefix)) byPrefix.set(r.prefix, [])
    byPrefix.get(r.prefix).push(r)
  }
  let out = ''
  for (const [prefix, rs] of [...byPrefix.entries()].sort()) {
    const policies = [...new Set(rs.map(r => r.policy || 'NONE (public)'))].join(' / ')
    out += `### \`${prefix}\`  ·  policy: \`${policies}\`\n\n`
    out += `| Method | Path | Handler | Capability | Source |\n|---|---|---|---|---|\n`
    for (const r of rs) {
      out += `| ${r.method} | \`${r.path}\` | \`${r.handler}\` | ${r.capability} | \`${r.loc}\` |\n`
    }
    out += `\n`
  }
  return out
}

let md = `# FluentPlayer REST Routes — generated stub\n\n`
md += `_Generated from \`${FREE}\` and \`${PRO}\`._\n\n`
md += `**Base namespace:** \`/wp-json/fluent-player/v2/\` `
md += `(from \`config/app.php\` → \`rest_namespace\` + \`rest_version\`)\n\n`
md += `- **Free:** ${free.length} routes\n- **Pro:** ${pro.length} routes\n- **Total:** ${routes.length}\n\n`

if (publicRoutes.length) {
  md += `## ⚠️ Public routes (no policy — no capability check)\n\n`
  md += `| Method | Path | Handler | Edition | Source |\n|---|---|---|---|---|\n`
  for (const r of publicRoutes) {
    md += `| ${r.method} | \`${r.path}\` | \`${r.handler}\` | ${r.edition} | \`${r.loc}\` |\n`
  }
  md += `\n`
}

md += `## Free routes\n\n${tableFor(free)}`
md += `## Pro routes\n\n${tableFor(pro)}`

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'routes.json'), JSON.stringify(routes, null, 2))
writeFileSync(join(OUT, 'routes.md'), md)

console.log(`free=${free.length} pro=${pro.length} total=${routes.length} public=${publicRoutes.length}`)
console.log(`policies parsed: ${Object.keys(CAP_TABLE).length} — ${Object.entries(CAP_TABLE).map(([k, v]) => `${k}=${v}`).join(', ')}`)
console.log(`wrote ${join(OUT, 'routes.json')}`)
console.log(`wrote ${join(OUT, 'routes.md')}`)

// Fail loudly. A silent "unknown" in a markdown table looks like data; a non-zero exit does not.
if (problems.length) {
  console.error(`\n✖ ${problems.length} problem(s) — output written but NOT trustworthy:`)
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}
console.log('✓ every route resolved to a policy or an allowlisted public route')
