---
title: 'Verify WhatsApp Cloud API webhook signatures in Node.js (X-Hub-Signature-256)'
description: 'Validate the X-Hub-Signature-256 header on WhatsApp webhooks in Node.js with HMAC-SHA256 over the raw body, using verifySignature or WebhookHandler.'
sidebar:
  order: 2
---

## What Meta sends

Every webhook `POST` carries an `X-Hub-Signature-256` header of the form `sha256=<hash>`. Per Meta's [webhook endpoint guide](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint), the hash is an HMAC-SHA256 of the JSON payload using your app secret as the key. To validate, compute that HMAC over the payload, compare it with the part of the header after `sha256=`, and treat the request as invalid if they differ. Meta says to answer a valid request with `200` and an invalid one with a 400-level status or anything other than `200`. Verifying is optional on Meta's side. Do it anyway: without it, anyone who finds your URL can post fake events.

The HMAC is computed over the exact bytes Meta sent. If your framework parses the JSON first and you hash `JSON.stringify(body)`, the bytes can differ and valid signatures fail. Keep the raw body. See [Webhooks: raw body](/whatsapp-cloud-api/webhooks/raw-body/) and the recipes for [Express](/whatsapp-cloud-api/webhooks/express/), [Next.js](/whatsapp-cloud-api/webhooks/nextjs/), [Hono](/whatsapp-cloud-api/webhooks/hono/) and [Fastify](/whatsapp-cloud-api/webhooks/fastify/).

## With the SDK

{{include website/snippets/verify-signature.ts#function}}

`verifySignature(rawBody, signatureHeader, appSecret)` returns a boolean and never throws on bad input. It accepts a `string`, `Uint8Array` (including `Buffer`) or `ArrayBuffer`. The comparison is constant-time. It returns `false` when the header is missing, does not start with `sha256=`, or does not match, and always `false` when `appSecret` is empty or not a string, so an unset environment variable cannot validate anything.

{{include website/snippets/verify-signature.ts#handler}}

`WebhookHandler` binds the secret once:

- `isValid` returns a boolean.
- `verifyOrThrow` throws `WhatsAppWebhookError` when the signature is wrong.
- `parse` verifies and then parses, so a bad signature throws before any parsing happens.
- The constructor throws `WhatsAppWebhookError` when `appSecret` or `verifyToken` is present but empty or not a string. Omitting the `appSecret` key disables signature enforcement, so `parse` accepts unsigned bodies. Only do that when something else authenticates the request.

## Body size

Meta states that webhook payloads can be up to 3 MB. `WebhookHandler.parse` and `parseWebhook` reject a string or byte body above `maxBodyBytes`, which defaults to 3 MiB (3,145,728 bytes), before hashing or parsing. Pass `maxBodyBytes` to change the limit or `false` to turn it off:

{{include website/snippets/verify-signature.ts#max-body}}

An oversized body throws `WhatsAppWebhookError`.

## Which status code to return

The recipes answer a bad signature with `401`. They answer a validly signed but malformed payload with `200`, because Meta retries non-`200` deliveries for up to 7 days and a payload that cannot parse will never succeed. Meta can deliver the same event more than once, so deduplicate by message ID.

For the verification request that Meta sends when you save the webhook URL, see [the hub.challenge handshake](/whatsapp-cloud-api/webhooks/verification-request/).
