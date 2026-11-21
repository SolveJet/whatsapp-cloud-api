import { createMemoryDedupe, createWebhookHandler } from '@solvejet/whatsapp-cloud-api';
declare const rawBody: Buffer; // the exact bytes of the request, before any JSON parsing
declare const signatureHeader: string | undefined; // the X-Hub-Signature-256 header value
declare const query: Record<string, string | undefined>; // decoded query string of the GET request
declare const request: Request; // a fetch-style request
// #region create
const webhook = createWebhookHandler({
  appSecrets: process.env.WHATSAPP_APP_SECRET!, // or an array while you rotate the secret
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN!,
});
// #endregion
// #region events
webhook.on('message', async ({ message, ctx }) => {
  if (message.type === 'text') {
    console.log(`text from ${message.from_user_id ?? message.from}: ${message.text.body}`);
  }
  console.log(`received on WABA ${ctx.wabaId}`);
});
webhook.on('status', ({ status }) => {
  console.log(`message ${status.id} -> ${status.status}`);
});
webhook.on('call', ({ event }) => {
  if (event.kind === 'terminate') console.log(`call ended after ${event.value.duration ?? 0}s`);
});
webhook.on('template', ({ event }) => {
  console.log(`template event: ${event.kind}`);
});
webhook.on('unknown', ({ field, value }) => {
  console.log(`field ${field} is not modelled yet`, value);
});
// on() returns a function that removes the handler again.
const stop = webhook.on('error', ({ error }) => console.error(error));
stop();
// #endregion
// #region delivery
// Node frameworks: pass the raw bytes and answer with the status it returns.
const verification = webhook.handleVerification(query); // { statusCode, body }
const result = await webhook.handleDelivery(rawBody, signatureHeader);
// result.httpStatus is 200, 401, 413 or 500.
// #endregion
// #region request
// Fetch-style runtimes: one call answers both the GET handshake and the POST delivery.
const response: Response = await webhook.handleRequest(request);
// #endregion
// #region options
const configured = createWebhookHandler({
  appSecrets: [process.env.WHATSAPP_APP_SECRET!, process.env.WHATSAPP_APP_SECRET_OLD!],
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN!,
  dedupe: createMemoryDedupe({ ttlMs: 60 * 60 * 1000, maxEntries: 10_000 }),
  maxEventAgeSeconds: 15 * 60, // skip message and status events older than 15 minutes
  concurrency: 8, // events handled at the same time within one delivery
  retryOnHandlerError: true, // answer 500 when a handler throws so Meta redelivers
  onError: (error, info) => console.error('handler failed', info.event?.name, error),
});
// #endregion
// #region tenants
const multiTenant = createWebhookHandler({
  // Pick the secrets and verify token from the request, for example from the URL path.
  resolveTenant: (incoming) => {
    const tenantId = new URL(incoming.url).pathname.split('/').pop();
    return tenantId === 'acme'
      ? { appSecrets: process.env.ACME_APP_SECRET!, verifyToken: process.env.ACME_VERIFY_TOKEN! }
      : undefined; // unknown tenant: 401 on POST, 403 on GET
  },
});
// #endregion
console.log(verification, result, response, configured, multiTenant);
