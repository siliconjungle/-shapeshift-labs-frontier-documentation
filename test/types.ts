import {
  createDocumentationManifest,
  defineDocumentationPage,
  type FrontierDocumentationManifest
} from '../dist/index.js';
import { discoverFrontierDocumentation } from '../dist/node.js';
import { frontierDocumentationVite } from '../dist/vite.js';

const page = defineDocumentationPage({
  title: 'Guide',
  sections: [{ title: 'Overview', content: 'Hello' }]
});

const manifest: FrontierDocumentationManifest = createDocumentationManifest({
  pages: [page],
  integrations: { fuzz: false }
});

void manifest.pages[0]?.sections[0]?.content;
void discoverFrontierDocumentation({ rootDir: process.cwd(), integrations: { autoDiscovery: false } });
void frontierDocumentationVite({ hmr: false });
