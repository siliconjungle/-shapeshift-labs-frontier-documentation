#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { renderDocumentationBookHtml } from './browser.js';
import {
  discoverFrontierDocumentation,
  writeDocumentationArtifacts
} from './node.js';
import {
  createDocumentationAgentRunbook,
  createDocumentationBenchmarkPlan,
  createDocumentationBrowserEvidencePlan,
  createDocumentationFuzzCases,
  createDocumentationHarnessManifest,
  lintDocumentationManifest
} from './harness.js';
import {
  createDocumentationProof,
  formatDocumentationJsonl,
  resolveDocumentationIntegrationFlags,
  type FrontierDocumentationIntegrationFlags
} from './index.js';

interface CliArgs {
  command: string;
  cwd: string;
  out?: string;
  json: boolean;
  cases?: number;
  integrations: FrontierDocumentationIntegrationFlags;
}

if (isCliEntrypoint()) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

export async function main(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  if (args.command === 'help' || args.command === '--help' || args.command === '-h') {
    printHelp();
    return;
  }
  if (args.command === 'build' || args.command === 'dev') {
    const result = await writeDocumentationArtifacts({
      rootDir: args.cwd,
      outDir: args.out,
      integrations: args.integrations
    });
    print(args, {
      ok: true,
      command: args.command,
      manifestId: result.manifest.id,
      pages: result.manifest.pages.length,
      outDir: result.outDir,
      artifacts: result.artifacts
    });
    return;
  }
  const result = await discoverFrontierDocumentation({ rootDir: args.cwd, integrations: args.integrations });
  if (args.command === 'discover' || args.command === 'inspect') {
    const lint = lintDocumentationManifest(result.manifest);
    print(args, {
      ok: lint.ok,
      manifest: result.manifest,
      diagnostics: [...result.diagnostics, ...lint.diagnostics],
      proof: createDocumentationProof(result.manifest)
    });
    return;
  }
  if (args.command === 'lint') {
    const lint = lintDocumentationManifest(result.manifest);
    print(args, { ...lint, ok: lint.ok });
    return;
  }
  if (args.command === 'test') {
    print(args, {
      ok: true,
      manifest: createDocumentationHarnessManifest(result.manifest, { integrations: args.integrations }),
      browserEvidence: createDocumentationBrowserEvidencePlan(result.manifest, { integrations: args.integrations }),
      runbook: createDocumentationAgentRunbook(result.manifest, { integrations: args.integrations })
    });
    return;
  }
  if (args.command === 'fuzz') {
    print(args, {
      ok: true,
      cases: createDocumentationFuzzCases(result.manifest, {
        casesPerPage: args.cases,
        integrations: args.integrations
      })
    });
    return;
  }
  if (args.command === 'bench') {
    const start = performance.now();
    const html = renderDocumentationBookHtml(result.manifest, { integrations: args.integrations });
    const renderMs = performance.now() - start;
    print(args, {
      ok: true,
      plan: createDocumentationBenchmarkPlan(result.manifest, { integrations: args.integrations }),
      measures: {
        pages: result.manifest.pages.length,
        htmlBytes: Buffer.byteLength(html),
        renderMs
      }
    });
    return;
  }
  if (args.command === 'jsonl') {
    await writeStdout(formatDocumentationJsonl(result.manifest));
    return;
  }
  throw new Error(`unknown command: ${args.command}`);
}

function isCliEntrypoint(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  const modulePath = fileURLToPath(import.meta.url);
  let entryPath = entry;
  try {
    entryPath = realpathSync(entry);
  } catch {
    entryPath = path.resolve(entry);
  }
  return path.resolve(entryPath) === path.resolve(modulePath);
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    command: argv[0] ?? 'help',
    cwd: process.cwd(),
    json: false,
    integrations: {}
  };
  for (let index = 1; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--cwd') args.cwd = path.resolve(readNext(argv, ++index, arg));
    else if (arg === '--out') args.out = readNext(argv, ++index, arg);
    else if (arg === '--json') args.json = true;
    else if (arg === '--cases') args.cases = Number(readNext(argv, ++index, arg));
    else if (arg === '--disable') disableFlags(args.integrations, readNext(argv, ++index, arg));
    else if (arg.startsWith('--no-')) setFlag(args.integrations, arg.slice('--no-'.length), false);
    else throw new Error(`unknown argument: ${arg}`);
  }
  args.integrations = resolveDocumentationIntegrationFlags(args.integrations);
  return args;
}

function disableFlags(flags: FrontierDocumentationIntegrationFlags, value: string): void {
  for (const part of value.split(',')) setFlag(flags, part.trim(), false);
}

function setFlag(flags: FrontierDocumentationIntegrationFlags, name: string, value: boolean): void {
  const key = name.replace(/-([a-z])/g, (_match, char: string) => char.toUpperCase()) as keyof FrontierDocumentationIntegrationFlags;
  if (key in resolveDocumentationIntegrationFlags()) {
    flags[key] = value;
    return;
  }
  throw new Error(`unknown integration flag: ${name}`);
}

function readNext(argv: string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value) throw new Error(`${flag} requires a value`);
  return value;
}

function print(args: CliArgs, value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

async function writeStdout(value: string): Promise<void> {
  await fs.writeFile('/dev/stdout', value);
}

function printHelp(): void {
  console.log(`frontier-docs

Commands:
  discover   discover package, markdown, feature, and API documentation
  build      write .frontier/docs manifest, module, search, evidence, JSONL, and HTML
  dev        same generated artifacts as build, intended for framework dev mode
  lint       validate documentation manifest quality
  test       print Frontier documentation test/browser evidence plans
  fuzz       print generated documentation fuzz cases
  bench      print documentation benchmark plan and render timing
  jsonl      print documentation manifest and harness rows as JSONL

Options:
  --cwd <dir>                project root
  --out <dir>                output directory for build/dev
  --json                     print JSON
  --cases <n>                fuzz cases per page
  --disable <a,b>            disable integration flags
  --no-inspector             disable the floating inspector bridge
  --no-telemetry             disable telemetry requirements
  --no-fuzz                  disable generated fuzz plans
  --no-benchmarks            disable benchmark plans
`);
}
