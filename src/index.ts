import type { JsonObject, JsonValue } from '@shapeshift-labs/frontier';
import { cloneJson } from '@shapeshift-labs/frontier/clone';
import {
  createFrontierRegistryGraph,
  normalizeFrontierRegistryPath,
  type FrontierRegistryEdge,
  type FrontierRegistryEntry,
  type FrontierRegistryGraph,
  type FrontierRegistryPath,
  type FrontierRegistrySource
} from '@shapeshift-labs/frontier/registry';

export const FRONTIER_DOCUMENTATION_MANIFEST_KIND = 'frontier.documentation.manifest';
export const FRONTIER_DOCUMENTATION_MANIFEST_VERSION = 1;
export const FRONTIER_DOCUMENTATION_HARNESS_KIND = 'frontier.documentation.harness-plan';
export const FRONTIER_DOCUMENTATION_HARNESS_VERSION = 1;
export const FRONTIER_DOCUMENTATION_PROOF_KIND = 'frontier.documentation.proof';
export const FRONTIER_DOCUMENTATION_PROOF_VERSION = 1;
export const FRONTIER_DOCUMENTATION_PACKAGE_NAME = '@shapeshift-labs/frontier-documentation';

export type FrontierDocumentationPageKind =
  | 'overview'
  | 'guide'
  | 'api'
  | 'component'
  | 'route'
  | 'state'
  | 'migration'
  | 'policy'
  | 'workflow'
  | 'test'
  | 'benchmark'
  | 'decision'
  | 'reference'
  | string;

export type FrontierDocumentationSectionKind =
  | 'markdown'
  | 'api'
  | 'example'
  | 'frontier-manifest'
  | 'evidence'
  | 'diagram'
  | 'code'
  | string;

export type FrontierDocumentationEvidenceKind =
  | 'docs'
  | 'lint'
  | 'browser'
  | 'fuzz'
  | 'benchmark'
  | 'trace'
  | 'telemetry'
  | 'coverage'
  | string;

export type FrontierDocumentationDiagnosticSeverity = 'info' | 'warning' | 'error';

export interface FrontierDocumentationSource {
  file: string;
  package?: string;
  exportName?: string;
  symbol?: string;
  line?: number;
  column?: number;
  hash?: string;
}

export interface FrontierDocumentationSectionInput {
  id?: string;
  title?: string;
  kind?: FrontierDocumentationSectionKind;
  content?: string;
  markdown?: string;
  source?: string | FrontierDocumentationSource;
  anchors?: readonly string[];
  code?: string;
  language?: string;
  metadata?: JsonObject;
}

export interface FrontierDocumentationSection {
  id: string;
  title: string;
  kind: FrontierDocumentationSectionKind;
  content: string;
  source?: FrontierDocumentationSource;
  anchors: string[];
  code?: string;
  language?: string;
  metadata?: JsonObject;
}

export interface FrontierDocumentationEvidenceInput {
  id?: string;
  kind?: FrontierDocumentationEvidenceKind;
  title?: string;
  command?: string;
  files?: readonly string[];
  pages?: readonly string[];
  assertions?: readonly string[];
  telemetry?: readonly string[];
  traces?: readonly string[];
  metadata?: JsonObject;
}

export interface FrontierDocumentationEvidence {
  id: string;
  kind: FrontierDocumentationEvidenceKind;
  title?: string;
  command?: string;
  files: string[];
  pages: string[];
  assertions: string[];
  telemetry: string[];
  traces: string[];
  metadata?: JsonObject;
}

export interface FrontierDocumentationPageInput {
  id?: string;
  title: string;
  kind?: FrontierDocumentationPageKind;
  route?: string;
  source?: string | FrontierDocumentationSource;
  package?: string;
  feature?: string;
  owner?: string;
  summary?: string;
  sections?: readonly FrontierDocumentationSectionInput[];
  examples?: readonly string[];
  api?: readonly string[];
  states?: readonly FrontierRegistryPath[];
  routes?: readonly string[];
  migrations?: readonly string[];
  tests?: readonly string[];
  benchmarks?: readonly string[];
  evidence?: readonly FrontierDocumentationEvidenceInput[];
  tags?: readonly string[];
  metadata?: JsonObject;
}

export interface FrontierDocumentationPage {
  id: string;
  title: string;
  kind: FrontierDocumentationPageKind;
  route: string;
  source?: FrontierDocumentationSource;
  package?: string;
  feature?: string;
  owner?: string;
  summary?: string;
  sections: FrontierDocumentationSection[];
  examples: string[];
  api: string[];
  states: string[];
  routes: string[];
  migrations: string[];
  tests: string[];
  benchmarks: string[];
  evidence: FrontierDocumentationEvidence[];
  tags: string[];
  metadata?: JsonObject;
}

export interface FrontierDocumentationNavigationInput {
  id?: string;
  title: string;
  pages?: readonly string[];
  groups?: readonly FrontierDocumentationNavigationInput[];
  metadata?: JsonObject;
}

export interface FrontierDocumentationNavigation {
  id: string;
  title: string;
  pages: string[];
  groups: FrontierDocumentationNavigation[];
  metadata?: JsonObject;
}

export interface FrontierDocumentationIntegrationFlags {
  autoDiscovery?: boolean;
  packageCatalog?: boolean;
  apiReference?: boolean;
  guideBook?: boolean;
  browserBook?: boolean;
  inspector?: boolean;
  componentPreview?: boolean;
  routeDocs?: boolean;
  stateDocs?: boolean;
  migrationDocs?: boolean;
  telemetry?: boolean;
  browserEvidence?: boolean;
  fuzz?: boolean;
  benchmarks?: boolean;
  searchIndex?: boolean;
  agentEvidence?: boolean;
}

export interface FrontierDocumentationManifestInput {
  id?: string;
  generatedAt?: number;
  package?: string;
  title?: string;
  version?: string;
  basePath?: string;
  pages?: readonly FrontierDocumentationPageInput[];
  navigation?: readonly FrontierDocumentationNavigationInput[];
  sources?: readonly FrontierDocumentationSource[];
  integrations?: FrontierDocumentationIntegrationFlags;
  tags?: readonly string[];
  metadata?: JsonObject;
}

export interface FrontierDocumentationManifest {
  kind: typeof FRONTIER_DOCUMENTATION_MANIFEST_KIND;
  version: typeof FRONTIER_DOCUMENTATION_MANIFEST_VERSION;
  id: string;
  generatedAt: number;
  package?: string;
  title: string;
  packageVersion?: string;
  basePath: string;
  pages: FrontierDocumentationPage[];
  navigation: FrontierDocumentationNavigation[];
  sources: FrontierDocumentationSource[];
  integrations: Required<FrontierDocumentationIntegrationFlags>;
  tags: string[];
  metadata?: JsonObject;
}

export interface FrontierDocumentationDiagnostic {
  severity: FrontierDocumentationDiagnosticSeverity;
  code: string;
  message: string;
  page?: string;
  section?: string;
  file?: string;
  fix?: string;
}

export interface FrontierDocumentationSearchRecord {
  id: string;
  page: string;
  title: string;
  route: string;
  text: string;
  tags: string[];
  source?: FrontierDocumentationSource;
  score: number;
}

export interface FrontierDocumentationProof {
  kind: typeof FRONTIER_DOCUMENTATION_PROOF_KIND;
  version: typeof FRONTIER_DOCUMENTATION_PROOF_VERSION;
  manifestId: string;
  generatedAt: number;
  digest: string;
  pages: number;
  sections: number;
  evidence: number;
  integrations: Required<FrontierDocumentationIntegrationFlags>;
}

export const FRONTIER_DOCUMENTATION_DEFAULT_INTEGRATIONS: Required<FrontierDocumentationIntegrationFlags> = {
  autoDiscovery: true,
  packageCatalog: true,
  apiReference: true,
  guideBook: true,
  browserBook: true,
  inspector: true,
  componentPreview: true,
  routeDocs: true,
  stateDocs: true,
  migrationDocs: true,
  telemetry: true,
  browserEvidence: true,
  fuzz: true,
  benchmarks: true,
  searchIndex: true,
  agentEvidence: true
};

export function resolveDocumentationIntegrationFlags(
  flags: FrontierDocumentationIntegrationFlags = {}
): Required<FrontierDocumentationIntegrationFlags> {
  return { ...FRONTIER_DOCUMENTATION_DEFAULT_INTEGRATIONS, ...flags };
}

export function defineFrontierDocumentation<T extends FrontierDocumentationPageInput>(page: T): T {
  return page;
}

export function defineDocumentationPage<T extends FrontierDocumentationPageInput>(page: T): T {
  return page;
}

export function defineFrontierDocumentationManifest<T extends FrontierDocumentationManifestInput>(manifest: T): T {
  return manifest;
}

export function createDocumentationId(value: string): string {
  const normalized = value
    .trim()
    .replace(/\\/g, '/')
    .replace(/\.[cm]?[jt]sx?$/i, '')
    .replace(/\.(md|mdx|json)$/i, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return normalized || 'documentation';
}

export function createDocumentationManifest(
  input: FrontierDocumentationManifestInput = {}
): FrontierDocumentationManifest {
  const packageName = input.package;
  const title = input.title ?? (packageName ? titleFromPackage(packageName) : 'Frontier Documentation');
  const pages = (input.pages ?? []).map((page, index) => normalizePage(page, index, packageName));
  const navigation = normalizeNavigation(input.navigation, pages);
  const sources = normalizeSources(input.sources ?? pages.flatMap((page) => page.source ? [page.source] : []));
  return {
    kind: FRONTIER_DOCUMENTATION_MANIFEST_KIND,
    version: FRONTIER_DOCUMENTATION_MANIFEST_VERSION,
    id: input.id ?? (packageName ? `${packageName}.documentation` : 'frontier.documentation'),
    generatedAt: input.generatedAt ?? Date.now(),
    package: packageName,
    title,
    packageVersion: input.version,
    basePath: normalizeBasePath(input.basePath ?? '/docs'),
    pages,
    navigation,
    sources,
    integrations: resolveDocumentationIntegrationFlags(input.integrations),
    tags: unique(['frontier-documentation', ...(input.tags ?? [])]),
    metadata: cloneObject(input.metadata)
  };
}

export const createFrontierDocumentationManifest = createDocumentationManifest;

export function mergeDocumentationManifests(
  manifests: readonly FrontierDocumentationManifestInput[],
  input: FrontierDocumentationManifestInput = {}
): FrontierDocumentationManifest {
  const pages = manifests.flatMap((manifest) => manifest.pages ?? []);
  const sources = manifests.flatMap((manifest) => manifest.sources ?? []);
  const tags = manifests.flatMap((manifest) => manifest.tags ?? []);
  return createDocumentationManifest({
    ...input,
    pages: [...pages, ...(input.pages ?? [])],
    sources: [...sources, ...(input.sources ?? [])],
    tags: [...tags, ...(input.tags ?? [])]
  });
}

export function validateDocumentationManifest(
  manifest: FrontierDocumentationManifest
): FrontierDocumentationDiagnostic[] {
  const diagnostics: FrontierDocumentationDiagnostic[] = [];
  if (manifest.kind !== FRONTIER_DOCUMENTATION_MANIFEST_KIND) {
    diagnostics.push({ severity: 'error', code: 'frontier-docs/manifest-kind', message: 'Manifest kind is not frontier.documentation.manifest.' });
  }
  if (!manifest.id) {
    diagnostics.push({ severity: 'error', code: 'frontier-docs/manifest-id', message: 'Documentation manifest must have an id.' });
  }
  const seenPages = new Set<string>();
  for (const page of manifest.pages) {
    if (seenPages.has(page.id)) {
      diagnostics.push({
        severity: 'error',
        code: 'frontier-docs/duplicate-page',
        message: `Duplicate documentation page id: ${page.id}`,
        page: page.id,
        fix: 'Give each documentation page a stable unique id.'
      });
    }
    seenPages.add(page.id);
    if (!page.title.trim()) {
      diagnostics.push({ severity: 'error', code: 'frontier-docs/page-title', message: 'Documentation page is missing a title.', page: page.id });
    }
    if (!page.sections.length) {
      diagnostics.push({
        severity: 'warning',
        code: 'frontier-docs/page-sections',
        message: 'Documentation page has no sections.',
        page: page.id,
        fix: 'Add at least one markdown, API, example, or evidence section.'
      });
    }
    if (page.kind === 'api' && page.api.length === 0 && page.sections.every((section) => section.kind !== 'api')) {
      diagnostics.push({
        severity: 'warning',
        code: 'frontier-docs/api-empty',
        message: 'API documentation page does not declare API symbols.',
        page: page.id,
        fix: 'Add api symbols or an API section so agents can map docs to code.'
      });
    }
  }
  for (const nav of manifest.navigation) {
    for (const page of collectNavigationPages(nav)) {
      if (!seenPages.has(page)) {
        diagnostics.push({
          severity: 'warning',
          code: 'frontier-docs/nav-missing-page',
          message: `Navigation references missing page: ${page}`,
          page,
          fix: 'Remove the navigation reference or add a matching page.'
        });
      }
    }
  }
  if (manifest.integrations.browserEvidence && !manifest.integrations.browserBook) {
    diagnostics.push({
      severity: 'warning',
      code: 'frontier-docs/browser-evidence-without-book',
      message: 'Browser evidence is enabled while browser book generation is disabled.',
      fix: 'Enable browserBook or disable browserEvidence.'
    });
  }
  return diagnostics;
}

export function assertDocumentationManifest(manifest: FrontierDocumentationManifest): void {
  const errors = validateDocumentationManifest(manifest).filter((diagnostic) => diagnostic.severity === 'error');
  if (errors.length) {
    throw new Error(errors.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`).join('\n'));
  }
}

export function createDocumentationSearchRecords(
  manifest: FrontierDocumentationManifest
): FrontierDocumentationSearchRecord[] {
  return manifest.pages.map((page, index) => ({
    id: `${page.id}.search`,
    page: page.id,
    title: page.title,
    route: page.route,
    text: [
      page.title,
      page.summary,
      page.sections.map((section) => `${section.title} ${section.content}`).join(' '),
      page.api.join(' '),
      page.examples.join(' '),
      page.tags.join(' ')
    ].filter(Boolean).join(' ').toLowerCase(),
    tags: page.tags,
    source: page.source,
    score: 1000 - index
  }));
}

export function createDocumentationRegistryGraph(
  manifest: FrontierDocumentationManifest
): FrontierRegistryGraph {
  const entries: FrontierRegistryEntry[] = [];
  const edges: FrontierRegistryEdge[] = [];
  const sources: FrontierRegistrySource[] = manifest.sources.map((source) => ({
    file: source.file,
    line: source.line,
    column: source.column,
    symbol: source.symbol,
    exportName: source.exportName,
    package: source.package
  }));
  entries.push({
    id: manifest.id,
    kind: 'documentation-manifest',
    description: manifest.title,
    package: manifest.package,
    metadata: compactJsonObject({ pages: manifest.pages.length })
  });
  for (const page of manifest.pages) {
    entries.push({
      id: page.id,
      kind: `documentation-${page.kind}`,
      description: page.title,
      package: page.package,
      docs: [page.route],
      tags: page.tags,
      source: page.source ? {
        file: page.source.file,
        line: page.source.line,
        column: page.source.column,
        symbol: page.source.symbol,
        exportName: page.source.exportName,
        package: page.source.package
      } : undefined,
      metadata: compactJsonObject({
        route: page.route,
        title: page.title
      })
    });
    edges.push({ from: manifest.id, to: page.id, kind: 'documents' });
    for (const state of page.states) {
      const stateId = `state:${state}`;
      entries.push({ id: stateId, kind: 'state-path', description: state });
      edges.push({ from: page.id, to: stateId, kind: 'documents-state' });
    }
    for (const route of page.routes) {
      const routeId = `route:${route}`;
      entries.push({ id: routeId, kind: 'route', description: route });
      edges.push({ from: page.id, to: routeId, kind: 'documents-route' });
    }
  }
  return createFrontierRegistryGraph({
    entries,
    edges,
    metadata: compactJsonObject({ generatedBy: FRONTIER_DOCUMENTATION_PACKAGE_NAME, sources })
  });
}

export function createDocumentationProof(
  manifest: FrontierDocumentationManifest
): FrontierDocumentationProof {
  const stable = stableStringify({
    id: manifest.id,
    package: manifest.package,
    pages: manifest.pages.map((page) => ({
      id: page.id,
      title: page.title,
      source: page.source?.file,
      sections: page.sections.map((section) => [section.id, section.title, section.content.length]),
      evidence: page.evidence.map((evidence) => [evidence.id, evidence.kind])
    })),
    integrations: manifest.integrations
  });
  return {
    kind: FRONTIER_DOCUMENTATION_PROOF_KIND,
    version: FRONTIER_DOCUMENTATION_PROOF_VERSION,
    manifestId: manifest.id,
    generatedAt: manifest.generatedAt,
    digest: `fnv1a64:${fnv1a64(stable)}`,
    pages: manifest.pages.length,
    sections: manifest.pages.reduce((total, page) => total + page.sections.length, 0),
    evidence: manifest.pages.reduce((total, page) => total + page.evidence.length, 0),
    integrations: manifest.integrations
  };
}

export function formatDocumentationJsonl(manifest: FrontierDocumentationManifest): string {
  const rows: unknown[] = [
    { type: 'frontier.documentation.manifest', manifest },
    { type: 'frontier.documentation.proof', proof: createDocumentationProof(manifest) },
    ...manifest.pages.map((page) => ({ type: 'frontier.documentation.page', page })),
    ...createDocumentationSearchRecords(manifest).map((record) => ({ type: 'frontier.documentation.search', record }))
  ];
  return rows.map((row) => JSON.stringify(row)).join('\n') + '\n';
}

function normalizePage(
  input: FrontierDocumentationPageInput,
  index: number,
  packageName?: string
): FrontierDocumentationPage {
  const id = input.id ?? createDocumentationId(input.source && typeof input.source !== 'string'
    ? input.source.file + ':' + input.title
    : input.source && typeof input.source === 'string'
      ? input.source + ':' + input.title
      : input.title);
  const sections = (input.sections?.length ? input.sections : [{
    id: 'overview',
    title: 'Overview',
    kind: 'markdown',
    content: input.summary ?? input.title
  }]).map((section, sectionIndex) => normalizeSection(section, sectionIndex, id));
  return {
    id,
    title: input.title,
    kind: input.kind ?? 'guide',
    route: normalizeRoute(input.route ?? id),
    source: normalizeSource(input.source, packageName),
    package: input.package ?? packageName,
    feature: input.feature,
    owner: input.owner,
    summary: input.summary,
    sections,
    examples: [...(input.examples ?? [])],
    api: [...(input.api ?? [])],
    states: (input.states ?? []).map((state) => normalizeFrontierRegistryPath(state)),
    routes: unique([...(input.routes ?? [])]),
    migrations: unique([...(input.migrations ?? [])]),
    tests: unique([...(input.tests ?? [])]),
    benchmarks: unique([...(input.benchmarks ?? [])]),
    evidence: (input.evidence ?? defaultEvidenceForPage(id, index)).map((evidence, evidenceIndex) => normalizeEvidence(evidence, evidenceIndex, id)),
    tags: unique([input.kind ?? 'guide', ...(input.tags ?? [])]),
    metadata: cloneObject(input.metadata)
  };
}

function normalizeSection(
  input: FrontierDocumentationSectionInput,
  index: number,
  pageId: string
): FrontierDocumentationSection {
  const title = input.title ?? titleFromId(input.id ?? `section-${index + 1}`);
  return {
    id: input.id ?? `${pageId}.section-${index + 1}`,
    title,
    kind: input.kind ?? (input.code ? 'code' : 'markdown'),
    content: input.content ?? input.markdown ?? input.code ?? '',
    source: normalizeSource(input.source),
    anchors: unique(input.anchors ?? [createDocumentationId(title)]),
    code: input.code,
    language: input.language,
    metadata: cloneObject(input.metadata)
  };
}

function normalizeEvidence(
  input: FrontierDocumentationEvidenceInput,
  index: number,
  pageId: string
): FrontierDocumentationEvidence {
  return {
    id: input.id ?? `${pageId}.evidence-${index + 1}`,
    kind: input.kind ?? 'docs',
    title: input.title,
    command: input.command,
    files: unique(input.files ?? []),
    pages: unique(input.pages ?? [pageId]),
    assertions: unique(input.assertions ?? ['page-has-title', 'page-has-sections']),
    telemetry: unique(input.telemetry ?? ['frontier.documentation.page']),
    traces: unique(input.traces ?? []),
    metadata: cloneObject(input.metadata)
  };
}

function normalizeNavigation(
  input: readonly FrontierDocumentationNavigationInput[] | undefined,
  pages: readonly FrontierDocumentationPage[]
): FrontierDocumentationNavigation[] {
  if (input?.length) return input.map(normalizeNavigationGroup);
  return [{
    id: 'docs',
    title: 'Documentation',
    pages: pages.map((page) => page.id),
    groups: []
  }];
}

function normalizeNavigationGroup(input: FrontierDocumentationNavigationInput): FrontierDocumentationNavigation {
  return {
    id: input.id ?? createDocumentationId(input.title),
    title: input.title,
    pages: unique(input.pages ?? []),
    groups: (input.groups ?? []).map(normalizeNavigationGroup),
    metadata: cloneObject(input.metadata)
  };
}

function normalizeSources(input: readonly FrontierDocumentationSource[]): FrontierDocumentationSource[] {
  const seen = new Set<string>();
  const out: FrontierDocumentationSource[] = [];
  for (const source of input) {
    const key = `${source.file}:${source.exportName ?? ''}:${source.symbol ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...source });
  }
  return out;
}

function normalizeSource(
  source?: string | FrontierDocumentationSource,
  packageName?: string
): FrontierDocumentationSource | undefined {
  if (!source) return undefined;
  if (typeof source === 'string') return { file: source, package: packageName };
  return { ...source, package: source.package ?? packageName };
}

function defaultEvidenceForPage(pageId: string, index: number): FrontierDocumentationEvidenceInput[] {
  return [{
    id: `${pageId}.docs-smoke`,
    kind: 'docs',
    assertions: ['page-has-title', 'page-has-sections', 'search-record-generated'],
    metadata: { ordinal: index }
  }];
}

function collectNavigationPages(group: FrontierDocumentationNavigation): string[] {
  return [...group.pages, ...group.groups.flatMap(collectNavigationPages)];
}

function normalizeBasePath(value: string): string {
  return value.startsWith('/') ? value : `/${value}`;
}

function normalizeRoute(value: string): string {
  return '/' + value.replace(/^\/+/, '').replace(/\/+$/, '');
}

function cloneObject(value: JsonObject | undefined): JsonObject | undefined {
  return value ? cloneJson(value) as JsonObject : undefined;
}

function compactJsonObject(value: Record<string, unknown>): JsonObject {
  const out: Record<string, JsonValue> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) continue;
    out[key] = item as JsonValue;
  }
  return out as JsonObject;
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter((value) => typeof value === 'string' && value.length > 0)));
}

function titleFromPackage(value: string): string {
  return value.split('/').pop()?.replace(/^frontier-/, 'Frontier ').replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) ?? value;
}

function titleFromId(value: string): string {
  return value.replace(/[-_.]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',') + '}';
  }
  return JSON.stringify(value);
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let index = 0; index < value.length; index++) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = (hash * prime) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, '0');
}
