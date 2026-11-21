# Using @solvejet/whatsapp-cloud-api (notes for coding agents)

This file ships inside the npm package. It describes how to use the SDK correctly in an application. It is guidance about this library only. Full docs: https://solvejet.github.io/whatsapp-cloud-api/ and https://solvejet.github.io/whatsapp-cloud-api/llms-full.txt. Context7 library ID: `/solvejet/whatsapp-cloud-api`.

## Install and send

```sh
npm install @solvejet/whatsapp-cloud-api
```

```ts
import { WhatsAppClient } from '@solvejet/whatsapp-cloud-api';

const client = new WhatsAppClient({
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
});
const res = await client.messages.sendText('15551234567', 'Hello');
console.log(res.messages[0]?.id);
```

Use the scoped package name. The unscoped `whatsapp-cloud-api` and Meta's `whatsapp` are different, archived packages. Node.js 20+, no runtime dependencies. Recipients are international-format phone number strings; use `{ bsuid }` for username-only users. For a body the SDK does not model, use `client.messages.sendRaw`.

## Receive webhooks

```ts
import { createWebhookHandler } from '@solvejet/whatsapp-cloud-api'; // edge runtimes: '@solvejet/whatsapp-cloud-api/web'

const webhook = createWebhookHandler({
  appSecrets: process.env.WHATSAPP_APP_SECRET!, // a string, or an array while rotating secrets
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN!,
});
webhook.on('message', async ({ message }) => console.log(message.id, message.type));
// Next.js, Hono, Workers, Bun, Deno: return webhook.handleRequest(request)
// Express, Fastify: webhook.handleDelivery(rawBody, req.headers['x-hub-signature-256'])
```

`handleRequest` answers `200` (valid delivery), `401` (bad signature or no tenant), `413` (body over `maxBodyBytes`, 3 MiB), `405` (other method) and `403` (failed GET handshake). Test handlers with `@solvejet/whatsapp-cloud-api/testing` (`buildWebhookPayload`, `createTestRequest`, `signWebhookBody`).

## Common mistakes

1. **Hashing parsed JSON.** Signatures cover the raw bytes. Pass the unparsed body (string, Buffer, `Uint8Array`) or the whole `Request`, never `JSON.stringify(req.body)`.
2. **Wrong secret.** `appSecrets` is the Meta App Secret (App settings > Basic). It is not the access token or the verify token.
3. **Leaving the secret out.** Without `appSecrets` the handler accepts unsigned deliveries and warns (`WHATSAPP_WEBHOOK_UNSIGNED`). Always set it in production. `allowUnsigned: true` only silences the warning.
4. **Free-form messages outside the 24-hour window.** Send an approved template instead (`client.messages.sendTemplate`). Error 131047 is `WhatsAppReEngagementError`; do not retry it in a loop.
5. **Own retry loops.** The SDK retries `429`, `5xx` and network errors (2 retries by default). Branch on `WhatsAppRateLimitError`, `WhatsAppAuthenticationError` and `WhatsAppApiError`.
6. **Invented templates.** Templates must already be approved by Meta. List them with `client.templates`.
7. **Slow webhook responses.** Meta redelivers. Use `dedupe: createMemoryDedupe()` (per process) and, on serverless, `ackMode: 'before'` with `waitUntil`.

Not affiliated with Meta or WhatsApp. MIT licence.
