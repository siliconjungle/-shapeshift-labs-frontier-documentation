import {
  discoverFrontierDocumentation,
  generateDocumentationModule,
  type FrontierDocumentationDiscoveryOptions
} from './node.js';
import { renderDocumentationBookHtml, renderDocumentationClientModule } from './browser.js';

export type FrontierDocumentationVirtualKind = 'manifest' | 'book' | 'client' | 'module' | 'search';

export interface FrontierDocumentationVitePlugin {
  name: string;
  enforce?: 'pre' | 'post';
  configureServer?: (server: { watcher?: { add?: (path: string | string[]) => void } }) => void | Promise<void>;
  resolveId?: (id: string) => string | undefined;
  load?: (id: string) => Promise<string | undefined> | string | undefined;
  handleHotUpdate?: (ctx: { file: string; server?: { moduleGraph?: { getModuleById?: (id: string) => unknown }; ws?: { send?: (payload: unknown) => void } } }) => void | unknown[];
}

export interface FrontierDocumentationViteOptions extends FrontierDocumentationDiscoveryOptions {
  hmr?: boolean;
}

const virtualPrefix = 'virtual:frontier-documentation/';
const resolvedPrefix = '\0frontier-documentation:';

export function documentationVirtualSpecifier(kind: FrontierDocumentationVirtualKind): string {
  return `${virtualPrefix}${kind}`;
}

export function createFrontierDocumentationVitePlugin(
  options: FrontierDocumentationViteOptions = {}
): FrontierDocumentationVitePlugin {
  const hmr = options.hmr !== false;
  return {
    name: 'frontier-documentation',
    enforce: 'pre',
    configureServer(server) {
      server.watcher?.add?.(['README.md', 'docs', 'features', 'src']);
    },
    resolveId(id) {
      return id.startsWith(virtualPrefix) ? resolvedPrefix + id.slice(virtualPrefix.length) : undefined;
    },
    async load(id) {
      if (!id.startsWith(resolvedPrefix)) return undefined;
      const kind = id.slice(resolvedPrefix.length) as FrontierDocumentationVirtualKind;
      const result = await discoverFrontierDocumentation(options);
      if (kind === 'manifest') return `export default ${JSON.stringify(result.manifest, null, 2)};`;
      if (kind === 'search') return `export default ${JSON.stringify(result.manifest.pages.map((page) => ({ id: page.id, title: page.title, route: page.route })), null, 2)};`;
      if (kind === 'book') return `export default ${JSON.stringify(renderDocumentationBookHtml(result.manifest))};`;
      if (kind === 'client') return renderDocumentationClientModule();
      if (kind === 'module') return generateDocumentationModule(result.manifest);
      return undefined;
    },
    handleHotUpdate(ctx) {
      if (!hmr || !isDocumentationPath(ctx.file)) return;
      ctx.server?.ws?.send?.({ type: 'full-reload', path: '*' });
      return [];
    }
  };
}

export const frontierDocumentationVite = createFrontierDocumentationVitePlugin;

function isDocumentationPath(file: string): boolean {
  return /(?:README\.md|\/docs\/|\/features\/|\/src\/).*(?:\.mdx?|\.json|\.tsx?|\.jsx?)$/i.test(file.replace(/\\/g, '/'));
}
