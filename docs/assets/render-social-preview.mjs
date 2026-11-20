// Renders social-preview.html to social-preview.png (1280x640).
// Playwright is not a dependency of this repo. Provide it yourself, for example:
//   npm install --prefix /tmp/pw playwright && NODE_PATH=/tmp/pw/node_modules node docs/assets/render-social-preview.mjs
// ES modules ignore NODE_PATH, so this script resolves Playwright from PLAYWRIGHT_DIR
// (default: /tmp/pw) with createRequire.
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dir = new URL('.', import.meta.url);
const require = createRequire(pathToFileURL(`${process.env.PLAYWRIGHT_DIR ?? '/tmp/pw'}/`));
const { chromium } = require('playwright');

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 640 },
  deviceScaleFactor: 1,
});
await page.goto(new URL('social-preview.html', dir).href, { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  window.lucide.createIcons();
  await document.fonts.ready;
});
await page.waitForTimeout(500);
const missing = await page.evaluate(() => document.querySelectorAll('i[data-lucide]').length);
if (missing > 0) throw new Error(`${missing} Lucide icons were not rendered`);
await page.screenshot({
  path: fileURLToPath(new URL('social-preview.png', dir)),
  clip: { x: 0, y: 0, width: 1280, height: 640 },
});
await browser.close();
