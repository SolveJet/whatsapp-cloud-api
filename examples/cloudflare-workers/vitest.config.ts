import { fileURLToPath } from 'node:url';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

const dist = (file: string) => fileURLToPath(new URL(`../../dist/${file}`, import.meta.url));

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: { WHATSAPP_APP_SECRET: 'worker-secret', WHATSAPP_VERIFY_TOKEN: 'worker-token' },
      },
    }),
  ],
  resolve: {
    alias: {
      '@solvejet/whatsapp-cloud-api/web': dist('web.js'),
      '@solvejet/whatsapp-cloud-api/testing': dist('testing.js'),
    },
  },
});
