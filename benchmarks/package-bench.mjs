import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  createDocumentationManifest,
  createDocumentationProof,
  createDocumentationSearchRecords
} from '../dist/index.js';
import { renderDocumentationBookHtml } from '../dist/browser.js';
import {
  createDocumentationBenchmarkPlan,
  createDocumentationFuzzCases,
  createDocumentationHarnessManifest
} from '../dist/harness.js';

const args = parseArgs(process.argv.slice(2));
const outPath = path.resolve(args.out ?? 'benchmarks/results/frontier-documentation-package-bench-latest.json');
const entries = Number(args.entries ?? 500);
const runs = Number(args.runs ?? 9);
const manifest = createDocumentationManifest({
  id: 'bench.documentation',
  package: '@example/docs',
  generatedAt: 1,
  pages: Array.from({ length: entries }, (_, index) => ({
    id: `page-${index}`,
    title: `Generated Page ${index}`,
    kind: index % 5 === 0 ? 'api' : 'guide',
    summary: `Synthetic documentation page ${index}.`,
    api: [`symbol${index}`],
    sections: [
      { title: 'Overview', content: `Overview content ${index}` },
      { title: 'Usage', content: `Usage content ${index}` }
    ],
    tags: ['bench', `group-${index % 10}`]
  }))
});

const measures = {
  createManifest: measure(() => createDocumentationManifest(manifest).pages.length),
  searchRecords: measure(() => createDocumentationSearchRecords(manifest).length),
  harnessManifest: measure(() => createDocumentationHarnessManifest(manifest).fixtures.length),
  browserBookHtml: measure(() => renderDocumentationBookHtml(manifest).length),
  fuzzCases: measure(() => createDocumentationFuzzCases(manifest, { casesPerPage: 3 }).length),
  benchmarkPlan: measure(() => createDocumentationBenchmarkPlan(manifest).benchmarks.length),
  proof: measure(() => createDocumentationProof(manifest).digest.length)
};

const payload = {
  generatedAt: new Date().toISOString(),
  package: '@shapeshift-labs/frontier-documentation',
  entries,
  runs,
  measures
};
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n');
console.log(JSON.stringify(payload, null, 2));

function measure(fn) {
  const samples = [];
  let output = 0;
  for (let i = 0; i < runs; i++) {
    global.gc?.();
    const start = performance.now();
    output = fn();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  return {
    minMs: samples[0],
    medianMs: samples[Math.floor(samples.length / 2)],
    maxMs: samples[samples.length - 1],
    p95Ms: samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))],
    output
  };
}

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg.startsWith('--')) out[arg.slice(2)] = argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[++index] : true;
  }
  return out;
}
