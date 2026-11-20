# @solvejet/whatsapp-cloud-api

Zero-dependency, fetch-based TypeScript SDK for the WhatsApp Cloud API.

[![CI](https://github.com/SolveJet/whatsapp-cloud-api/actions/workflows/ci.yml/badge.svg)](https://github.com/SolveJet/whatsapp-cloud-api/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@solvejet/whatsapp-cloud-api.svg)](https://www.npmjs.com/package/@solvejet/whatsapp-cloud-api)
[![npm downloads](https://img.shields.io/npm/dm/@solvejet/whatsapp-cloud-api.svg)](https://www.npmjs.com/package/@solvejet/whatsapp-cloud-api)
[![Node version](https://img.shields.io/node/v/@solvejet/whatsapp-cloud-api.svg)](https://nodejs.org)
[![Published with provenance](https://img.shields.io/badge/provenance-OIDC%20trusted%20publishing-brightgreen)](https://www.npmjs.com/package/@solvejet/whatsapp-cloud-api)
[![Socket Badge](https://badge.socket.dev/npm/package/@solvejet/whatsapp-cloud-api)](https://socket.dev/npm/package/@solvejet/whatsapp-cloud-api)
[![license](https://img.shields.io/npm/l/@solvejet/whatsapp-cloud-api.svg)](./LICENSE)

```sh
npm install @solvejet/whatsapp-cloud-api
```

```ts
import { WhatsAppClient } from '@solvejet/whatsapp-cloud-api';

const client = new WhatsAppClient({
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
});

const res = await client.messages.sendText('15551234567', 'Hello from the SDK');
console.log(res.messages[0]?.id); // the WhatsApp message ID (WAMID)
```

Runnable webhook servers for Express, Next.js, Hono and Fastify are in [`examples/`](./examples/README.md). Requires Node.js 20 or newer. Run `npm audit signatures` after installing to check the package against its source build.

> **Not affiliated with Meta.** This is an independent, open-source client for Meta's WhatsApp Cloud API. It is not endorsed by Meta or WhatsApp.

## Why this library

- **Zero runtime dependencies.** It uses the platform `fetch` and `AbortController`, so there is no `axios` or `node-fetch` in your tree.
- **Fully typed.** Every method, option, payload and webhook event ships with `.d.ts` declarations, for both ESM and CommonJS.
- **Fail-fast validation.** Documented API limits (body and footer lengths, button counts, list rows, reaction emoji and more) are checked before the request is sent. Nothing is silently truncated.
- **Typed errors.** Rate limits, re-engagement, authentication, validation and webhook failures are distinct classes. Requests retry `429`, `5xx` and network errors with backoff.
- **Business-scoped user IDs.** Webhook types expose BSUID and username fields, and senders accept a `{ bsuid }` recipient. See [Usernames and BSUIDs](#usernames-and-bsuids).
- **Released from CI** with npm provenance through OIDC trusted publishing.

| Capability                | API                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Send text & media         | `client.messages.sendText`, `sendImage`, `sendVideo`, `sendAudio`, `sendDocument`, `sendSticker`              |
| Send templates            | `client.messages.sendTemplate`                                                                                |
| Interactive messages      | `sendInteractiveButtons`, `sendInteractiveList`, `sendInteractiveCtaUrl`, `sendInteractiveFlow`               |
| Location, contacts, more  | `sendLocation`, `sendContacts`, `sendLocationRequest`, `sendProduct`, `sendProductList`, `sendAddressMessage` |
| Reactions & typing        | `sendReaction`, `markAsRead`, `sendTypingIndicator`                                                           |
| Any other message body    | `client.messages.sendRaw`                                                                                     |
| Upload & download media   | `client.media.upload`, `getUrl`, `download`, `delete`                                                         |
| Receive & verify webhooks | `verifyWebhook`, `verifySignature`, `parseWebhook`, `extractMessages`, `WebhookHandler`                       |
| Manage phone numbers      | `client.phoneNumbers` (register, verify, business profile, two-step PIN)                                      |
| Manage WABAs              | `client.waba` (list numbers, subscribe webhooks)                                                              |
| Manage templates          | `client.templates` (list, get, create, edit, delete)                                                          |
| Manage flows              | `client.flows` (create, publish, update JSON, list, get, deprecate, delete, assets, preview)                  |
| Block & unblock users     | `client.blocks` (block, unblock, list)                                                                        |
| Calling settings & calls  | `client.calls` (getSettings, updateSettings, initiate, preAccept, accept, reject, terminate)                  |

## How it compares

Facts below were checked against the npm registry and GitHub on 2026-11-21. Check each project yourself before choosing; they change.

| Option                                                                                      | What it is                                   | Status when checked                                                    | Runtime dependencies                    |
| ------------------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------- |
| This package                                                                                | Cloud API SDK for TypeScript                 | Actively released                                                      | None                                    |
| [`whatsapp`](https://www.npmjs.com/package/whatsapp) (Meta's Node.js SDK)                   | Cloud API SDK                                | GitHub repository archived; last npm release `0.0.5-Alpha`, 2023-04-11 | `@types/node`                           |
| [`whatsapp-cloud-api`](https://www.npmjs.com/package/whatsapp-cloud-api)                    | Cloud API wrapper                            | GitHub repository archived; last npm release `0.3.1`, 2023-04-11       | `axios`, `express`, `dotenv` and others |
| [`whatsapp-api-js`](https://www.npmjs.com/package/whatsapp-api-js)                          | Cloud API library                            | Last npm release `6.3.0`, 2026-09-21                                   | None                                    |
| [`@great-detail/whatsapp`](https://www.npmjs.com/package/@great-detail/whatsapp)            | Cloud API SDK                                | Last npm release `9.2.0`, 2026-09-22                                   | `ky`, `openapi-fetch`                   |
| [`@kapso/whatsapp-cloud-api`](https://www.npmjs.com/package/@kapso/whatsapp-cloud-api)      | Cloud API SDK                                | Last npm release `0.4.0`, 2026-10-23                                   | `zod`                                   |
| [Baileys](https://github.com/WhiskeySockets/Baileys), [whatsapp-web.js](https://wwebjs.dev) | Unofficial clients that emulate WhatsApp Web | Not the Cloud API                                                      | See each project                        |

Baileys and whatsapp-web.js drive a regular WhatsApp account through the WhatsApp Web protocol or browser automation, not through Meta's business API. WhatsApp's [terms of service](https://www.whatsapp.com/legal/terms-of-service) restrict automated or unauthorized access to its services, so check them before using these projects for a business integration. The Cloud API, through this package or one of the other SDKs above, is the supported route for business messaging.

Pick this package when you want no runtime dependencies, strict TypeScript types and a small, testable surface. Pick another if it covers something you need that this one does not, for example a hosted platform or generated OpenAPI clients.

## Install

```sh
pnpm add @solvejet/whatsapp-cloud-api
# or: npm install @solvejet/whatsapp-cloud-api
# or: yarn add @solvejet/whatsapp-cloud-api
```

## Runtime support

| Runtime            | Status                                                    |
| ------------------ | --------------------------------------------------------- |
| Node.js 20         | Verified in CI (built package is imported as ESM and CJS) |
| Node.js 22, 24     | Verified in CI (lint, typecheck, tests, build)            |
| Bun, Deno          | Untested                                                  |
| Cloudflare Workers | Untested                                                  |

The HTTP client only needs `fetch` and `AbortController`. The webhook helpers import `node:crypto`, so they need a runtime that provides it.

**Verified against:** Graph API `v26.0`, Meta changelog checked 2026-11-21. Change it with the `apiVersion` option.

## Configuration

`WhatsAppClient` takes a single configuration object. Only `accessToken` is
required; everything else has a sensible default.

| Option              | Type     | Default                      | Description                                                                      |
| ------------------- | -------- | ---------------------------- | -------------------------------------------------------------------------------- |
| `accessToken`       | `string` | — (required)                 | Permanent or temporary access token used to authenticate requests.               |
| `phoneNumberId`     | `string` | —                            | Default sender phone number ID for messaging and media calls.                    |
| `businessAccountId` | `string` | —                            | WhatsApp Business Account (WABA) ID. Default id for `client.waba` methods.       |
| `apiVersion`        | `string` | `v26.0`                      | Graph API version to target.                                                     |
| `baseUrl`           | `string` | `https://graph.facebook.com` | Base URL for the Graph API (override for a proxy or a mock).                     |
| `timeoutMs`         | `number` | `30000`                      | Per-attempt request timeout in milliseconds.                                     |
| `maxRetries`        | `number` | `2`                          | Max retries on `429`/`5xx`/network errors (total attempts = `maxRetries` + `1`). |

The defaults are exported as `DEFAULT_API_VERSION`, `DEFAULT_BASE_URL`,
`DEFAULT_TIMEOUT_MS`, and `DEFAULT_MAX_RETRIES`.

```ts
const client = new WhatsAppClient({
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
  businessAccountId: process.env.WHATSAPP_WABA_ID,
  apiVersion: 'v26.0',
  timeoutMs: 15_000,
  maxRetries: 3,
});

client.getPhoneNumberId(); // the configured default sender, if any
client.getApiVersion(); // 'v26.0'
client.getBaseUrl(); // 'https://graph.facebook.com/v26.0'
```

**Per-call phone number override.** Every message and media method accepts an
optional trailing `phoneNumberId` so a single client can send from multiple
numbers. When omitted, the client's configured `phoneNumberId` is used; if
neither is set, the call throws `WhatsAppValidationError`.

The HTTP core retries idempotent failures (`429`, `5xx`, and network/timeout
errors) with jittered exponential backoff, honoring a `Retry-After` header when
present.

## Messaging

```ts
// Send a pre-approved template.
await client.messages.sendTemplate('15551234567', {
  name: 'hello_world',
  language: { code: 'en_US' },
});

// Send an interactive message with up to three reply buttons.
await client.messages.sendInteractiveButtons('15551234567', {
  body: 'Did this answer your question?',
  buttons: [
    { id: 'yes', title: 'Yes' },
    { id: 'no', title: 'No' },
  ],
});
```

### Replying to a message

Pass `replyToMessageId` as the trailing `SendOptions` argument on any sender to
thread the outbound message as a reply. The SDK injects a root-level
`context: { message_id }` into the request body.

```ts
// `incomingMessageId` is the WAMID of the message you are replying to.
await client.messages.sendText('15551234567', 'Thanks, got it!', undefined, {
  replyToMessageId: incomingMessageId,
});
```

### Interactive call-to-action URL

```ts
await client.messages.sendInteractiveCtaUrl('15551234567', {
  body: 'Browse our latest collection.',
  displayText: 'Open store',
  url: 'https://example.com/store',
});
```

### Address message (India and Singapore)

Prompts the user for a delivery address. `country` is required (`IN` or `SG`),
and camelCase fields are mapped to the API's snake_case shape for you. The
submitted address arrives via webhook as an interactive `nfm_reply` whose
`response_json` is a raw JSON string you parse yourself (see
[Webhooks](#webhooks)).

```ts
await client.messages.sendAddressMessage('15551234567', {
  body: 'Where should we deliver your order?',
  country: 'IN',
  values: { name: 'Ada Lovelace', phoneNumber: '15551234567', inPinCode: '560001' },
});
```

### Typing indicator

Mark an inbound message as read and show a typing indicator. It is dismissed
once you send a message or after about 25 seconds.

```ts
await client.messages.sendTypingIndicator('wamid.HBgL...');
```

## Usernames and BSUIDs

Users who enable WhatsApp usernames may not share a phone number. Meta then identifies them by a business-scoped user ID (BSUID, for example `US.13491208655302741918`) and may omit `wa_id`, `from` or `recipient_id`. `wa_id`, `from` and `recipient_id` are typed as `string` for backward compatibility but may be absent in webhooks for username-based users, so do not assume they are always present; check them at runtime.

Webhook types expose these optional fields:

| Where              | Fields                                                                            |
| ------------------ | --------------------------------------------------------------------------------- |
| `value.contacts[]` | `user_id`, `parent_user_id`, `profile.username`                                   |
| Incoming messages  | `from_user_id`, `from_parent_user_id`, `group_id`                                 |
| Statuses           | `recipient_user_id`, `recipient_parent_user_id`                                   |
| `system` messages  | `system.user_id`, `parent_user_id`, `previous_user_id`, `previous_parent_user_id` |

To send to a BSUID, pass `{ bsuid }` instead of a phone number to any sender. The SDK sends it as `recipient` and omits `to`.

```ts
await client.messages.sendText({ bsuid: 'US.13491208655302741918' }, 'Hello');
```

Details are in [Meta's business-scoped user ID documentation](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-scoped-user-ids). When a send goes to a BSUID, `contacts[].wa_id` in the response can be absent; read `contacts[].user_id`.

## Raw sends

`client.messages.sendRaw(body, options?)` posts any body to `{phoneNumberId}/messages` and adds `messaging_product: 'whatsapp'` if you leave it out. Use it for message shapes Meta has released before this SDK has a typed sender. The body is not validated client-side. Retries, timeouts and errors work as for the other senders, and you can declare the response type.

```ts
const result = await client.messages.sendRaw<{ messages: { id: string }[] }>({
  to: '15551234567',
  type: 'text',
  text: { body: 'Hello' },
});
```

## Media

Upload a file once to get a reusable media `id`, then send it with any of the
media senders. `upload` accepts a `Blob`/`File`, or `{ file, type, filename }`
wrapping `Blob`/`Uint8Array`/`ArrayBuffer` bytes. A content type is required: it
comes from a `Blob`'s `type` or the explicit `type`, otherwise `upload` throws
`WhatsAppValidationError`.

```ts
import { readFile } from 'node:fs/promises';

const bytes = await readFile('./photo.jpg');
const { id } = await client.media.upload({
  file: bytes,
  type: 'image/jpeg',
  filename: 'photo.jpg',
});

// Reuse the id with any media sender.
await client.messages.sendImage('15551234567', { id });
```

Resolve a media id to its metadata, then download the bytes. The `url` returned
by `getUrl` is short-lived and must be fetched with the access token —
`download` handles that for you (it adds the bearer token and a `User-Agent`)
and returns the raw bytes as a `Uint8Array`.

```ts
const info = await client.media.getUrl(id);
console.log(info.mimeType, info.fileSize); // e.g. "image/jpeg" 20481

// download() calls getUrl() internally, then fetches the short-lived url.
const { data, mimeType } = await client.media.download(id);
await writeFile('./downloaded.jpg', data); // data is a Uint8Array
```

Delete media you no longer need:

```ts
const { success } = await client.media.delete(id);
```

Uploaded media is retained by Meta for **30 days**, after which the id stops
resolving. Per-type upload size limits apply: images 5 MB, video 16 MB, audio
16 MB, documents 100 MB, and stickers 100 KB (static) / 500 KB (animated).

## Phone number & WABA management

Manage the business account and its phone numbers directly from the client.
`client.phoneNumbers` methods default to the configured `phoneNumberId`, and
`client.waba` methods default to the configured `businessAccountId`; both accept
an optional trailing id to override the default per call. When neither is set,
the call throws `WhatsAppValidationError`.

```ts
// List the phone numbers owned by the business account.
const { data } = await client.waba.listPhoneNumbers();
console.log(data.map((n) => n.display_phone_number));

// Read the WhatsApp Business Profile for the configured phone number.
const profile = await client.phoneNumbers.getBusinessProfile();
console.log(profile?.about);

// Register a phone number for the Cloud API with its six-digit two-step PIN.
await client.phoneNumbers.register({ pin: '123456' });
```

The verification flow (`requestVerificationCode`/`verifyCode`), two-step PIN
management (`setTwoStepPin` — there is no API to disable it), profile updates
(`updateBusinessProfile`), and app webhook subscriptions
(`client.waba.subscribeApp`/`unsubscribeApp`/`listSubscribedApps`) are all
available. Phone-number deletion is intentionally out of scope.

## Webhooks

Receiving inbound messages and delivery statuses is a two-step model:

1. **GET verification.** When you configure the webhook, Meta sends a GET request with `hub.mode`, `hub.verify_token`, and `hub.challenge`. Echo the raw `hub.challenge` back with a `200` when the token matches your verify token; otherwise return `403`. The challenge must be the raw response body, not JSON.
2. **POST deliveries.** Meta POSTs event payloads signed with `X-Hub-Signature-256`. Verify the signature against the **raw request body** using your App Secret, return `200` quickly, then process.

Three secrets are involved, and they are not interchangeable:

- **Verify token:** a string you define, used only for the GET handshake.
- **App Secret:** from your Meta app settings, used to verify `X-Hub-Signature-256`.
- **Access token:** used to _send_ messages, never for webhooks.

`WebhookHandler` binds the secrets once. `handler.handleVerification(query)` answers the handshake, and `handler.parse(rawBody, signature)` verifies the signature and parses the payload, throwing `WhatsAppWebhookError` when the signature is missing or invalid.

Signature checking is on only when you pass `appSecret`. If you leave the `appSecret` key out, `parse` accepts unsigned bodies, so only do that when something else authenticates the request. If you pass `appSecret` or `verifyToken` with an `undefined` or empty value (for example an unset environment variable), the constructor throws a `WhatsAppWebhookError` instead of quietly turning verification off. `verifySignature` returns `false`, and the verify-token handshake returns `403`, whenever the configured secret is empty.

`handler.parse` rejects bodies over 3 MiB (Meta's documented maximum) before hashing or parsing them. Raise the limit with `new WebhookHandler({ maxBodyBytes })`, or pass `false` to turn it off.

### Webhooks: raw body

The signature is computed over the exact bytes Meta sent. Pass the **raw body bytes** to `parse`, `isValid` and `verifySignature`: a `Buffer`, `Uint8Array`, `ArrayBuffer` or the unmodified body string. Never pass a re-serialized `req.body` (for example `JSON.stringify(req.body)`), because the bytes change and a valid signature fails.

Respond only after the payload parsed. Return `401` for a bad signature, and `200` for a signed payload that cannot be parsed (log it), so Meta does not retry a permanently bad payload for days.

Express:

```ts
import express from 'express';
import { WebhookHandler, WhatsAppWebhookError } from '@solvejet/whatsapp-cloud-api';

const handler = new WebhookHandler({
  appSecret: process.env.WHATSAPP_APP_SECRET!,
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN!,
});
const app = express();

app.get('/webhook', (req, res) => {
  const query: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string') query[key] = value;
  }
  const { statusCode, body } = handler.handleVerification(query);
  res.status(statusCode).type('text/plain').send(body);
});

// express.raw keeps the body as a Buffer. Do not put express.json() before this route.
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const rawBody = req.body as Buffer;
  const signature = req.get('x-hub-signature-256');
  if (!handler.isValid(rawBody, signature)) {
    res.sendStatus(401); // bad signature
    return;
  }
  try {
    const { messages, statuses } = handler.parse(rawBody, signature);
    res.sendStatus(200);
    // handle messages and statuses here, without letting one failure drop the rest
  } catch (error) {
    if (error instanceof WhatsAppWebhookError) {
      console.error('Ignoring malformed webhook payload:', error.message);
      res.sendStatus(200); // signed but unparseable: do not make Meta retry it
      return;
    }
    console.error(error);
    res.sendStatus(500);
  }
});
```

Next.js App Router (`app/api/webhook/route.ts`):

```ts
import { WebhookHandler, WhatsAppWebhookError } from '@solvejet/whatsapp-cloud-api';

const handler = new WebhookHandler({
  appSecret: process.env.WHATSAPP_APP_SECRET!,
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN!,
});

export async function GET(request: Request) {
  const query: Record<string, string | undefined> = {};
  for (const [key, value] of new URL(request.url).searchParams) query[key] = value;
  const { statusCode, body } = handler.handleVerification(query);
  return new Response(body, { status: statusCode, headers: { 'content-type': 'text/plain' } });
}

export async function POST(request: Request) {
  const rawBody = await request.arrayBuffer(); // not request.json()
  const signature = request.headers.get('x-hub-signature-256') ?? undefined;
  if (!handler.isValid(rawBody, signature)) {
    return new Response('Unauthorized', { status: 401 });
  }
  try {
    const { messages } = handler.parse(rawBody, signature);
    // Serverless functions can stop after the response, so await the work. Settle
    // every message on its own so one failure does not drop the batch.
    const results = await Promise.allSettled(messages.map((message) => handleMessage(message)));
    for (const result of results) {
      if (result.status === 'rejected') console.error(result.reason);
    }
    return new Response('OK');
  } catch (error) {
    if (error instanceof WhatsAppWebhookError) {
      console.error('Ignoring malformed webhook payload:', error.message);
      return new Response('OK'); // signed but unparseable: do not make Meta retry it
    }
    console.error(error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
```

Hono and Fastify versions are in [`examples/`](./examples/README.md).

### Handling events

`extractMessages` and `extractStatuses` flatten a payload. Message types the SDK does not model still parse; handle them in the `default` branch.

```ts
import { extractMessages, extractStatuses, parseWebhook } from '@solvejet/whatsapp-cloud-api';

const payload = parseWebhook(rawBody); // after verifying the signature
for (const message of extractMessages(payload)) {
  switch (message.type) {
    case 'text':
      console.log(`text from ${message.from_user_id ?? message.from}: ${message.text.body}`);
      break;
    case 'interactive':
      console.log(message.interactive.button_reply?.id ?? message.interactive.list_reply?.id);
      break;
    default:
      console.log(`unhandled message type: ${message.type}`);
  }
}
for (const status of extractStatuses(payload)) {
  console.log(`message ${status.id} -> ${status.status}`);
}
```

Return `200` fast and do the work afterwards. Meta retries deliveries, so deduplicate on the message id (`wamid`).

`extractMessages`, `extractStatuses` and `parse` read the `messages` webhook field only. Other fields, such as `calls`, `message_template_status_update` or `account_update`, are not parsed into `messages` or `statuses`. Their payload is still available in `parsed.raw`.

## More documentation

- [Template management](./docs/templates.md)
- [Flows management](./docs/flows.md)
- [Block API](./docs/blocks.md)
- [Calling](./docs/calling.md)
- [Error handling](./docs/errors.md)
- [Migrating from `whatsapp-cloud-api`](./docs/migrating-from-whatsapp-cloud-api.md)
- [Migrating from Meta's `whatsapp` package](./docs/migrating-from-meta-whatsapp-sdk.md)
- [All documentation](./docs/README.md)
- [Examples](./examples/README.md)

## FAQ

### How do I send a WhatsApp template message?

Use `client.messages.sendTemplate` with the approved template name and language. Template messages are the only messages you can send outside the 24-hour customer service window.

```ts
await client.messages.sendTemplate('15551234567', {
  name: 'hello_world',
  language: { code: 'en_US' },
});
```

To create, list, edit, or delete templates, see [Template management](./docs/templates.md).

### Does this SDK have any dependencies?

No runtime dependencies. It uses the `fetch` and `AbortController` built into Node.js 20+.

### Which Node.js versions are supported?

Node.js 20 or newer, as `engines.node` states. CI imports the built ESM and CommonJS entry points on Node 20 and runs the full checks on Node 22 and 24. See [Runtime support](#runtime-support).

### Do I need a Meta WhatsApp Business account?

Yes. You need a WhatsApp Business Account (WABA), a business phone number ID and an access token. The SDK calls Meta's Graph API on your behalf.

### How do I handle rate limits and errors?

Every API failure is a typed subclass of `WhatsAppApiError`, for example `WhatsAppRateLimitError` (with `retryAfterMs`) and `WhatsAppReEngagementError`. See [Error handling](./docs/errors.md).

## Roadmap

- **Calling media plane (WebRTC/SIP).** Optional helpers for the real-time media layer of the Calling API, which is currently the caller's responsibility (see [Calling](./docs/calling.md)). The REST signaling and settings are implemented in `client.calls`.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the development setup and release process, and please follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Security

Please report vulnerabilities privately. See [SECURITY.md](./SECURITY.md) for the process.

## License

[MIT](./LICENSE) © 2026 SolveJet
