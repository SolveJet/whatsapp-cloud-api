---
title: 'Handle the WhatsApp webhook verification request (hub.challenge)'
description: "Answer Meta's GET verification request for a WhatsApp webhook: match hub.verify_token, return hub.challenge as plain text, in Node.js with the SDK."
sidebar:
  order: 3
---

## What Meta sends

When you set or edit the **Callback URL** or **Verify token** in the App Dashboard, Meta sends a `GET` request to your endpoint. Per Meta's [webhook endpoint guide](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint), the query string has three parameters:

- `hub.mode`, always `subscribe`.
- `hub.challenge`, a string Meta generates.
- `hub.verify_token`, the verify token you typed into the dashboard.

To pass, compare `hub.verify_token` with the string stored on your server. If it matches, respond with HTTP `200` and the `hub.challenge` value. Otherwise respond with a 400-level status or anything other than `200`. If your endpoint answers anything else, Meta treats it as unverified and sends no webhooks. The [Graph API webhooks guide](https://developers.facebook.com/docs/graph-api/webhooks/getting-started) adds that PHP rewrites dots in query names to underscores, which matters only if you run PHP.

The verify token is a string you choose. It is separate from your app secret and your access token.

## With the SDK

{{include website/snippets/hub-challenge.ts#handler}}

On success, `handleVerification` returns `{ statusCode: 200, body: <hub.challenge> }`. On any mismatch it returns `{ statusCode: 403, body: 'Forbidden' }`. Return `body` as the raw response body with a text content type. Do not wrap it in JSON.

Behavior, as covered in the SDK's tests:

- The token comparison is constant-time.
- `hub.mode` must be `subscribe`.
- An empty or missing expected token always gives `403`, so an unset environment variable can never accept a request.
- The `WebhookHandler` constructor throws `WhatsAppWebhookError` when `verifyToken` is present but empty. `handleVerification` throws the same error when the handler was built without a `verifyToken`.

{{include website/snippets/hub-challenge.ts#functions}}

`verifyWebhookQuery` takes the query map with the literal `hub.*` keys, and `verifyWebhook` takes the three values. Both return the same `{ statusCode, body }` result.

Next, [verify the signature of each delivery](/whatsapp-cloud-api/webhooks/verify-signature/). Framework recipes: [Express](/whatsapp-cloud-api/webhooks/express/), [Next.js](/whatsapp-cloud-api/webhooks/nextjs/), [Hono](/whatsapp-cloud-api/webhooks/hono/), [Fastify](/whatsapp-cloud-api/webhooks/fastify/).
