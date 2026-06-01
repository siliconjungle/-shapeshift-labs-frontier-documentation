import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderDocumentationBookHtml } from './browser.js';
import {
  createDocumentationId,
  createDocumentationManifest,
  createDocumentationProof,
  createDocumentationSearchRecords,
  formatDocumentationJsonl,
  resolveDocumentationIntegrationFlags,
  type FrontierDocumentationIntegrationFlags,
  type FrontierDocumentationManifest,
  type FrontierDocumentationManifestInput,
  type FrontierDocumentationPageInput,
  type FrontierDocumentationSource
} from './index.js';

export interface FrontierDocumentationDiscoveryOptions {
  rootDir?: string;
  include?: readonly string[];
  exclude?: readonly string[];
  packageName?: string;
  packageVersion?: string;
  title?: string;
  generatedAt?: number;
  integrations?: FrontierDocumentationIntegrationFlags;
  maxFiles?: number;
}

export interface FrontierDocumentationDiscoveredFile {
  file: string;
  absolutePath: string;
  kind: 'markdown' | 'package' | 'feature' | 'api';
  title: string;
  exports: string[];
}

export interface FrontierDocumentationDiscoveryDiagnostic {
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  file?: string;
}

export interface FrontierDocumentationDiscoveryResult {
  rootDir: string;
  manifest: FrontierDocumentationManifest;
  files: FrontierDocumentationDiscoveredFile[];
  diagnostics: FrontierDocumentationDiscoveryDiagnostic[];
}

export interface FrontierDocumentationWriteArtifactsOptions extends FrontierDocumentationDiscoveryOptions {
  outDir?: string;
  manifestFileName?: string;
  moduleFileName?: string;
  htmlFileName?: string;
  searchFileName?: string;
  evidenceFileName?: string;
  jsonlFileName?: string;
}

export interface FrontierDocumentationWrittenArtifact {
  kind: 'manifest' | 'module' | 'html' | 'search' | 'evidence' | 'jsonl';
  file: string;
}

export interface FrontierDocumentationWriteArtifactsResult extends FrontierDocumentationDiscoveryResult {
  outDir: string;
  artifacts: FrontierDocumentationWrittenArtifact[];
}

export interface FrontierDocumentationGenerateModuleOptions {
  manifestImport?: string;
}

export async function loadFrontierDocumentationConfig(cwd = process.cwd()): Promise<FrontierDocumentationDiscoveryOptions> {
  const rootDir = path.resolve(cwd);
  for (const file of ['frontier.docs.mjs', 'frontier.docs.js', 'frontier.config.mjs', 'frontier.config.js']) {
    const full = path.join(rootDir, file);
    if (!await exists(full)) continue;
    const mod = await import(pathToFileURL(full).href + '?t=' + Date.now());
    const value = mod.documentation ?? mod.docs ?? mod.default?.documentation ?? mod.default?.docs ?? mod.default;
    return value && typeof value === 'object' ? { rootDir, ...value } : { rootDir };
  }
  return { rootDir };
}

export async function discoverFrontierDocumentation(
  options: FrontierDocumentationDiscoveryOptions = {}
): Promise<FrontierDocumentationDiscoveryResult> {
  const loaded = options.rootDir ? options : { ...await loadFrontierDocumentationConfig(process.cwd()), ...options };
  const rootDir = path.resolve(loaded.rootDir ?? process.cwd());
  const integrations = resolveDocumentationIntegrationFlags(loaded.integrations);
  const packageInfo = await readPackageInfo(rootDir);
  const packageName = loaded.packageName ?? packageInfo.name;
  const packageVersion = loaded.packageVersion ?? packageInfo.version;
  const files = integrations.autoDiscovery === false ? [] : await collectDocumentationFiles(rootDir, loaded);
  const pages: FrontierDocumentationPageInput[] = [];
  const discovered: FrontierDocumentationDiscoveredFile[] = [];
  const diagnostics: FrontierDocumentationDiscoveryDiagnostic[] = [];
  for (const absolutePath of files) {
    const file = slash(path.relative(rootDir, absolutePath));
    const ext = path.extname(file).toLowerCase();
    const source = await fs.readFile(absolutePath, 'utf8');
    if (file === 'package.json') {
      const page = pageFromPackageJson(source, file, packageName);
      pages.push(page);
      discovered.push({ file, absolutePath, kind: 'package', title: page.title, exports: [] });
      continue;
    }
    if (file.startsWith('features/') && ext === '.json') {
      const page = pageFromFeatureJson(source, file, packageName);
      pages.push(page);
      discovered.push({ file, absolutePath, kind: 'feature', title: page.title, exports: [] });
      continue;
    }
    if (ext === '.md' || ext === '.mdx') {
      const page = pageFromMarkdown(source, file, packageName);
      pages.push(page);
      discovered.push({ file, absolutePath, kind: 'markdown', title: page.title, exports: [] });
      continue;
    }
    if (/\.[cm]?[jt]sx?$/.test(file) && !file.endsWith('.d.ts')) {
      const exports = extractApiExports(source);
      if (exports.length === 0) {
        diagnostics.push({
          severity: 'info',
          code: 'frontier-docs/no-api-exports',
          message: 'No public API exports were discovered in source file.',
          file
        });
        continue;
      }
      const page = pageFromApiSource(source, file, exports, packageName);
      pages.push(page);
      discovered.push({ file, absolutePath, kind: 'api', title: page.title, exports });
    }
  }
  const manifest = createDocumentationManifest({
    id: packageName ? `${packageName}.documentation` : 'frontier.documentation',
    package: packageName,
    version: packageVersion,
    title: loaded.title ?? (packageName ? `${titleFromPackage(packageName)} Docs` : 'Frontier Documentation'),
    generatedAt: loaded.generatedAt,
    pages,
    sources: discovered.map((file): FrontierDocumentationSource => ({ file: file.file, package: packageName })),
    integrations,
    tags: ['frontier-documentation', integrations.autoDiscovery ? 'auto-discovery' : 'manual-only'],
    metadata: {
      files: discovered.length,
      ...(packageName ? { package: packageName } : {})
    }
  } satisfies FrontierDocumentationManifestInput);
  return { rootDir, manifest, files: discovered, diagnostics };
}

export const discoverDocumentationSources = discoverFrontierDocumentation;

export async function writeDocumentationArtifacts(
  options: FrontierDocumentationWriteArtifactsOptions = {}
): Promise<FrontierDocumentationWriteArtifactsResult> {
  const result = await discoverFrontierDocumentation(options);
  const outDir = path.resolve(result.rootDir, options.outDir ?? '.frontier/docs');
  await fs.mkdir(outDir, { recursive: true });
  const manifestFile = path.join(outDir, options.manifestFileName ?? 'manifest.json');
  const moduleFile = path.join(outDir, options.moduleFileName ?? 'docs-module.mjs');
  const htmlFile = path.join(outDir, options.htmlFileName ?? 'index.html');
  const searchFile = path.join(outDir, options.searchFileName ?? 'search.json');
  const evidenceFile = path.join(outDir, options.evidenceFileName ?? 'evidence.json');
  const jsonlFile = path.join(outDir, options.jsonlFileName ?? 'documentation.jsonl');
  await fs.writeFile(manifestFile, JSON.stringify(result.manifest, null, 2) + '\n');
  await fs.writeFile(moduleFile, generateDocumentationModule(result.manifest));
  await fs.writeFile(htmlFile, renderDocumentationBookHtml(result.manifest));
  await fs.writeFile(searchFile, JSON.stringify(createDocumentationSearchRecords(result.manifest), null, 2) + '\n');
  await fs.writeFile(evidenceFile, JSON.stringify(createDocumentationProof(result.manifest), null, 2) + '\n');
  await fs.writeFile(jsonlFile, formatDocumentationJsonl(result.manifest));
  return {
    ...result,
    outDir,
    artifacts: [
      { kind: 'manifest', file: manifestFile },
      { kind: 'module', file: moduleFile },
      { kind: 'html', file: htmlFile },
      { kind: 'search', file: searchFile },
      { kind: 'evidence', file: evidenceFile },
      { kind: 'jsonl', file: jsonlFile }
    ]
  };
}

export function generateDocumentationModule(
  manifest: FrontierDocumentationManifest,
  options: FrontierDocumentationGenerateModuleOptions = {}
): string {
  return [
    `import { createDocumentationManifest } from ${JSON.stringify(options.manifestImport ?? '@shapeshift-labs/frontier-documentation')};`,
    '',
    `export const frontierDocumentationManifest = createDocumentationManifest(${JSON.stringify(manifest, null, 2)});`,
    'export default frontierDocumentationManifest;',
    ''
  ].join('\n');
}

export function extractApiExports(source: string): string[] {
  const names = new Set<string>();
  const patterns = [
    /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g,
    /export\s+class\s+([A-Za-z_$][\w$]*)\b/g,
    /export\s+interface\s+([A-Za-z_$][\w$]*)\b/g,
    /export\s+type\s+([A-Za-z_$][\w$]*)\b/g,
    /export\s+const\s+([A-Za-z_$][\w$]*)\b/g,
    /export\s*\{\s*([^}]+)\s*\}/g
  ];
  for (let i = 0; i < patterns.length - 1; i++) {
    let match: RegExpExecArray | null;
    while ((match = patterns[i].exec(source)) !== null) names.add(match[1]);
  }
  let match: RegExpExecArray | null;
  const namedExportPattern = patterns[patterns.length - 1];
  while ((match = namedExportPattern.exec(source)) !== null) {
    for (const part of match[1].split(',')) {
      const exported = part.trim().split(/\s+as\s+/i).pop()?.trim();
      if (exported && /^[A-Za-z_$][\w$]*$/.test(exported)) names.add(exported);
    }
  }
  return Array.from(names).filter((name) => name !== 'default').sort();
}

async function collectDocumentationFiles(
  rootDir: string,
  options: FrontierDocumentationDiscoveryOptions
): Promise<string[]> {
  const include = options.include?.length ? options.include : ['README.md', 'docs', 'features', 'src', 'app', 'packages'];
  const exclude = new Set([...(options.exclude ?? []), 'node_modules', 'dist', 'coverage', '.git', '.next', '.turbo', 'benchmarks/results']);
  const out: string[] = [];
  const maxFiles = options.maxFiles ?? 5000;
  for (const entry of include) {
    const start = path.resolve(rootDir, entry);
    if (!await exists(start)) continue;
    const stat = await fs.stat(start);
    if (stat.isDirectory()) await visit(start);
    else if (isDocumentationFile(start)) out.push(start);
    if (out.length >= maxFiles) break;
  }
  const packageJson = path.join(rootDir, 'package.json');
  if (await exists(packageJson) && !out.includes(packageJson)) out.unshift(packageJson);
  return out.slice(0, maxFiles).sort((a, b) => sortDocumentationFile(a, b, rootDir));

  async function visit(dir: string): Promise<void> {
    const relative = slash(path.relative(rootDir, dir));
    if (relative && shouldExclude(relative, exclude)) return;
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    for (const dirent of dirents) {
      const full = path.join(dir, dirent.name);
      const childRelative = slash(path.relative(rootDir, full));
      if (shouldExclude(childRelative, exclude)) continue;
      if (dirent.isDirectory()) await visit(full);
      else if (isDocumentationFile(full)) out.push(full);
      if (out.length >= maxFiles) return;
    }
  }
}

function pageFromPackageJson(source: string, file: string, packageName?: string): FrontierDocumentationPageInput {
  const json = parseJson(source);
  const scripts = json && typeof json === 'object' && 'scripts' in json && typeof json.scripts === 'object' && json.scripts
    ? Object.keys(json.scripts as Record<string, unknown>).sort()
    : [];
  const deps = json && typeof json === 'object' && 'dependencies' in json && typeof json.dependencies === 'object' && json.dependencies
    ? Object.keys(json.dependencies as Record<string, unknown>).sort()
    : [];
  return {
    id: 'package',
    title: 'Package',
    kind: 'overview',
    source: { file, package: packageName },
    summary: json && typeof json === 'object' && typeof (json as { description?: unknown }).description === 'string'
      ? (json as { description: string }).description
      : 'Generated package documentation.',
    sections: [
      { id: 'package.identity', title: 'Identity', content: `Package: ${packageName ?? 'unknown'}\nScripts: ${scripts.join(', ') || 'none'}` },
      { id: 'package.dependencies', title: 'Dependencies', content: deps.join('\n') || 'No runtime dependencies.' }
    ],
    tags: ['package', 'auto-generated']
  };
}

function pageFromFeatureJson(source: string, file: string, packageName?: string): FrontierDocumentationPageInput {
  const json = parseJson(source) as Record<string, unknown> | undefined;
  const title = typeof json?.feature === 'string' ? titleFromId(json.feature) : titleFromFile(file);
  const acceptance = Array.isArray(json?.acceptance) ? json.acceptance.map(String) : [];
  return {
    id: createDocumentationId(file),
    title,
    kind: 'reference',
    source: { file, package: packageName },
    summary: `Generated documentation from ${file}.`,
    sections: [
      { id: `${createDocumentationId(file)}.feature`, title: 'Feature', content: JSON.stringify(json ?? {}, null, 2), kind: 'frontier-manifest', language: 'json' },
      { id: `${createDocumentationId(file)}.acceptance`, title: 'Acceptance', content: acceptance.join('\n') || 'No acceptance criteria declared.' }
    ],
    tags: ['feature', 'manifest', 'auto-generated']
  };
}

function pageFromMarkdown(source: string, file: string, packageName?: string): FrontierDocumentationPageInput {
  const title = firstMarkdownHeading(source) ?? titleFromFile(file);
  return {
    id: createDocumentationId(file),
    title,
    kind: file.toLowerCase() === 'readme.md' ? 'overview' : 'guide',
    source: { file, package: packageName },
    summary: firstParagraph(source),
    sections: splitMarkdownSections(source, file),
    tags: ['markdown', 'auto-generated']
  };
}

function pageFromApiSource(
  source: string,
  file: string,
  exports: readonly string[],
  packageName?: string
): FrontierDocumentationPageInput {
  const id = createDocumentationId(file);
  return {
    id,
    title: titleFromFile(file),
    kind: 'api',
    source: { file, package: packageName },
    summary: `Generated API documentation for ${exports.length} exported symbol${exports.length === 1 ? '' : 's'}.`,
    api: exports,
    sections: [
      {
        id: `${id}.exports`,
        title: 'Exports',
        kind: 'api',
        content: exports.map((name) => `- ${name}`).join('\n')
      },
      {
        id: `${id}.source-summary`,
        title: 'Source Summary',
        kind: 'code',
        content: source.slice(0, 1200),
        code: source.slice(0, 1200),
        language: path.extname(file).replace('.', '') || 'ts'
      }
    ],
    tags: ['api', 'source', 'auto-generated']
  };
}

function splitMarkdownSections(source: string, file: string): FrontierDocumentationPageInput['sections'] {
  const rows = source.split(/\n(?=##\s+)/g);
  const idPrefix = createDocumentationId(file);
  return rows.map((section, index) => {
    const title = index === 0
      ? firstMarkdownHeading(section) ?? 'Overview'
      : section.match(/^##\s+(.+)$/m)?.[1]?.trim() ?? `Section ${index + 1}`;
    return {
      id: `${idPrefix}.section-${index + 1}`,
      title,
      kind: 'markdown',
      content: section.replace(/^#{1,6}\s+.+$/m, '').trim() || section.trim()
    };
  });
}

function isDocumentationFile(file: string): boolean {
  const ext = path.extname(file).toLowerCase();
  const base = path.basename(file);
  return ext === '.md' || ext === '.mdx' || ext === '.json' && (base === 'package.json' || file.includes(`${path.sep}features${path.sep}`)) || /\.[cm]?[jt]sx?$/.test(file);
}

function sortDocumentationFile(a: string, b: string, rootDir: string): number {
  const ra = slash(path.relative(rootDir, a));
  const rb = slash(path.relative(rootDir, b));
  const rank = (file: string) => file === 'package.json' ? 0 : file.toLowerCase() === 'readme.md' ? 1 : file.startsWith('docs/') ? 2 : file.startsWith('features/') ? 3 : 4;
  return rank(ra) - rank(rb) || ra.localeCompare(rb);
}

async function readPackageInfo(rootDir: string): Promise<{ name?: string; version?: string }> {
  const full = path.join(rootDir, 'package.json');
  if (!await exists(full)) return {};
  const json = parseJson(await fs.readFile(full, 'utf8')) as { name?: unknown; version?: unknown } | undefined;
  return {
    name: typeof json?.name === 'string' ? json.name : undefined,
    version: typeof json?.version === 'string' ? json.version : undefined
  };
}

function parseJson(source: string): unknown | undefined {
  try {
    return JSON.parse(source) as unknown;
  } catch {
    return undefined;
  }
}

function firstMarkdownHeading(source: string): string | undefined {
  return source.match(/^#\s+(.+)$/m)?.[1]?.trim();
}

function firstParagraph(source: string): string | undefined {
  return source
    .replace(/^#\s+.+$/m, '')
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .find((part) => part && !part.startsWith('#'));
}

function titleFromPackage(value: string): string {
  return value.split('/').pop()?.replace(/^frontier-/, 'Frontier ').replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) ?? value;
}

function titleFromFile(file: string): string {
  const base = path.basename(file).replace(/\.[^.]+$/, '');
  return titleFromId(base === 'README' ? path.basename(path.dirname(file)) || 'Overview' : base);
}

function titleFromId(value: string): string {
  return value.replace(/[-_.]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function shouldExclude(relative: string, exclude: Set<string>): boolean {
  const parts = relative.split('/');
  return parts.some((part) => exclude.has(part)) || exclude.has(relative);
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function slash(value: string): string {
  return value.replace(/\\/g, '/');
}
