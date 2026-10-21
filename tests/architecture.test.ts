import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Section 6 import table. src/sim is an allowlist. The other layers are
// denylists of the modules they must not import. Unit tests live next to
// source, so *.test.ts / *.spec.ts under src/sim may import vitest only.

const RPG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = join(RPG_ROOT, 'src')

const LAYERS = ['sim', 'content', 'harness', 'persist', 'ui'] as const
type Layer = (typeof LAYERS)[number]

type ImportHit = { spec: string; line: number }
type Resolved =
  | { kind: 'relative'; layer: Layer | null }
  | { kind: 'package' }

const NODE_BUILTINS = new Set([
  'assert',
  'buffer',
  'child_process',
  'cluster',
  'console',
  'constants',
  'crypto',
  'dgram',
  'diagnostics_channel',
  'dns',
  'domain',
  'events',
  'fs',
  'http',
  'http2',
  'https',
  'inspector',
  'module',
  'net',
  'os',
  'path',
  'perf_hooks',
  'process',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'string_decoder',
  'timers',
  'tls',
  'trace_events',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'wasi',
  'worker_threads',
  'zlib',
])

const SIM_API_RULES: { source: string; rule: string }[] = [
  { source: String.raw`Math\s*\.\s*random\b`, rule: 'src/sim must not use Math.random' },
  { source: String.raw`\bDate\b`, rule: 'src/sim must not use Date' },
  { source: String.raw`performance\s*\.\s*now\b`, rule: 'src/sim must not use performance.now' },
  { source: String.raw`\bconsole\b`, rule: 'src/sim must not use console' },
  { source: String.raw`\blocalStorage\b`, rule: 'src/sim must not use localStorage' },
  {
    source: String.raw`\b(?:sessionStorage|indexedDB)\b`,
    rule: 'src/sim must not use browser storage',
  },
  { source: String.raw`\bprocess\b`, rule: 'src/sim must not use process' },
  {
    source: String.raw`\b(?:document|window|navigator|XMLHttpRequest|HTMLElement|customElements|requestAnimationFrame)\b|\bfetch\s*\(`,
    rule: 'src/sim must not use DOM globals',
  },
]

const CONTENT_IO_RULES: { source: string; rule: string }[] = [
  { source: String.raw`\blocalStorage\b`, rule: 'src/content must not perform I/O' },
  { source: String.raw`\bsessionStorage\b`, rule: 'src/content must not perform I/O' },
  { source: String.raw`\bindexedDB\b`, rule: 'src/content must not perform I/O' },
  { source: String.raw`\bXMLHttpRequest\b`, rule: 'src/content must not perform I/O' },
  { source: String.raw`\bfetch\s*\(`, rule: 'src/content must not perform I/O' },
]

const SPECIFIER_PATTERNS = [
  /\bfrom\s+(['"])([^'"]+)\1/g,
  /\bimport\s+(['"])([^'"]+)\1/g,
  /\bimport\s*\(\s*(['"])([^'"]+)\1/g,
  /\brequire\s*\(\s*(['"])([^'"]+)\1/g,
]

function isLayer(value: string): value is Layer {
  return (LAYERS as readonly string[]).includes(value)
}

function displayPath(absFile: string): string {
  return relative(RPG_ROOT, absFile).replaceAll('\\', '/')
}

function isTestFile(absFile: string): boolean {
  return /\.(?:test|spec)\.tsx?$/.test(absFile)
}

function lineAt(source: string, index: number): number {
  let line = 1
  for (let i = 0; i < index && i < source.length; i += 1) {
    if (source.charCodeAt(i) === 10) line += 1
  }
  return line
}

function maskComments(source: string): string {
  const chars = source.split('')
  const length = chars.length
  let i = 0
  while (i < length) {
    const current = chars[i]
    const next = chars[i + 1]
    if (current === '/' && next === '/') {
      while (i < length && chars[i] !== '\n') {
        chars[i] = ' '
        i += 1
      }
      continue
    }
    if (current === '/' && next === '*') {
      chars[i] = ' '
      chars[i + 1] = ' '
      i += 2
      while (i < length && !(chars[i] === '*' && chars[i + 1] === '/')) {
        if (chars[i] !== '\n') chars[i] = ' '
        i += 1
      }
      if (i < length) {
        chars[i] = ' '
        if (i + 1 < length) chars[i + 1] = ' '
        i += 2
      }
      continue
    }
    if (current === "'" || current === '"' || current === '`') {
      const quote = current
      i += 1
      while (i < length) {
        if (chars[i] === '\\') {
          i += 2
          continue
        }
        if (chars[i] === quote) {
          i += 1
          break
        }
        i += 1
      }
      continue
    }
    i += 1
  }
  return chars.join('')
}

function importSpecifiers(source: string): ImportHit[] {
  const hits: ImportHit[] = []
  const seen = new Set<number>()
  for (const pattern of SPECIFIER_PATTERNS) {
    const re = new RegExp(pattern.source, 'g')
    for (const match of source.matchAll(re)) {
      const index = match.index ?? 0
      const spec = match[2]
      if (spec === undefined || seen.has(index)) continue
      seen.add(index)
      hits.push({ spec, line: lineAt(source, index) })
    }
  }
  hits.sort((a, b) => a.line - b.line || a.spec.localeCompare(b.spec))
  return hits
}

function layerOfRelative(relFromSrc: string): Layer | null {
  const top = relFromSrc.replaceAll('\\', '/').split('/')[0] ?? ''
  return isLayer(top) ? top : null
}

function layerOfFile(absFile: string): Layer | null {
  return layerOfRelative(relative(SRC_DIR, absFile))
}

function resolveSpecifier(fromFile: string, spec: string): Resolved {
  if (!spec.startsWith('.')) return { kind: 'package' }
  const abs = resolve(dirname(fromFile), spec)
  const rel = relative(SRC_DIR, abs)
  if (rel.startsWith('..') || rel.startsWith('/') || /^[A-Za-z]:/.test(rel)) {
    return { kind: 'relative', layer: null }
  }
  return { kind: 'relative', layer: layerOfRelative(rel) }
}

function isReactSpecifier(spec: string): boolean {
  return (
    spec === 'react' ||
    spec.startsWith('react/') ||
    spec === 'react-dom' ||
    spec.startsWith('react-dom/')
  )
}

function isNodeSpecifier(spec: string): boolean {
  if (spec.startsWith('node:')) return true
  const name = spec.split('/')[0] ?? spec
  return NODE_BUILTINS.has(name)
}

function isIoSpecifier(spec: string): boolean {
  const bare = spec.startsWith('node:') ? spec.slice('node:'.length) : spec
  return /^(?:fs|https?|http2|net|dgram|child_process|readline|tls|dns)(?:\/|$)/.test(bare)
}

function isVitestSpecifier(spec: string): boolean {
  return spec === 'vitest' || spec.startsWith('vitest/')
}

function forbidden(spec: string, rule: string): string {
  return `${rule} (forbidden import '${spec}')`
}

function importRule(layer: Layer, absFile: string, spec: string): string | null {
  const resolved = resolveSpecifier(absFile, spec)
  const resolvedLayer = resolved.kind === 'relative' ? resolved.layer : null

  if (layer === 'sim') {
    if (resolvedLayer === 'sim') return null
    if (isTestFile(absFile) && isVitestSpecifier(spec)) return null
    if (isReactSpecifier(spec)) return forbidden(spec, 'src/sim must not import React')
    if (isNodeSpecifier(spec)) return forbidden(spec, 'src/sim must not import node:* or process')
    if (spec === 'localStorage') return forbidden(spec, 'src/sim must not import localStorage')
    if (resolvedLayer !== null) return forbidden(spec, `src/sim must not import src/${resolvedLayer}`)
    return forbidden(spec, 'src/sim may import only other src/sim files')
  }

  if (layer === 'content') {
    if (resolvedLayer === 'ui' || isReactSpecifier(spec)) {
      return forbidden(spec, 'src/content must not import UI')
    }
    if (resolvedLayer === 'persist') return forbidden(spec, 'src/content must not import persistence')
    if (resolvedLayer === 'harness') return forbidden(spec, 'src/content must not import harness')
    if (isIoSpecifier(spec)) return forbidden(spec, 'src/content must not perform I/O')
    return null
  }

  if (layer === 'harness') {
    if (resolvedLayer === 'ui') return forbidden(spec, 'src/harness must not import src/ui')
    if (resolvedLayer === 'persist') return forbidden(spec, 'src/harness must not import src/persist')
    return null
  }

  if (layer === 'persist') {
    if (resolvedLayer === 'ui') return forbidden(spec, 'src/persist must not import src/ui')
    if (resolvedLayer === 'harness') return forbidden(spec, 'src/persist must not import src/harness')
    return null
  }

  if (resolvedLayer === 'harness') return forbidden(spec, 'src/ui must not import src/harness')
  return null
}

function apiHits(source: string, rules: { source: string; rule: string }[]): { line: number; rule: string }[] {
  const hits: { line: number; rule: string }[] = []
  for (const apiRule of rules) {
    const re = new RegExp(apiRule.source, 'g')
    for (const match of source.matchAll(re)) {
      hits.push({ line: lineAt(source, match.index ?? 0), rule: apiRule.rule })
    }
  }
  return hits
}

function walkTsFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkTsFiles(full))
      continue
    }
    if (!entry.isFile()) continue
    if (entry.name.endsWith('.d.ts')) continue
    if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) files.push(full)
  }
  return files
}

function checkFile(absFile: string, text: string): { layer: Layer | null; specs: string[]; violations: string[] } {
  const display = displayPath(absFile)
  const layer = layerOfFile(absFile)
  const masked = maskComments(text)
  const imports = importSpecifiers(masked)
  const violations: string[] = []

  if (layer !== null) {
    for (const hit of imports) {
      const rule = importRule(layer, absFile, hit.spec)
      if (rule !== null) violations.push(`${display}:${hit.line}: ${rule}`)
    }
    const apiRules = layer === 'sim' ? SIM_API_RULES : layer === 'content' ? CONTENT_IO_RULES : []
    for (const hit of apiHits(masked, apiRules)) {
      violations.push(`${display}:${hit.line}: ${hit.rule}`)
    }
  }

  return { layer, specs: imports.map((hit) => hit.spec), violations }
}

describe('architecture boundaries', () => {
  it('checks each existing src layer against the section 6 import table', () => {
    if (!existsSync(SRC_DIR)) {
      throw new Error(`[DEBUG architecture] src directory not found: ${SRC_DIR}`)
    }

    const files = walkTsFiles(SRC_DIR).sort()
    console.log(`[DEBUG architecture] input src=${SRC_DIR} files=${files.length}`)

    const counts: Record<Layer | 'none', number> = {
      sim: 0,
      content: 0,
      harness: 0,
      persist: 0,
      ui: 0,
      none: 0,
    }
    const violations: string[] = []

    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      const result = checkFile(file, text)
      counts[result.layer ?? 'none'] += 1
      console.log(
        `[DEBUG architecture] file=${displayPath(file)} layer=${result.layer ?? 'none'} imports=${JSON.stringify(result.specs)} violations=${result.violations.length}`,
      )
      for (const violation of result.violations) {
        console.log(`[DEBUG architecture] violation ${violation}`)
      }
      violations.push(...result.violations)
    }

    console.log('[DEBUG architecture] layer counts', counts)
    console.log(`[DEBUG architecture] output violations=${violations.length}`)
    expect(files.length).toBeGreaterThan(0)
    expect(violations).toEqual([])
  })
})
