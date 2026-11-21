// Serve the sitemap at the conventional /sitemap.xml as well as sitemap-index.xml.
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dist = new URL('../dist/', import.meta.url);
copyFileSync(
  fileURLToPath(new URL('sitemap-0.xml', dist)),
  fileURLToPath(new URL('sitemap.xml', dist)),
);
