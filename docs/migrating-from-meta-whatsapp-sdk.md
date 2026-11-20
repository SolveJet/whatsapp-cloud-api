# Migrating from Meta's `whatsapp` package

This guide is for projects that use the npm package
[`whatsapp`](https://www.npmjs.com/package/whatsapp) (GitHub:
[WhatsApp/WhatsApp-Nodejs-SDK](https://github.com/WhatsApp/WhatsApp-Nodejs-SDK),
version `0.0.5-Alpha`) and want to move to `@solvejet/whatsapp-cloud-api`.

`@solvejet/whatsapp-cloud-api` is an independent open-source project. It is not
affiliated with, endorsed by, or sponsored by Meta or WhatsApp.

The "before" code below was checked against the published `whatsapp@0.0.5-Alpha`
tarball, which includes its README, TypeScript source and build output.

## Why you might migrate

You do not have to. These are the practical reasons:

- **Archived upstream.** The GitHub repository is archived (read-only), and
  0.0.5-Alpha, published April 2023, is the latest version on npm. It uses
  `CLOUD_API_VERSION` from your environment, so you pick the Graph version, but
  new Graph features are not added to the SDK.
- **Coverage.** The package's `messages` API covers sending messages and
  marking them read. It has no method for reactions, media upload or download,
  or template, WABA, flow, block or calling management. See the
  [mapping](#api-mapping) and
  [what it does that we do not](#what-the-whatsapp-package-does-that-this-package-does-not).
- **Configuration.** It reads settings from environment variables on
  construction. This package takes an explicit config object, which is easier
  to use with several phone numbers or tokens in one process.
- **Types for webhooks and errors.** Parsed deliveries here are a
  discriminated union on `type`, and failures are typed error classes.
- **Dependencies.** The package has one runtime dependency (`@types/node`).
  `@solvejet/whatsapp-cloud-api` has none.

## Install

```bash
npm uninstall whatsapp
npm install @solvejet/whatsapp-cloud-api
```

Requires Node.js 20 or newer. `whatsapp@0.0.5-Alpha` declares `node >= 16.19.1`,
so check your runtime first.

## API mapping

`wa` is `new WhatsApp(...)` from the `whatsapp` package; `client` is a
`WhatsAppClient`.

| Task                       | `whatsapp` 0.0.5-Alpha                                                              | `@solvejet/whatsapp-cloud-api`                                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Create the client          | `new WhatsApp(senderPhoneNumberId?)`, config from environment variables             | `new WhatsAppClient({ accessToken, phoneNumberId, businessAccountId, apiVersion })`                                               |
| Send text                  | `wa.messages.text({ body, preview_url }, recipient)`                                | `client.messages.sendText(to, body, { previewUrl })`                                                                              |
| Send image                 | `wa.messages.image({ link } \| { id }, recipient)`                                  | `client.messages.sendImage(to, { link } \| { id })`                                                                               |
| Video, audio, sticker      | `wa.messages.video(...)`, `audio(...)`, `sticker(...)`                              | `client.messages.sendVideo`, `sendAudio`, `sendSticker`                                                                           |
| Document                   | `wa.messages.document(body, recipient)`                                             | `client.messages.sendDocument(to, { link \| id, caption, filename })`                                                             |
| Location                   | `wa.messages.location(body, recipient)`                                             | `client.messages.sendLocation(to, { latitude, longitude, name, address })`                                                        |
| Contacts                   | `wa.messages.contacts([contact], recipient)`                                        | `client.messages.sendContacts(to, [contact])`                                                                                     |
| Template                   | `wa.messages.template({ name, language: { policy, code }, components }, recipient)` | `client.messages.sendTemplate(to, { name, language: { code }, components })`                                                      |
| Interactive                | `wa.messages.interactive(interactiveObject, recipient)`                             | `sendInteractiveButtons`, `sendInteractiveList`, `sendInteractiveCtaUrl`, `sendInteractiveFlow`, `sendProduct`, `sendProductList` |
| Reply to a message         | third argument: `replyMessageId`                                                    | `client.messages.sendRaw({ ..., context: { message_id } })` (see [Reply context](#reply-context))                                 |
| Reaction                   | not available (see note)                                                            | `client.messages.sendReaction(to, { messageId, emoji })`                                                                          |
| Mark as read               | `wa.messages.status({ status: 'read', message_id })`                                | `client.messages.markAsRead(messageId)`                                                                                           |
| Upload media               | not available                                                                       | `client.media.upload(...)`                                                                                                        |
| Download media             | not available                                                                       | `client.media.download(mediaId)`, `getUrl`, `downloadByUrl`                                                                       |
| Two-step PIN               | `wa.twoStepVerification.setPin(pin)`                                                | `client.phoneNumbers.setTwoStepPin(pin)`                                                                                          |
| Webhook verification (GET) | `wa.webhooks.start(cb)` handles `hub.mode` and `hub.verify_token`                   | `verifyWebhookQuery(query, token)` or `WebhookHandler.handleVerification(query)`                                                  |
| Signature (POST)           | `wa.webhooks.start(cb)` checks `x-hub-signature-256` with `M4D_APP_SECRET`          | `verifySignature(rawBody, header, appSecret)` or `WebhookHandler.parse(rawBody, header)`                                          |
| Parse deliveries           | `cb(statusCode, headers, body, response, error)`; `body` is the raw JSON object     | `handler.parse(rawBody, header)` returns `{ messages, statuses, raw }`                                                            |
| Stop the listener          | `wa.webhooks.stop(cb)`                                                              | not needed: you own the HTTP server                                                                                               |
| Update token               | `wa.updateAccessToken(token)`, `updateSenderNumberId`, `updateTimeout`              | construct another `WhatsAppClient`                                                                                                |

Notes:

- In the `whatsapp` source, `MessageTypesEnum` has `Reaction = 'sticker'`
  and `ReactionMessageRequestBody` exists as a type, but `MessagesAPI` has no
  `reaction` method. You would build the body yourself and pass it to `wa.messages.send`.
- Recipients in `whatsapp` are `number`s (`recipient.toString()` is sent). Here
  `to` is a string, so keep leading country codes as text.
- `whatsapp` methods return an object with `statusCode()`, `headers()`, and
  `responseBodyToJSON()`. They resolve for non-2xx responses too: check
  `statusCode()`. Here the returned promise resolves to the parsed Graph body
  and throws on API errors.

## Before and after

### 1. Create a client and send text

Before (`whatsapp` 0.0.5-Alpha), with `CLOUD_API_ACCESS_TOKEN`,
`CLOUD_API_VERSION`, and `WA_PHONE_NUMBER_ID` set in the environment:

```js
import WhatsApp from 'whatsapp';

const wa = new WhatsApp(); // or new WhatsApp(Number(process.env.WA_PHONE_NUMBER_ID))
const response = await wa.messages.text({ body: 'Hello world', preview_url: true }, 15551234567);
console.log(response.statusCode(), await response.responseBodyToJSON());
```

After:

```ts
import { WhatsAppClient } from '@solvejet/whatsapp-cloud-api';

const client = new WhatsAppClient({
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
  apiVersion: 'v26.0', // the default
});

const res = await client.messages.sendText('15551234567', 'Hello world', {
  previewUrl: true,
});
console.log(res.messages[0]?.id);
```

### 2. Media and templates

Before:

```js
await wa.messages.image({ link: 'https://example.com/cat.jpg', caption: 'A cat' }, 15551234567);
await wa.messages.template(
  { name: 'hello_world', language: { policy: 'deterministic', code: 'en_US' } },
  15551234567,
);
```

In TypeScript, `code` is typed as the package's `LanguagesEnum`, which the
package entry point does not export. Plain JavaScript can pass the string.

After:

```ts
import { WhatsAppClient } from '@solvejet/whatsapp-cloud-api';

const client = new WhatsAppClient({
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
});
const to = '15551234567';

await client.messages.sendImage(to, {
  link: 'https://example.com/cat.jpg',
  caption: 'A cat',
});

await client.messages.sendTemplate(to, {
  name: 'hello_world',
  language: { code: 'en_US' },
});
```

### 3. Interactive messages

Before, you build the Graph `interactive` object yourself:

```js
await wa.messages.interactive(
  {
    type: 'button',
    body: { text: 'Pick one' },
    action: {
      buttons: [
        { type: 'reply', reply: { id: 'yes', title: 'Yes' } },
        { type: 'reply', reply: { id: 'no', title: 'No' } },
      ],
    },
  },
  15551234567,
);
```

After, there is one method per interactive type, and limits such as the
three-button maximum are checked before sending:

```ts
import { WhatsAppClient } from '@solvejet/whatsapp-cloud-api';

const client = new WhatsAppClient({
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
});

await client.messages.sendInteractiveButtons('15551234567', {
  body: 'Pick one',
  buttons: [
    { id: 'yes', title: 'Yes' },
    { id: 'no', title: 'No' },
  ],
});
```

### 4. Mark as read, react, and handle media

Before, only mark-as-read exists:

```js
await wa.messages.status({ status: 'read', message_id: 'wamid.XXX' });
```

After:

```ts
import { WhatsAppClient } from '@solvejet/whatsapp-cloud-api';

const client = new WhatsAppClient({
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
});

await client.messages.markAsRead('wamid.XXX');
await client.messages.sendReaction('15551234567', { messageId: 'wamid.XXX', emoji: '👍' });

// Upload bytes, then send by id.
const { id } = await client.media.upload({
  file: new TextEncoder().encode('hello'),
  filename: 'hello.txt',
  type: 'text/plain',
});
await client.messages.sendDocument('15551234567', { id, filename: 'hello.txt' });

// Download media that a user sent you.
const { data, mimeType } = await client.media.download(id);
console.log(mimeType, data.byteLength);
```

### 5. Receive webhooks

Before, `wa.webhooks.start(cb)` opens a plain `http` server (it calls
`http.createServer`, so TLS has to come from your proxy) on
`LISTENER_PORT`, serving `/${WEBHOOK_ENDPOINT}`. The callback receives the
status code, headers, parsed body, the response object, and an error. In the
success path the callback is passed the response and must end it:

```js
wa.webhooks.start((statusCode, headers, body, response, error) => {
  if (error) {
    console.error(error);
    return;
  }
  console.log(JSON.stringify(body));
  response.end(); // the callback is handed the response; it must be ended
});
```

After, you own the server and pass the raw body to the SDK. This version uses
standard `Request` and `Response` types, so it works in Next.js route handlers,
Hono and Cloudflare Workers. Express and Fastify versions are in
[`examples/`](../examples/README.md).

```ts
import { WebhookHandler, WhatsAppWebhookError } from '@solvejet/whatsapp-cloud-api';

const handler = new WebhookHandler({
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN!,
  appSecret: process.env.WHATSAPP_APP_SECRET!,
});

export function verify(request: Request): Response {
  const query: Record<string, string | undefined> = {};
  for (const [key, value] of new URL(request.url).searchParams) query[key] = value;
  const { statusCode, body } = handler.handleVerification(query);
  return new Response(body, { status: statusCode });
}

export async function receive(request: Request): Promise<Response> {
  const rawBody = await request.text(); // not request.json()
  try {
    const { messages, statuses } = handler.parse(
      rawBody,
      request.headers.get('x-hub-signature-256') ?? '',
    );
    console.log(messages.length, 'messages', statuses.length, 'statuses');
    return new Response('OK');
  } catch (error) {
    if (error instanceof WhatsAppWebhookError) return new Response('Unauthorized', { status: 401 });
    throw error;
  }
}
```

### Reply context

`whatsapp` accepts a `replyMessageId` as the last argument of each send method
and adds `context: { message_id }` to the body. This package does not have a
typed option for it on the senders. Use `sendRaw`, which posts any
body and is not validated on the client:

```ts
import { WhatsAppClient } from '@solvejet/whatsapp-cloud-api';

const client = new WhatsAppClient({
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
});

await client.messages.sendRaw({
  to: '15551234567',
  type: 'text',
  text: { body: 'Replying to you' },
  context: { message_id: 'wamid.XXX' },
});
```

## Things that behave differently

- **Configuration.** `whatsapp` reads environment variables when you construct
  it.
  Here nothing is read from the environment; pass values explicitly.
  `CLOUD_API_VERSION` is required there. Here the default is `v26.0`.
- **Errors.** `whatsapp` throws plain `Error`s for missing configuration, and
  for HTTP responses it gives you a response object whose `statusCode()` you
  check. Here you get `WhatsAppApiError` and subclasses
  (`WhatsAppRateLimitError`, `WhatsAppReEngagementError`,
  `WhatsAppAuthenticationError`), `WhatsAppRequestError` for network and
  timeout failures, and `WhatsAppValidationError` for local checks. See
  [Error handling](./errors.md).
- **Retries.** The `whatsapp` README lists `MAX_RETRIES_AFTER_WAIT` (default
  30). In the 0.0.5-Alpha source that value is read into the config, and we did
  not find code that uses it to retry. Here, `429`, `5xx`, and network errors
  are retried (`maxRetries`, default 2) with backoff, and `Retry-After` is
  honored. This includes JSON `POST` sends, so a send that failed after Meta
  accepted it could be repeated. Set `maxRetries: 0` if you prefer to handle
  retries yourself. Multipart media uploads are not retried.
- **Timeouts.** `whatsapp` defaults to 20,000 ms (`REQUEST_TIMEOUT`). Here it
  is 30,000 ms per attempt (`timeoutMs`).
- **Webhook signature.** Both check the `X-Hub-Signature-256` HMAC-SHA256 of
  the body with your App Secret. Differences: here the check is a constant-time
  comparison against the raw bytes you pass in, a missing or malformed header
  fails, and it runs on every parse. In the `whatsapp` source the POST branch
  only handles requests that carry the header and compares the hex digests
  with `==`.
- **Raw body is required.** Whatever web framework you use, give
  `WebhookHandler.parse` the exact bytes Meta sent. If your framework parses
  JSON first and you re-serialize it, the signature will not match. Pass the raw body as a string, `Buffer`, `Uint8Array` or
  `ArrayBuffer`. In Express, use `express.raw({ type: 'application/json' })`
  or `express.json({ verify })` to keep the buffer on that route. In Next.js
  route handlers use `await request.text()`.
- **Unset secrets throw at construction.** `new WebhookHandler({ verifyToken,
appSecret })` throws `WhatsAppWebhookError` when either value is present but
  `undefined`, empty or not a string. An unset environment variable therefore
  fails at startup instead of silently turning verification off, and the `!`
  non-null assertion in the examples does not change that at runtime. Omitting
  the `appSecret` key entirely still means no signature enforcement
  (`handler.parse(...)` skips the check), so set it in production.
  `verifySignature(rawBody, header, secret)` returns `false`, and does not
  throw, for an empty or non-string secret, a bad header or an unsupported body
  type.
- **Only the `messages` field is read.** `extractMessages`, `extractStatuses`
  and `handler.parse` return data from changes whose `field` is `messages`.
  Other fields, such as call events from the `calls` field, are not returned as
  messages or statuses; read them from `parsed.raw`.
- **Body size and errors.** String and byte bodies over 3 MiB (Meta's documented
  maximum) are rejected before parsing. Change this with `maxBodyBytes` on the
  handler or `parseWebhook` options, or pass `false` to turn the check off.
  "Not valid JSON" errors do not carry the parser error as `cause`, because its
  message can include a fragment of the request body.
- **No server.** This package does not start an HTTP listener, so there is no
  port, path or `stop()` to configure.
- **Recipient type.** `to` is a string, not a number. It can also be
  `{ bsuid }` for business-scoped user IDs. For message bodies that this SDK
  does not wrap yet, `client.messages.sendRaw(body)` posts any body and skips
  the client-side checks.
- **Module formats.** Both ESM and CommonJS work. Node 20 or newer is required.

## What the `whatsapp` package does that this package does not

- **A built-in webhook listener.** `wa.webhooks.start(cb)` creates an HTTP
  server with a configurable port and endpoint, and reports signature failures
  through the callback. This package has no server; see the examples for
  Express, Next.js, Hono and Fastify.
- **A typed `replyMessageId` argument** on each sender. Use `sendRaw` with
  `context` here, as shown above.
- **Environment-driven setup.** If you rely on the `WA_*`, `M4D_*` and
  `CLOUD_API_*` variables, you will need to map them to constructor options.
- **Node 16.19.1 to 19.** The old package declares `node >= 16.19.1`. This
  package needs Node 20+.
- **A debug logger.** `DEBUG=true` switches on logging in `whatsapp`. This
  package has no logging switch.
- **Meta authorship and license.** `whatsapp` is published by Meta Platforms
  under its own license text (see its `LICENSE` file). This package is a
  third-party MIT-licensed project. If your organization requires
  vendor-authored SDKs, that is a reason to stay.

## Checklist

1. Check Node is 20 or newer.
2. Replace the dependency (`npm uninstall whatsapp`, then install
   `@solvejet/whatsapp-cloud-api`).
3. Map your environment variables to `new WhatsAppClient({ accessToken,
phoneNumberId, businessAccountId, apiVersion })`.
4. Rename each `wa.messages.*` call using the table. Recipients become strings.
5. Replace `wa.messages.status(...)` with `client.messages.markAsRead(...)`.
6. Replace `wa.webhooks.start(cb)` with your own routes. Keep the raw body
   bytes and pass them to `handler.parse` unchanged. Create a `WebhookHandler`
   with both the verify token and the App Secret; an empty value for either
   throws at construction, so check your environment variables. The callback's
   parsed `body` becomes `parsed.raw`, and messages and statuses come from the
   `messages` field only. Bodies over 3 MiB are rejected unless you set
   `maxBodyBytes`.
7. Replace status-code checks on response objects with `try`/`catch` on the
   error classes.
8. Decide on `maxRetries` and message de-duplication.
9. Replace any `replyMessageId` use with `sendRaw` and `context`.
10. Remove the `whatsapp` environment variables you no longer use.
11. Optional: use reactions, media upload and download, templates, and the
    other resources.

[Back to the README](../README.md)
