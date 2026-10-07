# @solvejet/whatsapp-cloud-api

[![CI](https://github.com/solvejet/whatsapp-cloud-api/actions/workflows/ci.yml/badge.svg)](https://github.com/solvejet/whatsapp-cloud-api/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@solvejet/whatsapp-cloud-api.svg)](https://www.npmjs.com/package/@solvejet/whatsapp-cloud-api)
[![license](https://img.shields.io/npm/l/@solvejet/whatsapp-cloud-api.svg)](./LICENSE)

TypeScript SDK for the [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api) — the Meta-hosted WhatsApp Business Platform. It aims to provide a typed, zero-runtime-dependency client built on the native `fetch` and `FormData` available in Node 20+.

> **Status: active development.** Outbound messaging is implemented: text, media (image, video, audio, document, sticker), location, the full contacts object (addresses, org, URLs, birthday, structured name parts), templates, interactive buttons and lists with rich headers (text, image, video, document), the interactive CTA URL / flow / location-request / product / product-list senders, reactions, and mark-as-read. Every sender accepts a `replyToMessageId` to thread a reply via message context, and documented limits are validated client-side before a request is sent. Media **upload/download** and **webhooks** are not implemented yet, and APIs may change before the first stable release.

### Implemented

- **Text and media:** `sendText`, `sendImage`, `sendVideo`, `sendAudio`, `sendDocument`, `sendSticker` (media is referenced by an uploaded `id` or a public `link`).
- **Location and contacts:** `sendLocation`, `sendContacts` with the full contact object (name parts, `addresses`, `org`, `urls`, `birthday`).
- **Templates:** `sendTemplate`.
- **Interactive:** `sendInteractiveButtons`, `sendInteractiveList` (with text/image/video/document headers), `sendInteractiveCtaUrl`, `sendInteractiveFlow`, `sendLocationRequest`, `sendProduct`, `sendProductList`.
- **Other:** `sendReaction`, `markAsRead`.
- **Reply/context:** pass `{ replyToMessageId }` to any sender to reply to a prior message.
- **Client-side validation:** body/footer/header lengths, button counts and ids, list section/row limits, reaction emoji, flow CTA, and product-list item counts are checked before the request, raising `WhatsAppValidationError` with a clear field + limit message. Nothing is silently truncated.
- **Typed errors:** `WhatsAppApiError`, `WhatsAppAuthenticationError`, `WhatsAppRateLimitError`, `WhatsAppReEngagementError`, `WhatsAppRequestError`, and `WhatsAppValidationError`.

### Not yet implemented

- Media **upload** and **download**.
- **Webhooks** (inbound messages and status callbacks).
- Template management.

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

## Roadmap

- Flesh out the Cloud API surface: messages, templates, media, and webhooks.
- Publish the first stable release to npm.
- Python and Rust ports of the SDK are planned to follow the TypeScript release.

## Documentation

Full documentation will accompany the first feature release. For now, see the inline types and the [WhatsApp Cloud API reference](https://developers.facebook.com/docs/whatsapp/cloud-api).

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the development setup and workflow, and please follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Security

Please report vulnerabilities privately. See [SECURITY.md](./SECURITY.md) for the process.

## License

[MIT](./LICENSE) © 2026 SolveJet
