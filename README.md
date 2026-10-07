# @solvejet/whatsapp-cloud-api

[![CI](https://github.com/solvejet/whatsapp-cloud-api/actions/workflows/ci.yml/badge.svg)](https://github.com/solvejet/whatsapp-cloud-api/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@solvejet/whatsapp-cloud-api.svg)](https://www.npmjs.com/package/@solvejet/whatsapp-cloud-api)
[![license](https://img.shields.io/npm/l/@solvejet/whatsapp-cloud-api.svg)](./LICENSE)

TypeScript SDK for the [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api) — the Meta-hosted WhatsApp Business Platform. It aims to provide a typed, zero-runtime-dependency client built on the native `fetch` and `FormData` available in Node 20+.

> **Status: active development.** Outbound messaging is implemented: text, media (image, video, audio, document, sticker), location, contacts, templates, interactive buttons and lists, reactions, and mark-as-read. Webhooks, media upload, and template management are not implemented yet. APIs may change before the first stable release.

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
