import assert from 'node:assert';
import {
  createDocumentationManifest,
  createDocumentationProof,
  createDocumentationSearchRecords,
  validateDocumentationManifest
} from '../dist/index.js';
import {
  createDocumentationFuzzCases,
  lintDocumentationManifest
} from '../dist/harness.js';

const args = parseArgs(process.argv.slice(2));
const cases = Number(args.cases ?? 300);
let pageCount = 0;
let fuzzCount = 0;

for (let seed = 0; seed < cases; seed++) {
  const pages = Array.from({ length: 1 + seed % 8 }, (_, index) => ({
    id: `page-${seed}-${index}`,
    title: `Page ${seed} ${index}`,
    kind: index % 3 === 0 ? 'api' : 'guide',
    api: index % 3 === 0 ? [`symbol${seed}_${index}`] : [],
    sections: Array.from({ length: 1 + (seed + index) % 4 }, (_unused, section) => ({
      title: `Section ${section}`,
      content: `Content ${seed}:${index}:${section}`
    })),
    tags: [`tag-${seed % 5}`]
  }));
  const manifest = createDocumentationManifest({
    id: `docs.fuzz.${seed}`,
    generatedAt: seed,
    package: '@example/fuzz',
    pages
  });
  const errors = validateDocumentationManifest(manifest).filter((diagnostic) => diagnostic.severity === 'error');
  assert.strictEqual(errors.length, 0);
  assert.strictEqual(lintDocumentationManifest(manifest).ok, true);
  assert.strictEqual(createDocumentationSearchRecords(manifest).length, manifest.pages.length);
  assert.strictEqual(createDocumentationProof(manifest).digest, createDocumentationProof(manifest).digest);
  const fuzzCases = createDocumentationFuzzCases(manifest, { casesPerPage: 2 });
  assert.strictEqual(fuzzCases.length, manifest.pages.length * 2);
  pageCount += manifest.pages.length;
  fuzzCount += fuzzCases.length;
}

console.log(`frontier-documentation fuzz ok cases=${cases} pages=${pageCount} fuzz=${fuzzCount}`);

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg.startsWith('--')) out[arg.slice(2)] = argv[index + 1] && !argv[index + 1].startsWith('--') ? argv[++index] : true;
  }
  return out;
}
