# @solvejet/whatsapp-cloud-api

[![CI](https://github.com/solvejet/whatsapp-cloud-api/actions/workflows/ci.yml/badge.svg)](https://github.com/solvejet/whatsapp-cloud-api/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@solvejet/whatsapp-cloud-api.svg)](https://www.npmjs.com/package/@solvejet/whatsapp-cloud-api)
[![license](https://img.shields.io/npm/l/@solvejet/whatsapp-cloud-api.svg)](./LICENSE)

TypeScript SDK for the [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api) — the Meta-hosted WhatsApp Business Platform. It provides a typed, zero-runtime-dependency client built on the native `fetch` available in Node 20+.

> **Status: active development.** Outbound messaging is implemented: text, media (image, video, audio, document, sticker), location, the full contacts object (addresses, org, URLs, birthday, structured name parts), templates, interactive buttons and lists with rich headers (text, image, video, document), the interactive CTA URL / flow / location-request / product / product-list senders, reactions, and mark-as-read. Every sender accepts a `replyToMessageId` to thread a reply via message context, and documented limits are validated client-side before a request is sent. **Inbound webhooks** are also implemented: the GET verification handshake, constant-time `X-Hub-Signature-256` validation, and typed parsing of incoming messages and status updates. **Media** upload and download are also implemented: upload a file to get a reusable media `id`, resolve its short-lived download URL, download the bytes with the token, and delete it. Template management is not implemented yet. While on `0.x`, minor versions may include breaking changes as the remaining surface lands.

### Implemented

- **Text and media:** `sendText`, `sendImage`, `sendVideo`, `sendAudio`, `sendDocument`, `sendSticker` (media is referenced by an uploaded `id` or a public `link`).
- **Location and contacts:** `sendLocation`, `sendContacts` with the full contact object (name parts, `addresses`, `org`, `urls`, `birthday`).
- **Templates:** `sendTemplate`.
- **Interactive:** `sendInteractiveButtons`, `sendInteractiveList` (with text/image/video/document headers), `sendInteractiveCtaUrl`, `sendInteractiveFlow`, `sendLocationRequest`, `sendProduct`, `sendProductList`.
- **Other:** `sendReaction`, `markAsRead`.
- **Media:** `client.media.upload`, `getUrl`, `download`/`downloadByUrl`, and `delete` (upload a file for a reusable `id`, resolve the short-lived download URL, fetch bytes with the token, and delete).
- **Reply/context:** pass `{ replyToMessageId }` to any sender to reply to a prior message.
- **Webhooks:** `verifyWebhook`/`verifyWebhookQuery` (GET handshake), `verifySignature` (constant-time `X-Hub-Signature-256`), `parseWebhook`/`extractMessages`/`extractStatuses` with a typed `IncomingMessage` union and `MessageStatus`, and a framework-agnostic `WebhookHandler`.
- **Client-side validation:** body/footer/header lengths, button counts and ids, list section/row limits, reaction emoji, flow CTA, and product-list item counts are checked before the request, raising `WhatsAppValidationError` with a clear field + limit message. Nothing is silently truncated.
- **Typed errors:** `WhatsAppApiError`, `WhatsAppAuthenticationError`, `WhatsAppRateLimitError`, `WhatsAppReEngagementError`, `WhatsAppRequestError`, `WhatsAppValidationError`, and `WhatsAppWebhookError`.

### Not yet implemented

- Template management.
- Phone number and WABA management.

## Install

```sh
pnpm add @solvejet/whatsapp-cloud-api
```

Requires Node.js 20 or newer.

## Usage

```ts
import { WhatsAppClient } from '@solvejet/whatsapp-cloud-api';

const client = new WhatsAppClient({
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
});

// Send a plain text message.
const res = await client.messages.sendText('15551234567', 'Hello from the SDK');
console.log(res.messages[0]?.id); // the WhatsApp message ID (WAMID)

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

### Media

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

### Handling errors

Every API failure is a subclass of `WhatsAppApiError`, so `.code` (the Graph
error code) is always available. Branch on the specific classes to react:

```ts
import {
  WhatsAppRateLimitError,
  WhatsAppReEngagementError,
  WhatsAppValidationError,
} from '@solvejet/whatsapp-cloud-api';

try {
  await client.messages.sendText('15551234567', 'Hello from the SDK');
} catch (err) {
  if (err instanceof WhatsAppRateLimitError) {
    // Rate limited: back off before retrying. When the response carried a
    // Retry-After header, `retryAfterMs` holds the server-advised delay.
    const waitMs = err.retryAfterMs ?? 60_000;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  } else if (err instanceof WhatsAppReEngagementError) {
    // Outside the 24-hour customer service window: fall back to a template.
    await client.messages.sendTemplate('15551234567', {
      name: 'hello_world',
      language: { code: 'en_US' },
    });
  } else if (err instanceof WhatsAppValidationError) {
    // Client-side limit or shape violation: fix the request before resending.
    console.error('Invalid request:', err.message);
  } else {
    throw err;
  }
}
```

### Error class mapping

`errorFromResponse` picks the error class from the HTTP status and Graph error
`code`:

- `429`, `130429`, `131056`, `133016` → `WhatsAppRateLimitError`
- `131047` → `WhatsAppReEngagementError`
- `401`, `403`, `0`, `190` → `WhatsAppAuthenticationError`
- everything else → `WhatsAppApiError` (with `.code` set)

All of the above extend `WhatsAppApiError`, so `.code`, `.httpStatus`, and
related fields are available on each. `WhatsAppValidationError` is raised
locally before a request is sent and is not part of this mapping.

## Webhooks

Receiving inbound messages and delivery statuses is a two-step model:

1. **GET verification.** When you configure the webhook, Meta sends a GET request with `hub.mode`, `hub.verify_token`, and `hub.challenge`. Echo the raw `hub.challenge` back with a `200` when the token matches your configured verify token; otherwise return `403`. The challenge must be returned as the raw response body, not wrapped in JSON.
2. **POST deliveries.** Meta POSTs event payloads signed with `X-Hub-Signature-256`. Verify the signature against the **raw request body** using your App Secret, return `200` immediately, then parse and process.

Three distinct secrets are involved, and they are not interchangeable:

- **Verify token** — a string you define yourself, used only for the GET handshake.
- **App Secret** — from your Meta app settings, used to compute/verify the `X-Hub-Signature-256` signature.
- **Access token** — used to _send_ messages (see above), never for webhooks.

### Framework-agnostic Express example

```ts
import express from 'express';
import {
  verifyWebhook,
  verifySignature,
  parseWebhook,
  extractMessages,
  extractStatuses,
} from '@solvejet/whatsapp-cloud-api';

const app = express();

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN!; // you define this
const APP_SECRET = process.env.WHATSAPP_APP_SECRET!; // from Meta app settings

// 1. GET verification handshake — echo the raw challenge.
app.get('/webhook', (req, res) => {
  const { statusCode, body } = verifyWebhook(
    {
      mode: req.query['hub.mode'] as string | undefined,
      token: req.query['hub.verify_token'] as string | undefined,
      challenge: req.query['hub.challenge'] as string | undefined,
    },
    VERIFY_TOKEN,
  );
  // Send the raw challenge string, NOT res.json(...).
  res.status(statusCode).send(body);
});

// 2. POST deliveries — capture the RAW body so the signature matches.
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const rawBody = req.body as Buffer; // raw bytes, exactly as received
  const signature = req.get('x-hub-signature-256');

  if (!verifySignature(rawBody, signature, APP_SECRET)) {
    res.sendStatus(401);
    return;
  }

  // Acknowledge fast, then process asynchronously (see gotchas below).
  res.sendStatus(200);

  const payload = parseWebhook(rawBody.toString('utf8'));

  for (const message of extractMessages(payload)) {
    // Deduplicate on message.id (the wamid) to stay idempotent across retries.
    switch (message.type) {
      case 'text':
        console.log(`text from ${message.from}: ${message.text.body}`);
        break;
      case 'image':
        console.log(`image ${message.image.id} from ${message.from}`);
        break;
      case 'interactive':
        if (message.interactive.type === 'button_reply') {
          console.log(`button ${message.interactive.button_reply?.id}`);
        } else {
          console.log(`list ${message.interactive.list_reply?.id}`);
        }
        break;
      default:
        // New/unrecognized Meta message types still parse and land here.
        console.log(`unhandled message type: ${message.type}`);
    }
  }

  for (const status of extractStatuses(payload)) {
    console.log(`message ${status.id} -> ${status.status}`);
  }
});
```

Prefer `WebhookHandler` when you want the secrets bound once: `const handler = new WebhookHandler({ appSecret, verifyToken })` gives you `handler.handleVerification(query)` and `handler.parse(rawBody, signature)` (which verifies the signature and throws `WhatsAppWebhookError` when an App Secret is configured and the signature is missing or invalid).

**Two gotchas worth repeating:**

- **The signature is computed over the RAW bytes.** Verify `verifySignature` against the exact bytes Meta sent (`express.raw(...)` above). Re-serializing parsed JSON changes the bytes and makes a valid signature fail — never run `JSON.stringify(req.body)` and verify that.
- **Return `200` fast, then process.** Meta retries deliveries and will deactivate endpoints that respond slowly. Acknowledge immediately and do the real work asynchronously. Because of retries, deduplicate on the message id (`wamid`, `message.id`) to keep processing idempotent.

## Roadmap

- **Template management** (create, list, update, delete message templates).
- **Phone number and WABA management.**
- Python and Rust ports of the SDK, following the TypeScript release.

## Documentation

The public API is fully typed — your editor's autocomplete and the bundled `.d.ts`
declarations document every method, option, and payload shape. The examples above
cover the common flows; for the underlying API semantics, see the
[WhatsApp Cloud API reference](https://developers.facebook.com/docs/whatsapp/cloud-api).

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the development setup and workflow, and please follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Security

Please report vulnerabilities privately. See [SECURITY.md](./SECURITY.md) for the process.

## License

[MIT](./LICENSE) © 2026 SolveJet
