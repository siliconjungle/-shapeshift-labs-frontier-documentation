import {
  createDocumentationProof,
  createDocumentationSearchRecords,
  resolveDocumentationIntegrationFlags,
  type FrontierDocumentationIntegrationFlags,
  type FrontierDocumentationManifest,
  type FrontierDocumentationPage
} from './index.js';

export interface FrontierDocumentationBookOptions {
  title?: string;
  basePath?: string;
  integrations?: FrontierDocumentationIntegrationFlags;
  includeManifestScript?: boolean;
}

export interface FrontierDocumentationBookState {
  manifest: FrontierDocumentationManifest;
  activePage: string | undefined;
  search: ReturnType<typeof createDocumentationSearchRecords>;
  proof: ReturnType<typeof createDocumentationProof>;
  integrations: Required<FrontierDocumentationIntegrationFlags>;
  inspector?: FrontierDocumentationInspectorBridge;
}

export interface FrontierDocumentationInspectorBridge {
  id: string;
  capabilities: {
    inspectPage: boolean;
    inspectSource: boolean;
    rewind: boolean;
    telemetry: boolean;
    evidence: boolean;
  };
  timeline: Array<{
    id: string;
    page: string;
    title: string;
    source?: string;
    sections: number;
  }>;
}

export function createDocumentationBookState(
  manifest: FrontierDocumentationManifest,
  options: FrontierDocumentationBookOptions = {}
): FrontierDocumentationBookState {
  const integrations = resolveDocumentationIntegrationFlags(options.integrations ?? manifest.integrations);
  return {
    manifest,
    activePage: manifest.pages[0]?.id,
    search: createDocumentationSearchRecords(manifest),
    proof: createDocumentationProof(manifest),
    integrations,
    inspector: integrations.inspector ? createDocumentationInspectorBridge(manifest) : undefined
  };
}

export function createDocumentationInspectorBridge(
  manifest: FrontierDocumentationManifest
): FrontierDocumentationInspectorBridge {
  return {
    id: `${manifest.id}.inspector`,
    capabilities: {
      inspectPage: true,
      inspectSource: true,
      rewind: true,
      telemetry: manifest.integrations.telemetry,
      evidence: manifest.integrations.browserEvidence
    },
    timeline: manifest.pages.map((page, index) => ({
      id: `${manifest.id}.timeline.${index}`,
      page: page.id,
      title: page.title,
      source: page.source?.file,
      sections: page.sections.length
    }))
  };
}

export function renderDocumentationBookHtml(
  manifest: FrontierDocumentationManifest,
  options: FrontierDocumentationBookOptions = {}
): string {
  const state = createDocumentationBookState(manifest, options);
  const title = options.title ?? manifest.title;
  const nav = renderNavigation(manifest.pages);
  const pages = manifest.pages.map(renderPage).join('\n');
  const manifestJson = escapeScriptJson(JSON.stringify(state));
  const script = options.includeManifestScript === false ? '' : `
<script type="application/json" id="frontier-documentation-state">${manifestJson}</script>
<script type="module">${renderDocumentationClientModule()}</script>`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; --frontier-accent: #0f766e; --frontier-border: #d7dedb; --frontier-bg: #f8faf9; --frontier-panel: #ffffff; --frontier-text: #17201c; --frontier-muted: #5f6f68; }
    @media (prefers-color-scheme: dark) { :root { --frontier-bg: #101514; --frontier-panel: #161d1b; --frontier-text: #eef5f2; --frontier-muted: #a7b5af; --frontier-border: #2b3a35; } }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: var(--frontier-bg); color: var(--frontier-text); }
    a { color: inherit; }
    .frontier-docs-root { min-height: 100vh; display: grid; grid-template-columns: minmax(220px, 280px) minmax(0, 1fr); }
    .frontier-docs-sidebar { border-right: 1px solid var(--frontier-border); background: var(--frontier-panel); padding: 20px; position: sticky; top: 0; height: 100vh; overflow: auto; }
    .frontier-docs-brand { font-size: 16px; font-weight: 700; margin: 0 0 16px; }
    .frontier-docs-search { width: 100%; border: 1px solid var(--frontier-border); border-radius: 6px; padding: 9px 10px; background: transparent; color: inherit; margin-bottom: 14px; }
    .frontier-docs-nav { display: grid; gap: 4px; }
    .frontier-docs-nav a { display: block; padding: 8px 10px; border-radius: 6px; text-decoration: none; color: var(--frontier-muted); }
    .frontier-docs-nav a:hover, .frontier-docs-nav a[aria-current="true"] { background: color-mix(in srgb, var(--frontier-accent) 12%, transparent); color: var(--frontier-text); }
    .frontier-docs-main { padding: 34px min(6vw, 72px); max-width: 1080px; width: 100%; }
    .frontier-docs-page { margin-bottom: 56px; padding-bottom: 40px; border-bottom: 1px solid var(--frontier-border); }
    .frontier-docs-page:last-child { border-bottom: 0; }
    .frontier-docs-kicker { color: var(--frontier-accent); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
    .frontier-docs-page h1 { font-size: clamp(30px, 5vw, 52px); line-height: 1.05; margin: 8px 0 12px; letter-spacing: 0; }
    .frontier-docs-summary { color: var(--frontier-muted); font-size: 18px; line-height: 1.55; max-width: 760px; }
    .frontier-docs-section { margin-top: 28px; }
    .frontier-docs-section h2 { font-size: 22px; margin: 0 0 10px; letter-spacing: 0; }
    .frontier-docs-section p { line-height: 1.65; }
    .frontier-docs-code { display: block; overflow: auto; padding: 14px; border-radius: 6px; background: rgba(127, 127, 127, .12); border: 1px solid var(--frontier-border); }
    .frontier-docs-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
    .frontier-docs-chip { font-size: 12px; color: var(--frontier-muted); border: 1px solid var(--frontier-border); border-radius: 999px; padding: 4px 8px; }
    .frontier-docs-inspector { position: fixed; right: 18px; bottom: 18px; border: 0; border-radius: 999px; padding: 11px 14px; background: var(--frontier-accent); color: white; font-weight: 700; box-shadow: 0 10px 30px rgba(0,0,0,.24); cursor: pointer; }
    .frontier-docs-panel { position: fixed; right: 18px; bottom: 68px; width: min(420px, calc(100vw - 36px)); max-height: min(520px, calc(100vh - 100px)); overflow: auto; background: var(--frontier-panel); border: 1px solid var(--frontier-border); border-radius: 8px; box-shadow: 0 20px 50px rgba(0,0,0,.28); padding: 14px; display: none; }
    .frontier-docs-panel[data-open="true"] { display: block; }
    .frontier-docs-panel pre { white-space: pre-wrap; word-break: break-word; font-size: 12px; }
    @media (max-width: 760px) { .frontier-docs-root { display: block; } .frontier-docs-sidebar { position: relative; height: auto; border-right: 0; border-bottom: 1px solid var(--frontier-border); } .frontier-docs-main { padding: 24px 18px 90px; } }
  </style>
</head>
<body>
  <div class="frontier-docs-root" data-frontier-documentation-root>
    <aside class="frontier-docs-sidebar">
      <p class="frontier-docs-brand">${escapeHtml(title)}</p>
      <input class="frontier-docs-search" type="search" placeholder="Search docs" aria-label="Search docs">
      <nav class="frontier-docs-nav">${nav}</nav>
    </aside>
    <main class="frontier-docs-main">${pages}</main>
  </div>
  ${state.inspector ? '<button class="frontier-docs-inspector" type="button" data-frontier-docs-inspector>Inspect</button><aside class="frontier-docs-panel" data-frontier-docs-panel></aside>' : ''}
  ${script}
</body>
</html>`;
}

export function renderDocumentationClientModule(): string {
  return `
const stateNode = document.getElementById('frontier-documentation-state');
const state = stateNode ? JSON.parse(stateNode.textContent || '{}') : {};
globalThis.__FRONTIER_DOCUMENTATION__ = state;
const links = Array.from(document.querySelectorAll('.frontier-docs-nav a'));
const search = document.querySelector('.frontier-docs-search');
function setCurrent() {
  const hash = location.hash || links[0]?.getAttribute('href') || '';
  for (const link of links) link.setAttribute('aria-current', String(link.getAttribute('href') === hash));
}
window.addEventListener('hashchange', setCurrent);
setCurrent();
search?.addEventListener('input', () => {
  const query = String(search.value || '').toLowerCase();
  for (const page of document.querySelectorAll('.frontier-docs-page')) {
    page.hidden = query.length > 0 && !String(page.textContent || '').toLowerCase().includes(query);
  }
});
const button = document.querySelector('[data-frontier-docs-inspector]');
const panel = document.querySelector('[data-frontier-docs-panel]');
button?.addEventListener('click', () => {
  if (!panel) return;
  const open = panel.getAttribute('data-open') === 'true';
  panel.setAttribute('data-open', String(!open));
  if (!open) panel.innerHTML = '<strong>Frontier Documentation</strong><pre>' + escapeHtml(JSON.stringify({
    manifest: state.manifest?.id,
    pages: state.manifest?.pages?.length,
    proof: state.proof,
    inspector: state.inspector
  }, null, 2)) + '</pre>';
});
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
`;
}

function renderNavigation(pages: readonly FrontierDocumentationPage[]): string {
  return pages.map((page, index) => `<a href="#${escapeAttr(page.id)}" aria-current="${index === 0 ? 'true' : 'false'}">${escapeHtml(page.title)}</a>`).join('');
}

function renderPage(page: FrontierDocumentationPage): string {
  const sections = page.sections.map((section) => `
<section class="frontier-docs-section" id="${escapeAttr(section.id)}">
  <h2>${escapeHtml(section.title)}</h2>
  ${section.code ? `<pre class="frontier-docs-code"><code>${escapeHtml(section.code)}</code></pre>` : renderMarkdownish(section.content)}
</section>`).join('\n');
  const chips = [...page.tags, ...page.api.map((api) => `api:${api}`), ...page.routes.map((route) => `route:${route}`)]
    .slice(0, 18)
    .map((tag) => `<span class="frontier-docs-chip">${escapeHtml(tag)}</span>`)
    .join('');
  return `<article class="frontier-docs-page" id="${escapeAttr(page.id)}" data-frontier-docs-page="${escapeAttr(page.id)}">
  <div class="frontier-docs-kicker">${escapeHtml(page.kind)}</div>
  <h1>${escapeHtml(page.title)}</h1>
  ${page.summary ? `<p class="frontier-docs-summary">${escapeHtml(page.summary)}</p>` : ''}
  <div class="frontier-docs-meta">${chips}</div>
  ${sections}
</article>`;
}

function renderMarkdownish(value: string): string {
  const paragraphs = value.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  if (!paragraphs.length) return '<p></p>';
  return paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`).join('\n');
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char));
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function escapeScriptJson(value: string): string {
  return value.replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
