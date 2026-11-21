// Runtime check for the web-safe entry points. Runs unchanged on Node, Bun,
// Deno and any runtime with Web Crypto, fetch `Request`/`Response` and ESM.
//
//   node scripts/edge-check.mjs
//   bun scripts/edge-check.mjs
//   deno run --allow-read scripts/edge-check.mjs
//
// Build first (`pnpm run build`): it imports from `dist/`.
import { createWebhookHandler, verifySignatureAsync } from '../dist/web.js';
import { buildWebhookPayload, createTestRequest, signWebhookBody } from '../dist/testing.js';

const SECRET = 'edge-check-secret';
const OLD_SECRET = 'edge-check-old-secret';
const VERIFY_TOKEN = 'edge-check-token';
const ORIGIN = 'https://example.test/webhook';

let checks = 0;
const assert = (condition, message) => {
  checks += 1;
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
};
const equal = (actual, expected, message) =>
  assert(actual === expected, `${message} (expected ${String(expected)}, got ${String(actual)})`);

const run = async () => {
  // Signature verification.
  const body = JSON.stringify(buildWebhookPayload('text'));
  const signature = await signWebhookBody(body, SECRET);
  assert(/^sha256=[0-9a-f]{64}$/.test(signature), 'signature format');
  equal(await verifySignatureAsync(body, signature, SECRET), true, 'valid signature');
  equal(await verifySignatureAsync(`${body} `, signature, SECRET), false, 'tampered body');
  equal(await verifySignatureAsync(body, signature, 'other-secret'), false, 'wrong secret');
  equal(
    await verifySignatureAsync(body, signature, ['other-secret', SECRET]),
    true,
    'rotated secrets',
  );
  equal(await verifySignatureAsync(body, undefined, SECRET), false, 'missing header');

  // Handler.
  const seen = [];
  const handler = createWebhookHandler({
    appSecrets: [SECRET, OLD_SECRET],
    verifyToken: VERIFY_TOKEN,
    maxBodyBytes: 4096,
    onError: (error) => {
      throw error;
    },
  });
  handler.on('message', ({ message }) => {
    seen.push(message.id);
  });

  const ok = await handler.handleRequest(
    new Request(
      `${ORIGIN}?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=abc123`,
    ),
  );
  equal(ok.status, 200, 'handshake status');
  equal(await ok.text(), 'abc123', 'handshake challenge');

  const denied = await handler.handleRequest(
    new Request(`${ORIGIN}?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc123`),
  );
  equal(denied.status, 403, 'handshake with wrong token');

  const signed = await createTestRequest({ payload: buildWebhookPayload('text'), secret: SECRET });
  equal((await handler.handleRequest(signed)).status, 200, 'signed delivery status');
  equal(seen.length, 1, 'handler called once');

  const rotated = await createTestRequest({
    payload: buildWebhookPayload('text'),
    secret: OLD_SECRET,
  });
  equal((await handler.handleRequest(rotated)).status, 200, 'previous secret accepted');

  const forged = await createTestRequest({
    payload: buildWebhookPayload('text'),
    secret: 'attacker',
  });
  equal((await handler.handleRequest(forged)).status, 401, 'bad signature');
  equal(seen.length, 2, 'rejected delivery not dispatched');

  const oversize = await createTestRequest({
    body: JSON.stringify({ pad: 'x'.repeat(8192) }),
    secret: SECRET,
  });
  equal((await handler.handleRequest(oversize)).status, 413, 'oversize body');

  console.log(`edge-check OK (${checks} assertions)`);
};

run().catch((error) => {
  console.error(error);
  if (typeof process !== 'undefined' && process.exit) {
    process.exit(1);
  }
  throw error;
});
