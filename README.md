# @solvejet/whatsapp-cloud-api

[![CI](https://github.com/SolveJet/whatsapp-cloud-api/actions/workflows/ci.yml/badge.svg)](https://github.com/SolveJet/whatsapp-cloud-api/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@solvejet/whatsapp-cloud-api.svg)](https://www.npmjs.com/package/@solvejet/whatsapp-cloud-api)
[![license](https://img.shields.io/npm/l/@solvejet/whatsapp-cloud-api.svg)](./LICENSE)

A typed, zero-runtime-dependency TypeScript SDK for the [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api) — the Meta-hosted WhatsApp Business Platform. Built on the native `fetch` in Node.js 20+.

- **Zero runtime dependencies** — just the platform `fetch`/`AbortController`.
- **Fully typed** — every method, option, and payload ships with `.d.ts` declarations.
- **Dual package** — native ESM and CommonJS builds.
- **Fail-fast validation** — documented API limits are checked client-side before a request is sent; nothing is silently truncated.
- **Typed error hierarchy** — rate limits, re-engagement, auth, and validation errors are distinct classes.
- **Signed provenance** — every release is published from CI with [npm provenance](https://docs.npmjs.com/generating-provenance-statements).

> **Status: stable (`1.x`).** Outbound messaging, inbound webhooks, the media lifecycle, phone-number/WABA management, and message-template management are all implemented. The public API is stable and follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html): breaking changes ship only in a new major version.

## Contents

- [Install](#install)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Feature overview](#feature-overview)
- [Messaging](#messaging)
  - [Replying to a message](#replying-to-a-message)
  - [Interactive call-to-action URL](#interactive-call-to-action-url)
  - [Address message (India and Singapore)](#address-message-india-and-singapore)
  - [Typing indicator](#typing-indicator)
- [Media](#media)
- [Phone number & WABA management](#phone-number--waba-management)
- [Template management](#template-management)
- [Error handling](#error-handling)
- [Webhooks](#webhooks)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

## Install

```sh
pnpm add @solvejet/whatsapp-cloud-api
```

Requires Node.js 20 or newer. Every release is published from CI with signed
[npm provenance](https://docs.npmjs.com/generating-provenance-statements); run
`npm audit signatures` after installing to verify the package traces back to its
source build.

## Quick start

```ts
import { WhatsAppClient } from '@solvejet/whatsapp-cloud-api';

const client = new WhatsAppClient({
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
});

// Send a plain text message.
const res = await client.messages.sendText('15551234567', 'Hello from the SDK');
console.log(res.messages[0]?.id); // the WhatsApp message ID (WAMID)
```

## Configuration

`WhatsAppClient` takes a single configuration object. Only `accessToken` is
required; everything else has a sensible default.

| Option              | Type     | Default                      | Description                                                                      |
| ------------------- | -------- | ---------------------------- | -------------------------------------------------------------------------------- |
| `accessToken`       | `string` | — (required)                 | Permanent or temporary access token used to authenticate requests.               |
| `phoneNumberId`     | `string` | —                            | Default sender phone number ID for messaging and media calls.                    |
| `businessAccountId` | `string` | —                            | WhatsApp Business Account (WABA) ID. Default id for `client.waba` methods.       |
| `apiVersion`        | `string` | `v23.0`                      | Graph API version to target.                                                     |
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
  apiVersion: 'v23.0',
  timeoutMs: 15_000,
  maxRetries: 3,
});

client.getPhoneNumberId(); // the configured default sender, if any
client.getApiVersion(); // 'v23.0'
client.getBaseUrl(); // 'https://graph.facebook.com/v23.0'
```

**Per-call phone number override.** Every message and media method accepts an
optional trailing `phoneNumberId` so a single client can send from multiple
numbers. When omitted, the client's configured `phoneNumberId` is used; if
neither is set, the call throws `WhatsAppValidationError`.

The HTTP core retries idempotent failures (`429`, `5xx`, and network/timeout
errors) with jittered exponential backoff, honoring a `Retry-After` header when
present.

## Feature overview

- **Text and media:** `sendText`, `sendImage`, `sendVideo`, `sendAudio`, `sendDocument`, `sendSticker` (media is referenced by an uploaded `id` or a public `link`).
- **Location and contacts:** `sendLocation`, `sendContacts` with the full contact object (structured name parts, `addresses`, `org`, `urls`, `birthday`).
- **Templates:** `sendTemplate` (sends an approved template) plus full template management via `client.templates` (create, list, get, edit, delete).
- **Interactive:** `sendInteractiveButtons`, `sendInteractiveList` (with text/image/video/document headers), `sendInteractiveCtaUrl`, `sendInteractiveFlow`, `sendLocationRequest`, `sendProduct`, `sendProductList`, `sendAddressMessage` (India and Singapore).
- **Other:** `sendReaction`, `markAsRead`, `sendTypingIndicator`.
- **Media lifecycle:** `client.media.upload`, `getUrl`, `download`/`downloadByUrl`, and `delete`.
- **Phone number & WABA management:** `client.phoneNumbers.*` (verification, Cloud API registration, two-step PIN, business profile) and `client.waba.*` (account details, list phone numbers, subscribed-app management).
- **Template management:** `client.templates.*` (`create`, `list`, `get`, `edit`, `delete` message templates, with client-side validation of the documented create limits).
- **Reply/context:** pass `{ replyToMessageId }` to any sender to reply to a prior message.
- **Webhooks:** `verifyWebhook`/`verifyWebhookQuery` (GET handshake), `verifySignature` (constant-time `X-Hub-Signature-256`), `parseWebhook`/`extractMessages`/`extractStatuses` with a typed `IncomingMessage` union and `MessageStatus`, and a framework-agnostic `WebhookHandler`.
- **Client-side validation:** body/footer/header lengths, button counts and ids, list section/row limits, reaction emoji, flow CTA, product-list item counts, and address-message country/postal-code — all checked before the request.
- **Typed errors:** `WhatsAppApiError`, `WhatsAppAuthenticationError`, `WhatsAppRateLimitError`, `WhatsAppReEngagementError`, `WhatsAppRequestError`, `WhatsAppValidationError`, and `WhatsAppWebhookError`, plus the `WhatsAppErrorCode` constants map for comparing `err.code` to named Graph error codes.

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

## Template management

Create, list, read, edit, and delete message templates with `client.templates`.
Every method accepts an optional trailing `businessAccountId` (the id-scoped
`get`/`edit` take a required template id instead), falling back to the
configured `businessAccountId`; when neither is set the call throws
`WhatsAppValidationError`. `create` validates the documented hard limits
client-side before sending.

```ts
// Create a template. Exactly one BODY component is required.
const created = await client.templates.create({
  name: 'order_confirmation',
  language: 'en_US',
  category: 'UTILITY',
  components: [
    {
      type: 'BODY',
      text: 'Hi {{1}}, your order {{2}} is confirmed.',
      example: { body_text: [['Sam', '12345']] },
    },
    { type: 'FOOTER', text: 'Reply STOP to opt out.' },
  ],
});
console.log(created.id, created.status); // e.g. "123..." "PENDING"

// List templates on the business account (filters and paging are optional).
const { data } = await client.templates.list({ status: 'APPROVED', limit: 20 });
console.log(data.map((t) => t.name));

// Delete every version of a template by name.
await client.templates.delete({ name: 'order_confirmation' });
```

Editing an approved template resets it to `PENDING` for re-review, and a
template's `name` and `language` are immutable.

## Error handling

Every API failure is a subclass of `WhatsAppApiError`, so `.code` (the Graph
error code), `.httpStatus`, and related fields are always available. Branch on
the specific classes to react:

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
    // Equivalent check: `err.code === WhatsAppErrorCode.RE_ENGAGEMENT_MESSAGE`.
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

**Error class mapping.** `errorFromResponse` picks the error class from the HTTP
status and Graph error `code`:

- `429`, `130429`, `131056`, `133016` → `WhatsAppRateLimitError`
- `131047` → `WhatsAppReEngagementError`
- `401`, `403`, `0`, `190` → `WhatsAppAuthenticationError`
- everything else → `WhatsAppApiError` (with `.code` set)

All of the above extend `WhatsAppApiError`. Network, abort, and timeout failures
raise `WhatsAppRequestError` (with an `isTimeout` flag). `WhatsAppValidationError`
is raised locally before a request is sent and is not part of this mapping.

For readable comparisons against `err.code`, the exported `WhatsAppErrorCode`
constants map names the common Graph error codes (e.g.
`WhatsAppErrorCode.ACCESS_TOKEN_EXPIRED`, `WhatsAppErrorCode.SPAM_RATE_LIMIT_HIT`,
`WhatsAppErrorCode.TEMPLATE_NOT_EXIST`), so you can branch on a named constant
instead of a magic number. Its value type is `WhatsAppErrorCodeValue`.

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
        } else if (message.interactive.type === 'list_reply') {
          console.log(`list ${message.interactive.list_reply?.id}`);
        } else if (message.interactive.type === 'nfm_reply') {
          // e.g. an address-message submission; response_json is a raw string.
          const fields = JSON.parse(message.interactive.nfm_reply?.response_json ?? '{}');
          console.log(`nfm_reply ${message.interactive.nfm_reply?.name}`, fields);
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

- Python and Rust ports of the SDK, following the TypeScript release.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the development setup, release process, and workflow, and please follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Security

Please report vulnerabilities privately. See [SECURITY.md](./SECURITY.md) for the process.

## License

[MIT](./LICENSE) © 2026 SolveJet
