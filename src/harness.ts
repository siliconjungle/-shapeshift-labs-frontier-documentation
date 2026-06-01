import {
  FRONTIER_DOCUMENTATION_HARNESS_KIND,
  FRONTIER_DOCUMENTATION_HARNESS_VERSION,
  createDocumentationProof,
  createDocumentationSearchRecords,
  resolveDocumentationIntegrationFlags,
  validateDocumentationManifest,
  type FrontierDocumentationIntegrationFlags,
  type FrontierDocumentationManifest
} from './index.js';

export interface FrontierDocumentationHarnessOptions {
  integrations?: FrontierDocumentationIntegrationFlags;
  baseUrl?: string;
  strict?: boolean;
}

export interface FrontierDocumentationHarnessManifest {
  kind: typeof FRONTIER_DOCUMENTATION_HARNESS_KIND;
  version: typeof FRONTIER_DOCUMENTATION_HARNESS_VERSION;
  manifestId: string;
  generatedAt: number;
  fixtures: FrontierDocumentationHarnessFixture[];
  commands: FrontierDocumentationHarnessCommand[];
  expected: FrontierDocumentationHarnessExpected;
}

export interface FrontierDocumentationHarnessFixture {
  id: string;
  page: string;
  route: string;
  title: string;
  assertions: string[];
  evidence: string[];
}

export interface FrontierDocumentationHarnessCommand {
  id: string;
  kind: 'lint' | 'browser' | 'fuzz' | 'bench' | 'search' | 'proof';
  command: string;
  required: boolean;
}

export interface FrontierDocumentationHarnessExpected {
  pages: number;
  sections: number;
  searchRecords: number;
  proofDigest: string;
  diagnostics: number;
}

export interface FrontierDocumentationLintResult {
  ok: boolean;
  diagnostics: ReturnType<typeof validateDocumentationManifest>;
  suggestedFixes: string[];
}

export interface FrontierDocumentationFuzzCase {
  id: string;
  page: string;
  route: string;
  query: string;
  steps: string[];
  expected: string[];
}

export interface FrontierDocumentationBenchmarkPlan {
  manifestId: string;
  benchmarks: Array<{
    id: string;
    target: string;
    metric: 'render-ms' | 'search-ms' | 'proof-ms' | 'bytes';
    budget: number;
  }>;
}

export interface FrontierDocumentationBrowserEvidencePlan {
  baseUrl: string;
  pages: Array<{
    id: string;
    url: string;
    assertions: string[];
    telemetry: string[];
  }>;
}

export interface FrontierDocumentationAgentRunbook {
  manifestId: string;
  steps: Array<{
    id: string;
    title: string;
    command?: string;
    evidence: string[];
  }>;
}

export function createDocumentationHarnessManifest(
  manifest: FrontierDocumentationManifest,
  options: FrontierDocumentationHarnessOptions = {}
): FrontierDocumentationHarnessManifest {
  const integrations = resolveDocumentationIntegrationFlags(options.integrations ?? manifest.integrations);
  const proof = createDocumentationProof(manifest);
  const diagnostics = validateDocumentationManifest(manifest);
  return {
    kind: FRONTIER_DOCUMENTATION_HARNESS_KIND,
    version: FRONTIER_DOCUMENTATION_HARNESS_VERSION,
    manifestId: manifest.id,
    generatedAt: manifest.generatedAt,
    fixtures: manifest.pages.map((page) => ({
      id: `${page.id}.fixture`,
      page: page.id,
      route: page.route,
      title: page.title,
      assertions: ['page-has-title', 'page-has-sections', 'search-record-generated', ...page.evidence.flatMap((evidence) => evidence.assertions)],
      evidence: page.evidence.map((evidence) => evidence.id)
    })),
    commands: [
      { id: 'docs.lint', kind: 'lint', command: 'frontier-docs lint --json', required: true },
      { id: 'docs.search', kind: 'search', command: 'frontier-docs discover --json', required: integrations.searchIndex },
      { id: 'docs.browser', kind: 'browser', command: 'frontier-docs build && frontier-playwright docs', required: integrations.browserEvidence },
      { id: 'docs.fuzz', kind: 'fuzz', command: 'frontier-docs fuzz --json', required: integrations.fuzz },
      { id: 'docs.bench', kind: 'bench', command: 'frontier-docs bench --json', required: integrations.benchmarks },
      { id: 'docs.proof', kind: 'proof', command: 'frontier-docs jsonl', required: integrations.agentEvidence }
    ],
    expected: {
      pages: manifest.pages.length,
      sections: manifest.pages.reduce((total, page) => total + page.sections.length, 0),
      searchRecords: createDocumentationSearchRecords(manifest).length,
      proofDigest: proof.digest,
      diagnostics: diagnostics.length
    }
  };
}

export function lintDocumentationManifest(
  manifest: FrontierDocumentationManifest
): FrontierDocumentationLintResult {
  const diagnostics = validateDocumentationManifest(manifest);
  return {
    ok: diagnostics.every((diagnostic) => diagnostic.severity !== 'error'),
    diagnostics,
    suggestedFixes: diagnostics.map((diagnostic) => diagnostic.fix).filter((fix): fix is string => Boolean(fix))
  };
}

export function createDocumentationFuzzCases(
  manifest: FrontierDocumentationManifest,
  options: FrontierDocumentationHarnessOptions & { casesPerPage?: number } = {}
): FrontierDocumentationFuzzCase[] {
  const integrations = resolveDocumentationIntegrationFlags(options.integrations ?? manifest.integrations);
  if (!integrations.fuzz) return [];
  const casesPerPage = Math.max(1, Math.floor(options.casesPerPage ?? 3));
  const cases: FrontierDocumentationFuzzCase[] = [];
  for (const page of manifest.pages) {
    const seeds = [page.title, ...page.tags, ...page.api, ...page.sections.map((section) => section.title)].filter(Boolean);
    for (let index = 0; index < casesPerPage; index++) {
      const query = seeds[index % Math.max(1, seeds.length)] ?? page.id;
      cases.push({
        id: `${page.id}.fuzz-${index + 1}`,
        page: page.id,
        route: page.route,
        query,
        steps: ['open-docs-book', `search:${query}`, `navigate:${page.route}`, 'inspect-page-state'],
        expected: ['visible-title', 'search-hit', 'proof-stable']
      });
    }
  }
  return cases;
}

export function minimizeDocumentationFuzzCase(
  testCase: FrontierDocumentationFuzzCase
): FrontierDocumentationFuzzCase {
  return {
    ...testCase,
    steps: testCase.steps.slice(0, Math.max(1, Math.min(2, testCase.steps.length))),
    expected: testCase.expected.slice(0, 1)
  };
}

export function createDocumentationBenchmarkPlan(
  manifest: FrontierDocumentationManifest,
  options: FrontierDocumentationHarnessOptions = {}
): FrontierDocumentationBenchmarkPlan {
  const integrations = resolveDocumentationIntegrationFlags(options.integrations ?? manifest.integrations);
  if (!integrations.benchmarks) return { manifestId: manifest.id, benchmarks: [] };
  const pages = Math.max(1, manifest.pages.length);
  return {
    manifestId: manifest.id,
    benchmarks: [
      { id: 'docs.render-book', target: 'renderDocumentationBookHtml', metric: 'render-ms', budget: 20 + pages },
      { id: 'docs.search-index', target: 'createDocumentationSearchRecords', metric: 'search-ms', budget: 10 + pages },
      { id: 'docs.proof', target: 'createDocumentationProof', metric: 'proof-ms', budget: 10 + pages },
      { id: 'docs.html-bytes', target: 'standalone-book', metric: 'bytes', budget: 16000 + pages * 9000 }
    ]
  };
}

export function createDocumentationBrowserEvidencePlan(
  manifest: FrontierDocumentationManifest,
  options: FrontierDocumentationHarnessOptions = {}
): FrontierDocumentationBrowserEvidencePlan {
  const integrations = resolveDocumentationIntegrationFlags(options.integrations ?? manifest.integrations);
  const baseUrl = options.baseUrl ?? 'http://localhost:5173/docs';
  return {
    baseUrl,
    pages: integrations.browserEvidence ? manifest.pages.map((page) => ({
      id: page.id,
      url: `${baseUrl.replace(/\/$/, '')}#${page.id}`,
      assertions: ['document-ready', 'page-title-visible', 'section-count-matches', 'search-index-contains-page'],
      telemetry: ['frontier.documentation.page.view', ...page.evidence.flatMap((evidence) => evidence.telemetry)]
    })) : []
  };
}

export function createDocumentationAgentRunbook(
  manifest: FrontierDocumentationManifest,
  options: FrontierDocumentationHarnessOptions = {}
): FrontierDocumentationAgentRunbook {
  const integrations = resolveDocumentationIntegrationFlags(options.integrations ?? manifest.integrations);
  return {
    manifestId: manifest.id,
    steps: [
      { id: 'docs.discover', title: 'Discover documentation sources', command: 'frontier-docs discover --json', evidence: ['manifest', 'search'] },
      { id: 'docs.build', title: 'Build standalone documentation book', command: 'frontier-docs build', evidence: ['html', 'jsonl', 'proof'] },
      ...(integrations.fuzz ? [{ id: 'docs.fuzz', title: 'Run generated documentation fuzz cases', command: 'frontier-docs fuzz --json', evidence: ['fuzz-cases'] }] : []),
      ...(integrations.benchmarks ? [{ id: 'docs.bench', title: 'Run documentation benchmark plan', command: 'frontier-docs bench --json', evidence: ['benchmarks'] }] : []),
      ...(integrations.browserEvidence ? [{ id: 'docs.browser', title: 'Collect browser evidence', evidence: ['dom', 'state', 'telemetry'] }] : [])
    ]
  };
}
