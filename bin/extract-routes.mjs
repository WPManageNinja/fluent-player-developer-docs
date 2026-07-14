#!/usr/bin/env node
// Extracts REST routes from the plugin's app/Http/Routes/*.php (WPFluent router).
// Tracks the current prefix + policy from `->prefix('x')->withPolicy('Y')->group(...)`
// and assigns each `->get/post/put/delete('path','Controller@method')` to it.
//
// Usage:
//   node bin/extract-routes.mjs [pluginPath]

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const PLUGIN = process.argv[2] || '/Volumes/Projects/work/forms/wp-content/plugins/fluent-player'
const ROUTES = join(PLUGIN, 'app/Http/Routes')
const OUT = join(process.cwd(), '_generated')

const groups = new Map() // prefix -> { prefix, policy, routes: [{method,path,handler,loc}] }
const files = existsSync(ROUTES)
  ? readdirSync(ROUTES).filter(f => f.endsWith('.php') && f !== 'index.php')
  : []

const prefixRe = /->prefix\(\s*['"]([^'"]+)['"]\s*\)(?:\s*->withPolicy\(\s*['"]([^'"]+)['"]\s*\))?/
const withPolicyRe = /->withPolicy\(\s*['"]([^'"]+)['"]\s*\)/
const methodRe = /->(get|post|put|delete|patch)\(\s*['"]([^'"]*)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/

for (const f of files) {
  const file = join(ROUTES, f)
  const lines = readFileSync(file, 'utf8').split('\n')
  let current = null
  lines.forEach((line, idx) => {
    const pm = line.match(prefixRe)
    if (pm) {
      const prefix = pm[1]
      const policy = pm[2] || (line.match(withPolicyRe)?.[1]) || '—'
      if (!groups.has(prefix)) groups.set(prefix, { prefix, policy, routes: [] })
      current = groups.get(prefix)
      if (policy !== '—') current.policy = policy
      return
    }
    const rm = line.match(methodRe)
    if (rm && current) {
      current.routes.push({
        method: rm[1].toUpperCase(),
        path: rm[2] || '/',
        handler: rm[3],
        loc: `${relative(PLUGIN, file)}:${idx + 1}`,
      })
    }
  })
}

const all = [...groups.values()].sort((a, b) => a.prefix.localeCompare(b.prefix))
const total = all.reduce((n, g) => n + g.routes.length, 0)

let md = `# FluentPlayer REST Routes — generated stub\n\n`
md += `_Generated from \`${relative(process.cwd(), ROUTES)}\`. ${all.length} groups, ${total} routes._\n\n`
for (const g of all) {
  md += `## \`${g.prefix}\`  ·  policy: \`${g.policy}\`\n\n`
  md += `| Method | Path | Handler | Source |\n|---|---|---|---|\n`
  for (const r of g.routes) {
    md += `| ${r.method} | \`${r.path}\` | \`${r.handler}\` | \`${r.loc}\` |\n`
  }
  md += `\n`
}

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'routes.json'), JSON.stringify(all, null, 2))
writeFileSync(join(OUT, 'routes.md'), md)

console.log(`groups=${all.length} routes=${total}`)
console.log(`wrote ${join(OUT, 'routes.json')}`)
console.log(`wrote ${join(OUT, 'routes.md')}`)
