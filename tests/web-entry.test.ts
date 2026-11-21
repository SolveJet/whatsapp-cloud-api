import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createWebhookHandler } from '../src/web.js';
import { buildWebhookPayload, createTestRequest } from '../src/testing.js';

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), '../src');

const RELATIVE_IMPORT = /(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g;

/** Collects every source file reachable from `entry` through relative imports. */
const reachable = (entry: string): string[] => {
  const seen = new Set<string>();
  const queue = [resolve(srcDir, entry)];
  while (queue.length > 0) {
    const file = queue.pop();
    if (file === undefined || seen.has(file)) {
      continue;
    }
    seen.add(file);
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(RELATIVE_IMPORT)) {
      const target = match[1];
      if (target !== undefined) {
        queue.push(resolve(dirname(file), target.replace(/\.js$/, '.ts')));
      }
    }
  }
  return [...seen];
};

describe('web-safe entries', () => {
  it.each(['web.ts', 'testing.ts', 'resources/webhook-handler-core.ts'])(
    '%s reaches no node: import and no Buffer',
    (entry) => {
      const files = reachable(entry);
      expect(files.length).toBeGreaterThan(1);
      for (const file of files) {
        const text = readFileSync(file, 'utf8');
        expect(text, file).not.toMatch(/node:/);
        expect(text, file).not.toMatch(/\bBuffer\b/);
      }
    },
  );

  it('keeps the default entry from importing testing', () => {
    const files = reachable('index.ts');
    expect(files.some((file) => file.endsWith('/testing.ts'))).toBe(false);
  });

  it('runs the web handler end to end with Web Crypto', async () => {
    const handler = createWebhookHandler({ appSecrets: 'web-secret', verifyToken: 'tok' });
    const seen: string[] = [];
    handler.on('message', (event) => {
      seen.push(event.message.id);
    });
    const ok = await createTestRequest({
      payload: buildWebhookPayload('text'),
      secret: 'web-secret',
    });
    expect((await handler.handleRequest(ok)).status).toBe(200);
    const bad = await createTestRequest({ payload: buildWebhookPayload('text'), secret: 'other' });
    expect((await handler.handleRequest(bad)).status).toBe(401);
    expect(seen).toEqual(['wamid.TEST_TEXT']);
    const handshake = await handler.handleRequest(
      new Request('https://example.com/w?hub.mode=subscribe&hub.verify_token=tok&hub.challenge=42'),
    );
    expect(await handshake.text()).toBe('42');
  });
});
