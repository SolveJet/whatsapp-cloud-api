# Migrating from `whatsapp-cloud-api` (tawn33y)

This guide is for projects that use the npm package
[`whatsapp-cloud-api`](https://www.npmjs.com/package/whatsapp-cloud-api)
(GitHub: [tawn33y/whatsapp-cloud-api](https://github.com/tawn33y/whatsapp-cloud-api))
and want to move to `@solvejet/whatsapp-cloud-api`.

`@solvejet/whatsapp-cloud-api` is an independent open-source project. It is not
affiliated with Meta, WhatsApp, or the authors of `whatsapp-cloud-api`.

The "before" code below was checked against the published
`whatsapp-cloud-api@0.3.1` tarball (its README and compiled `dist/`). Its
`API.md` is not included in the npm package, so nothing here relies on it.

## Why you might migrate

You do not have to. `whatsapp-cloud-api` still works for what it covers. These
are the reasons people have to move:

- **Archived upstream.** The GitHub repository is archived (read-only). The
  last release is 0.3.1 (April 2023), and it defaults to Graph API `v14.0`
  unless you pass `version`. Fixes and new Meta features will not land there.
- **Dependencies.** 0.3.1 declares six runtime dependencies (`axios`, `dotenv`,
  `express`, `pubsub-js`, `type-fest`, `validator`). `@solvejet/whatsapp-cloud-api`
  has none and uses the built-in `fetch`.
- **Coverage.** The old package sends messages and receives them through a
  built-in Express server. It has no reactions, mark-as-read, media upload or
  download, template management, or webhook signature check (see
  [what it does that we do not](#what-whatsapp-cloud-api-does-that-this-package-does-not)
  for the other direction).
- **Types.** Incoming messages in 0.3.1 are typed as `data: FreeFormObject`.
  Here they are a discriminated union on `type`.
- **License.** 0.3.1 is GPL-3.0. This package is MIT. Check what that means for
  your own project; this is not legal advice.

## Install

```bash
npm uninstall whatsapp-cloud-api
npm install @solvejet/whatsapp-cloud-api
```

Requires Node.js 20 or newer. `whatsapp-cloud-api@0.3.1` declares `node >= 12`,
so check your runtime first.

## API mapping

`bot` is the value from `createBot(...)`; `client` is a `WhatsAppClient`.

| Task                 | `whatsapp-cloud-api` 0.3.1                                      | `@solvejet/whatsapp-cloud-api`                                                                                   |
| -------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Create the client    | `createBot(phoneNumberId, accessToken, { version })`            | `new WhatsAppClient({ accessToken, phoneNumberId, apiVersion })`                                                 |
| Send text            | `bot.sendText(to, text, { preview_url })`                       | `client.messages.sendText(to, text, { previewUrl })`                                                             |
| Send image           | `bot.sendImage(to, urlOrId, { caption })`                       | `client.messages.sendImage(to, { link, caption } \| { id, caption })`                                            |
| Send video           | `bot.sendVideo(to, urlOrId, { caption })`                       | `client.messages.sendVideo(to, { link } \| { id, caption })`                                                     |
| Send audio / sticker | `bot.sendAudio(to, urlOrId)`, `bot.sendSticker(to, urlOrId)`    | `client.messages.sendAudio(to, { link } \| { id })`, `sendSticker(...)`                                          |
| Send document        | `bot.sendDocument(to, urlOrId, { caption, filename })`          | `client.messages.sendDocument(to, { link, caption, filename })` (`id` instead of `link` for uploaded media)      |
| Send location        | `bot.sendLocation(to, lat, lng, { name, address })`             | `client.messages.sendLocation(to, { latitude, longitude, name, address })`                                       |
| Send contacts        | `bot.sendContacts(to, contacts)`                                | `client.messages.sendContacts(to, contacts)`                                                                     |
| Send template        | `bot.sendTemplate(to, name, languageCode, components)`          | `client.messages.sendTemplate(to, { name, language: { code }, components })`                                     |
| Reply buttons        | `bot.sendReplyButtons(to, body, { id: title }, { footerText })` | `client.messages.sendInteractiveButtons(to, { body, buttons: [{ id, title }], footer })`                         |
| List message         | `bot.sendList(to, buttonName, body, { sectionTitle: rows })`    | `client.messages.sendInteractiveList(to, { body, button, sections: [{ title, rows }] })`                         |
| Reaction             | not available                                                   | `client.messages.sendReaction(to, { messageId, emoji })`                                                         |
| Mark as read         | not available                                                   | `client.messages.markAsRead(messageId)`                                                                          |
| Upload media         | not available                                                   | `client.media.upload(blobOrFile)`                                                                                |
| Download media       | not available                                                   | `client.media.download(mediaId)`                                                                                 |
| Verify webhook (GET) | `bot.startExpressServer({ webhookVerifyToken })` handles it     | `verifyWebhookQuery(query, token)` or `new WebhookHandler({ verifyToken }).handleVerification(query)`            |
| Verify signature     | not available                                                   | `verifySignature(rawBody, header, appSecret)`, or `WebhookHandler({ appSecret })`                                |
| Parse incoming       | `bot.on('text' \| 'image' \| ... \| 'message', cb)`             | `handler.parse(rawBody, signature)` returns `{ messages, statuses, raw }`; or `parseWebhook` + `extractMessages` |
| Reply to a sender    | `bot.sendText(msg.from, ...)`                                   | `client.messages.sendText(message.from, ...)`                                                                    |
| Unsubscribe listener | `bot.unsubscribe(token)`                                        | not needed: you loop over parsed messages yourself                                                               |
| Custom Graph version | `createBot(id, token, { version: 'v17.0' })`                    | `apiVersion: 'v26.0'` (default is `v26.0`)                                                                       |

Notes on the table:

- Every sender returns the Graph response. In 0.3.1 you got
  `{ messageId, phoneNumber, whatsappId }`. Here you get Meta's body:
  `res.messages[0]?.id` is the message id and `res.contacts[0]?.wa_id` the
  WhatsApp id.
- In 0.3.1, `sendMessage` is an alias of `sendText`. Use `sendText`.
- 0.3.1 decides between a URL and a media id with a URL check
  (`validator`'s `isURL`). Here you say which one you mean: `{ link }` or `{ id }`.
- The old `sendReplyButtons` took an object of `{ [id]: title }`. Here the
  buttons are an array of `{ id, title }`, and at most three are allowed.

## Before and after

### 1. Create a client and send text

Before (`whatsapp-cloud-api` 0.3.1):

```js
import { createBot } from 'whatsapp-cloud-api';

const bot = createBot(process.env.FROM_PHONE_NUMBER_ID, process.env.ACCESS_TOKEN);
const result = await bot.sendText('15551234567', 'Hello world', { preview_url: true });
console.log(result.messageId);
```

After:

```ts
import { WhatsAppClient } from '@solvejet/whatsapp-cloud-api';

const client = new WhatsAppClient({
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
});

const res = await client.messages.sendText('15551234567', 'Hello world', {
  previewUrl: true,
});
console.log(res.messages[0]?.id);
```

### 2. Images, templates and buttons

Before:

```js
await bot.sendImage(to, 'https://example.com/cat.jpg', { caption: 'A cat' });
await bot.sendTemplate(to, 'hello_world', 'en_US');
await bot.sendReplyButtons(to, 'Pick one', { yes: 'Yes', no: 'No' }, { footerText: 'Thanks' });
```

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

await client.messages.sendInteractiveButtons(to, {
  body: 'Pick one',
  buttons: [
    { id: 'yes', title: 'Yes' },
    { id: 'no', title: 'No' },
  ],
  footer: 'Thanks',
});
```

### 3. Receive messages

Before, the library starts an Express server and publishes events in the
process (`pubsub-js`):

```js
await bot.startExpressServer({
  webhookVerifyToken: 'my-verification-token',
  port: 3000,
  webhookPath: '/webhook/whatsapp',
});

bot.on('text', async (msg) => {
  await bot.sendText(msg.from, `You said: ${msg.data.text}`);
});
```

After, you keep your own HTTP server and give the SDK the raw body. This
version uses the standard `Request`/`Response` types, so it fits Next.js route
handlers, Hono, and Cloudflare Workers. Express and Fastify versions are in
the repository's [`examples/`](../examples/README.md).

```ts
import { WebhookHandler, WhatsAppClient, WhatsAppWebhookError } from '@solvejet/whatsapp-cloud-api';

const client = new WhatsAppClient({
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
});

const handler = new WebhookHandler({
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN!,
  appSecret: process.env.WHATSAPP_APP_SECRET!,
});

// GET: Meta's one-time verification handshake.
export function verify(request: Request): Response {
  const query: Record<string, string | undefined> = {};
  for (const [key, value] of new URL(request.url).searchParams) query[key] = value;
  const { statusCode, body } = handler.handleVerification(query);
  return new Response(body, { status: statusCode });
}

// POST: deliveries. Read the raw text, not request.json().
export async function receive(request: Request): Promise<Response> {
  const rawBody = await request.text();
  try {
    const { messages } = handler.parse(rawBody, request.headers.get('x-hub-signature-256') ?? '');
    for (const message of messages) {
      if (message.type === 'text') {
        await client.messages.sendText(message.from, `You said: ${message.text.body}`);
      }
    }
    return new Response('OK');
  } catch (error) {
    if (error instanceof WhatsAppWebhookError) return new Response('Unauthorized', { status: 401 });
    throw error;
  }
}
```

In a real service, return `200` first and do the work afterwards, and
deduplicate on the message id. Meta retries deliveries that are not
acknowledged quickly.

### 4. Interactive replies

Before, button and list taps arrived as `button_reply` and `list_reply` events
whose `data` was the reply object:

```js
bot.on('button_reply', async (msg) => {
  console.log(msg.data.id, msg.data.title);
});
```

After, they are `interactive` messages:

```ts
import { extractMessages, parseWebhook } from '@solvejet/whatsapp-cloud-api';

export function handleDelivery(rawBody: string): void {
  const payload = parseWebhook(rawBody); // verify the signature before this
  for (const message of extractMessages(payload)) {
    if (message.type === 'interactive') {
      const reply = message.interactive.button_reply ?? message.interactive.list_reply;
      if (reply) console.log(reply.id, reply.title);
    }
  }
}
```

### 5. Handle errors

Before, the helper threw the Graph response body (or a message string), not an
`Error`:

```js
try {
  await bot.sendText(to, 'hi');
} catch (err) {
  console.error(err); // the parsed Graph error body, or a string
}
```

After:

```ts
import {
  WhatsAppClient,
  WhatsAppRateLimitError,
  WhatsAppReEngagementError,
  WhatsAppValidationError,
} from '@solvejet/whatsapp-cloud-api';

const client = new WhatsAppClient({
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
});

try {
  await client.messages.sendText('15551234567', 'hi');
} catch (err) {
  if (err instanceof WhatsAppRateLimitError) {
    console.warn('rate limited, retry after ms:', err.retryAfterMs);
  } else if (err instanceof WhatsAppReEngagementError) {
    console.warn('outside the 24-hour window: send a template instead');
  } else if (err instanceof WhatsAppValidationError) {
    console.error('invalid request:', err.message);
  } else {
    throw err;
  }
}
```

See [Error handling](./errors.md) for the full class list.

## Things that behave differently

- **No built-in server.** `startExpressServer` and `bot.on(...)` do not exist.
  You route HTTP yourself and loop over `messages` from the parsed delivery.
  The old events were in-process only (its README notes they do not work across
  multiple instances); a parsed delivery has no such limit, because you decide
  where to queue the work.
- **Raw body is required.** Signature verification hashes the exact bytes Meta
  sent. If a JSON parser runs first and you re-serialize, the bytes change and
  valid requests fail. In Express, use `express.raw({ type: 'application/json' })`
  or `express.json({ verify })` to keep the buffer on that route. In Next.js
  route handlers use `await request.text()`.
- **Signature verification is new for you.** 0.3.1 only checks the verify token
  on the GET handshake. It does not read `X-Hub-Signature-256` on POST. Here,
  `verifySignature` computes the HMAC-SHA256 of the raw body with your App
  Secret and compares it in constant time. You need the **App Secret** (Meta
  app dashboard), which is separate from the verify token.
- **`WebhookHandler` without `appSecret` skips verification.** As of 1.3.0,
  `handler.parse(...)` does not verify when the handler has no `appSecret`.
  Always set it in production, and check the
  [CHANGELOG](../CHANGELOG.md) for later releases.
- **Errors are classes.** `WhatsAppApiError` and subclasses carry `.code`,
  `.httpStatus`, and (for rate limits) `.retryAfterMs`. Network and timeout
  failures are `WhatsAppRequestError`. Local limit checks throw
  `WhatsAppValidationError` before any request.
- **Retries and timeouts.** The HTTP core retries `429`, `5xx` and network
  errors (default `maxRetries: 2`, timeout 30 seconds per attempt), with
  backoff, and honors `Retry-After`. JSON `POST` sends are retried too, so a
  send that failed after Meta accepted it could be repeated. If duplicates are
  worse than failures for you, set `maxRetries: 0` and handle retries yourself.
  Multipart media uploads are not retried. 0.3.1 has no retries.
- **Validation.** Documented limits (body and footer length, number of buttons,
  list rows, reaction emoji) are checked before sending. 0.3.1 sends what you
  give it and lets Meta reject it.
- **Configuration.** 0.3.1 loads `.env` on import (`dotenv/config`). This
  package never reads the environment; pass values to the constructor.
- **Recipients.** `to` is a string. It can also be `{ bsuid }` for
  business-scoped user IDs. Incoming `from` can be missing when a sender uses a
  username and shares no phone number; check `from_user_id` as well.
- **Graph version.** Default is `v26.0` (0.3.1 defaulted to `v14.0`). Set
  `apiVersion` if you need to pin another one.
- **Module formats.** ESM and CommonJS both work. Node 20 or newer is required.

## What `whatsapp-cloud-api` does that this package does not

- **A ready-made Express webhook server.** `bot.startExpressServer({...})`
  gives you a listening server in one call, with `port`, `webhookPath`,
  `useMiddleware`, and your own `app` as options. This package deliberately
  imports no web framework; you wire up the route (the examples show Express,
  Next.js, Hono and Fastify).
- **An event emitter.** `bot.on('text' | 'image' | ... | 'message', cb)` with a
  per-event name and `unsubscribe`. Here you iterate `messages` and `switch` on
  `type`. If you want an emitter, a few lines of your own `EventEmitter` around
  `handler.parse` will do.
- **Telegram-style API.** The 0.3.1 README says its API was inspired by
  `node-telegram-bot-api`. This package follows the Graph API's resource shape
  (`client.messages`, `client.media`, ...).
- **Node 12 to 18.** 0.3.1 declares `node >= 12`. This package needs Node 20+.

## Checklist

1. Check Node is 20 or newer.
2. Replace the dependency (`npm uninstall whatsapp-cloud-api`, then install
   `@solvejet/whatsapp-cloud-api`).
3. Replace `createBot(...)` with `new WhatsAppClient({ accessToken, phoneNumberId })`.
4. Rename each send call using the table. Media and template arguments become
   objects.
5. Replace `startExpressServer` with your own routes. Keep the raw body on the
   webhook route.
6. Get your **App Secret** and the **verify token**, and create a
   `WebhookHandler` with both. Test with a real delivery from Meta.
7. Replace `bot.on(...)` listeners with a loop over `handler.parse(...).messages`.
8. Replace `catch (err)` code that expected a plain object or string with
   `instanceof` checks on the error classes.
9. Decide on `maxRetries` and message de-duplication.
10. Remove `dotenv` imports you only had for the old package, and load your
    own configuration.
11. Optional: use `markAsRead`, `sendReaction`, and `client.media`.

[Back to the README](../README.md)
