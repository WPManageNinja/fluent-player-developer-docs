#!/usr/bin/env node
// Golden-file + adversarial tests for the two extractors.
//
// These exist because a code review found both scripts degraded QUIETLY: an unresolvable policy
// became the string "unknown" in a markdown table, and a dynamically-dispatched hook was dropped
// with no trace. Both produced plausible-looking output that was wrong, and nothing caught it.
//
// The adversarial route fixture below reproduces four real scoping bugs the original
// line-oriented scanner had — three of which mislabelled capability-gated routes as PUBLIC.
//
// Usage: npm test

import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const BIN = dirname(fileURLToPath(import.meta.url))
const ROOT = dirname(BIN)
const GEN = join(ROOT, '_generated')

let failures = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(`  ${ok ? '✓' : '✗'} ${label}${ok ? '' : `\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`}`)
  if (!ok) failures++
}

function run(script, args = []) {
  try {
    return { out: execFileSync('node', [join(BIN, script), ...args], { encoding: 'utf8' }), code: 0 }
  } catch (e) {
    return { out: (e.stdout || '') + (e.stderr || ''), code: e.status ?? 1 }
  }
}

// ── 1. Hooks: golden counts against the real repos ────────────────────────────
console.log('\nextract-hooks.mjs — golden counts')
const hooksRun = run('extract-hooks.mjs')
check('exits 0 (no unaccounted dynamic dispatch)', hooksRun.code, 0)

const hooks = JSON.parse(readFileSync(join(GEN, 'hooks.json'), 'utf8'))
const free = hooks.filter(h => h.free)
const proOnly = hooks.filter(h => !h.free && h.pro)
const byType = (list, t) => list.filter(h => h.type === t).length

check('free actions', byType(free, 'action'), 15)
check('free filters', byType(free, 'filter'), 77)
check('pro-only actions', byType(proOnly, 'action'), 8)
check('pro-only filters', byType(proOnly, 'filter'), 12)
check('total distinct', hooks.length, 112)

// The two dynamically-dispatched actions the old extractor silently dropped.
for (const name of ['fluent_player/media_milestone', 'fluent_player/layer_event']) {
  check(`${name} present`, !!hooks.find(h => h.name === name), true)
}
// Edition means DISPATCHED BY. Pro subscribing to daily_cleanup must not make it "both".
const cleanup = hooks.find(h => h.name === 'fluent_player/daily_cleanup')
check('daily_cleanup is free-only (Pro subscribes, does not dispatch)', [cleanup?.free, cleanup?.pro], [true, false])
check('exactly 4 re-dispatched (both) hooks', hooks.filter(h => h.free && h.pro).length, 4)
check('interpolated name flagged dynamic', hooks.filter(h => h.dynamic).map(h => h.name), ['fluent_player/settings_section/{$section}'])

// ── 2. Hooks: a commented-out dispatch must not become a documented hook ──────
console.log('\nextract-hooks.mjs — comment handling')
const hookTmp = mkdtempSync(join(tmpdir(), 'flp-hooks-'))
mkdirSync(join(hookTmp, 'app'), { recursive: true })
writeFileSync(join(hookTmp, 'app', 'x.php'), `<?php
/* do_action('fluent_player/in_block_comment', $x); */
// apply_filters('fluent_player/in_line_comment', $y);
do_action('fluent_player/genuinely_live', $z);
`)
run('extract-hooks.mjs', [hookTmp, join(hookTmp, 'nope')])
// MANUAL entries are injected unconditionally (they describe the real repos), so filter them
// out — this case is only about what the SCANNER picks up from source.
const MANUAL_NAMES = ['fluent_player/daily_cleanup', 'fluent_player/media_milestone', 'fluent_player/layer_event']
const scanned = JSON.parse(readFileSync(join(GEN, 'hooks.json'), 'utf8'))
  .map(h => h.name).filter(n => !MANUAL_NAMES.includes(n))
check('commented-out dispatches excluded', scanned, ['fluent_player/genuinely_live'])
rmSync(hookTmp, { recursive: true, force: true })

// ── 3. Routes: adversarial group scoping ──────────────────────────────────────
// Every case here silently produced WRONG output before the brace-depth rewrite.
console.log('\nextract-routes.mjs — adversarial group scoping')
const rt = mkdtempSync(join(tmpdir(), 'flp-routes-'))
mkdirSync(join(rt, 'app/Http/Routes'), { recursive: true })
mkdirSync(join(rt, 'app/Http/Policies'), { recursive: true })
writeFileSync(join(rt, 'app/Http/Routes/api.php'), `<?php
$router->prefix('media')->withPolicy('MediaPolicy')->group(function ($router) {
    $router->get('one', 'C@one');
    add_filter('some_hook', function () { return 1;
    });
    $router->get('two', 'C@two');
});
$router->prefix('inline')->withPolicy('SettingsPolicy')->group(function ($router) { $router->get('three', 'C@three'); });
$router->prefix('outer')->withPolicy('SettingsPolicy')->group(function ($router) {
    $router->prefix('inner')->group(function ($router) { $router->get('four', 'C@four'); });
    $router->get('five', 'C@five');
});
`)
writeFileSync(join(rt, 'app/Http/Policies/MediaPolicy.php'),
  '<?php class MediaPolicy { public function verifyRequest($r){ return current_user_can(Helper::authoringCapability()); } }')
writeFileSync(join(rt, 'app/Http/Policies/SettingsPolicy.php'),
  '<?php class SettingsPolicy { public function verifyRequest($r){ return current_user_can("manage_options"); } }')

run('extract-routes.mjs', [rt, join(rt, 'nope')])
const rr = JSON.parse(readFileSync(join(GEN, 'routes.json'), 'utf8'))
const shape = rr.map(r => `${r.method} ${r.path} ${r.capability}`)
check('closure inside group does not end the group', shape, [
  'GET media/one edit_others_posts',
  'GET media/two edit_others_posts',          // was: PUBLIC (wrong)
  'GET inline/three manage_options',          // was: dropped entirely
  'GET outer/inner/four manage_options',      // was: inner/four PUBLIC (wrong path + policy)
  'GET outer/five manage_options',            // was: PUBLIC (wrong)
])
rmSync(rt, { recursive: true, force: true })

// ── 4. Routes: golden counts against the real repos ───────────────────────────
console.log('\nextract-routes.mjs — golden counts')
const routesRun = run('extract-routes.mjs')
check('exits 0 (every policy resolved, public routes allowlisted)', routesRun.code, 0)

const routes = JSON.parse(readFileSync(join(GEN, 'routes.json'), 'utf8'))
check('free routes', routes.filter(r => r.edition === 'free').length, 45)
check('pro routes', routes.filter(r => r.edition === 'pro').length, 102)
check('public routes', routes.filter(r => !r.policy).length, 3)
check('no unresolved capabilities', routes.filter(r => r.capability === 'UNRESOLVED').length, 0)
check('no double-slash paths', routes.filter(r => r.path.includes('//')).length, 0)
// The Mux prefix deliberately spans two capability tiers — collapsing them would hide that
// signing-key routes are admin-only while media ops are Editor-level.
check('mux capability split preserved',
  [...new Set(routes.filter(r => r.prefix === 'mux').map(r => r.capability))].sort(),
  ['edit_others_posts', 'manage_options'])

// The fixture runs above write to _generated/, which the docs are built from. Restore it to
// the real repos' output so `npm test` is side-effect free and never leaves a fixture's
// 4-hook file where the site expects 112.
console.log('\nrestoring _generated/ from the real repos')
const restoreHooks = run('extract-hooks.mjs')
const restoreRoutes = run('extract-routes.mjs')
check('hooks.json restored', JSON.parse(readFileSync(join(GEN, 'hooks.json'), 'utf8')).length, 112)
check('routes.json restored', JSON.parse(readFileSync(join(GEN, 'routes.json'), 'utf8')).length, 147)
check('both extractors clean on restore', [restoreHooks.code, restoreRoutes.code], [0, 0])

console.log(failures ? `\n✖ ${failures} check(s) failed\n` : '\n✓ all checks passed\n')
process.exit(failures ? 1 : 0)
