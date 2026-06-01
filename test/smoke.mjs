import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  assertDocumentationManifest,
  createDocumentationManifest,
  createDocumentationProof,
  createDocumentationRegistryGraph,
  createDocumentationSearchRecords,
  formatDocumentationJsonl,
  resolveDocumentationIntegrationFlags,
  validateDocumentationManifest
} from '../dist/index.js';
import {
  createDocumentationBookState,
  renderDocumentationBookHtml
} from '../dist/browser.js';
import {
  discoverFrontierDocumentation,
  extractApiExports,
  generateDocumentationModule,
  writeDocumentationArtifacts
} from '../dist/node.js';
import {
  createDocumentationAgentRunbook,
  createDocumentationBenchmarkPlan,
  createDocumentationBrowserEvidencePlan,
  createDocumentationFuzzCases,
  createDocumentationHarnessManifest,
  lintDocumentationManifest,
  minimizeDocumentationFuzzCase
} from '../dist/harness.js';
import {
  documentationVirtualSpecifier,
  frontierDocumentationVite
} from '../dist/vite.js';

const manifest = createDocumentationManifest({
  id: 'docs.smoke',
  generatedAt: 1,
  package: '@example/docs-app',
  title: 'Docs App',
  pages: [
    {
      title: 'Getting Started',
      kind: 'guide',
      source: { file: 'README.md' },
      summary: 'Start here.',
      sections: [
        { title: 'Install', content: 'npm install @example/docs-app' },
        { title: 'Use', content: 'frontier-docs build' }
      ],
      routes: ['/docs'],
      states: ['/docs/pages'],
      evidence: [{ kind: 'docs', assertions: ['title-visible'] }],
      tags: ['guide']
    },
    {
      title: 'API',
      kind: 'api',
      source: { file: 'src/index.ts' },
      api: ['createDocs'],
      sections: [{ title: 'Exports', kind: 'api', content: '- createDocs' }],
      tags: ['api']
    }
  ]
});

assertDocumentationManifest(manifest);
assert.strictEqual(validateDocumentationManifest(manifest).filter((item) => item.severity === 'error').length, 0);
assert.strictEqual(resolveDocumentationIntegrationFlags().browserBook, true);
assert.strictEqual(resolveDocumentationIntegrationFlags({ fuzz: false }).fuzz, false);

const search = createDocumentationSearchRecords(manifest);
assert.strictEqual(search.length, 2);
assert.ok(search[0].text.includes('getting started'));

const graph = createDocumentationRegistryGraph(manifest);
assert.ok(graph.entries.some((entry) => entry.kind === 'documentation-guide'));
assert.ok(graph.entries.some((entry) => entry.kind === 'state-path'));

const proof = createDocumentationProof(manifest);
assert.ok(proof.digest.startsWith('fnv1a64:'));
assert.strictEqual(createDocumentationProof(manifest).digest, proof.digest);
assert.ok(formatDocumentationJsonl(manifest).includes('frontier.documentation.page'));

const book = createDocumentationBookState(manifest);
assert.strictEqual(book.integrations.inspector, true);
assert.ok(book.inspector?.capabilities.rewind);
const html = renderDocumentationBookHtml(manifest);
assert.ok(html.includes('frontier-docs-root'));
assert.ok(html.includes('Inspect'));

const harness = createDocumentationHarnessManifest(manifest);
assert.strictEqual(harness.fixtures.length, 2);
assert.strictEqual(lintDocumentationManifest(manifest).ok, true);
const fuzzCases = createDocumentationFuzzCases(manifest, { casesPerPage: 2 });
assert.strictEqual(fuzzCases.length, 4);
assert.ok(minimizeDocumentationFuzzCase(fuzzCases[0]).steps.length <= 2);
assert.strictEqual(createDocumentationBrowserEvidencePlan(manifest).pages.length, 2);
assert.ok(createDocumentationBenchmarkPlan(manifest).benchmarks.length >= 3);
assert.ok(createDocumentationAgentRunbook(manifest).steps.some((step) => step.id === 'docs.build'));
assert.deepStrictEqual(extractApiExports('export function alpha() {}\\nexport type Beta = string;'), ['Beta', 'alpha']);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'frontier-docs-'));
try {
  fs.mkdirSync(path.join(tmp, 'src'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'features'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: '@example/docs-app', version: '1.2.3', description: 'Example docs app.', scripts: { docs: 'frontier-docs build' } }));
  fs.writeFileSync(path.join(tmp, 'README.md'), '# Example Docs App\n\nThis package has docs.\n\n## Usage\n\nRun the docs tool.\n');
  fs.writeFileSync(path.join(tmp, 'features', 'docs.json'), JSON.stringify({ feature: 'docs-feature', acceptance: ['docs build'] }));
  fs.writeFileSync(path.join(tmp, 'src', 'index.ts'), 'export function createDocs() { return true; }\\nexport interface DocsOptions { strict?: boolean }\\n');
  const discovered = await discoverFrontierDocumentation({ rootDir: tmp, generatedAt: 2 });
  assert.ok(discovered.manifest.pages.length >= 4);
  assert.ok(discovered.manifest.pages.some((page) => page.kind === 'api'));
  const moduleSource = generateDocumentationModule(discovered.manifest);
  assert.ok(moduleSource.includes('frontierDocumentationManifest'));
  const written = await writeDocumentationArtifacts({ rootDir: tmp, outDir: '.frontier/docs' });
  assert.ok(fs.existsSync(path.join(written.outDir, 'manifest.json')));
  assert.ok(fs.existsSync(path.join(written.outDir, 'index.html')));
  assert.ok(fs.existsSync(path.join(written.outDir, 'search.json')));
  assert.ok(fs.existsSync(path.join(written.outDir, 'documentation.jsonl')));

  const plugin = frontierDocumentationVite({ rootDir: tmp });
  assert.strictEqual(plugin.name, 'frontier-documentation');
  assert.strictEqual(documentationVirtualSpecifier('manifest'), 'virtual:frontier-documentation/manifest');
  assert.strictEqual(plugin.resolveId?.('virtual:frontier-documentation/manifest'), '\0frontier-documentation:manifest');
  const loadedManifest = await plugin.load?.('\0frontier-documentation:manifest');
  assert.ok(String(loadedManifest).includes('@example/docs-app.documentation'));

  const cliPath = path.resolve('dist/cli.js');
  const cliOutput = execFileSync(process.execPath, [cliPath, 'discover', '--cwd', tmp, '--json'], { encoding: 'utf8' });
  assert.ok(JSON.parse(cliOutput).manifest.pages.length >= 4);
  const cliLink = path.join(tmp, 'frontier-docs');
  fs.symlinkSync(cliPath, cliLink);
  const cliHelp = execFileSync(cliLink, ['--help'], { encoding: 'utf8' });
  assert.ok(cliHelp.includes('Commands:'));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('frontier-documentation smoke ok');
