# Examples

Small, runnable examples for `@solvejet/whatsapp-cloud-api`. Every webhook example answers the verify-token handshake (`GET`) and verifies `X-Hub-Signature-256` against the raw request body (`POST`).

| Example                                                              | Framework                           |
| -------------------------------------------------------------------- | ----------------------------------- |
| [`express/server.ts`](express/server.ts)                             | Express 5 with `express.raw`        |
| [`nextjs/app/api/webhook/route.ts`](nextjs/app/api/webhook/route.ts) | Next.js App Router route handler    |
| [`hono/server.ts`](hono/server.ts)                                   | Hono on `@hono/node-server`         |
| [`fastify/server.ts`](fastify/server.ts)                             | Fastify 5 with a buffer body parser |
| [`scripts/send.ts`](scripts/send.ts)                                 | Plain script: text, template, image |

[`shared/reply.ts`](shared/reply.ts) holds the client setup and a small reply helper. It answers a user by phone number when Meta sends `from`, and by business-scoped user ID (`from_user_id`) otherwise.

## Raw body

Meta signs the exact bytes it sends. If a framework parses the JSON first and you re-serialize it, the bytes change and verification fails. Read the body as a string or `Buffer` (`express.raw`, `await request.text()`, `c.req.text()`, a Fastify buffer parser), pass it to `WebhookHandler.parse`, and let the handler parse the JSON after the signature check.

## Run

```bash
cd examples
pnpm install
export WHATSAPP_ACCESS_TOKEN=...
export WHATSAPP_PHONE_NUMBER_ID=...
export WHATSAPP_APP_SECRET=...
export WHATSAPP_VERIFY_TOKEN=...
pnpm tsx express/server.ts   # or hono/server.ts, fastify/server.ts
```

Expose port 3000 with a tunnel (for example `cloudflared` or `ngrok`) and set `https://<tunnel>/webhook` as the callback URL in the Meta App Dashboard, using the same verify token.

For `scripts/send.ts`, also set `WHATSAPP_RECIPIENT` (a phone number in international format). The Next.js file is a route handler only: copy it to `app/api/webhook/route.ts` in your Next.js app and adjust the import of the helper.

## Notes

- The examples read secrets from environment variables. Never commit them.
- They are typechecked against the repository source on every pull request and are not part of the published package (`files` is `["dist"]`). In your own project, install the package with `npm install @solvejet/whatsapp-cloud-api`.
