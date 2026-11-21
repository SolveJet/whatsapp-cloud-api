---
title: 'Test a WhatsApp webhook handler without Meta (signed requests in TypeScript)'
description: 'Use @solvejet/whatsapp-cloud-api/testing to build webhook payloads and signed requests, and test your handlers in-process with Vitest or any test runner.'
sidebar:
  order: 5
---

The `@solvejet/whatsapp-cloud-api/testing` entry point builds valid deliveries and signs them the way Meta does, so you can test a handler in-process with no tunnel. It only uses Web Crypto and works on Node 20 and later, Bun, Deno and workerd. The main entry does not import it.

## Send a signed delivery to your handler

{{include website/snippets/testing-handler.ts#round-trip}}

`buildWebhookPayload(kind, overrides?)` builds a complete delivery. The kinds are `text`, `status`, `call`, `template_status`, `flow`, `account_update` and `group`. Plain objects in `overrides` merge key by key. Arrays replace the default. Keys named `__proto__`, `constructor` or `prototype` throw `WhatsAppWebhookError`.

`createTestRequest` takes a `payload` or an exact `body`, plus an optional `secret`, `signature`, `url` and `headers`, and returns a `POST` `Request`. It is async because signing is.

## Check that bad requests are rejected

{{include website/snippets/testing-handler.ts#rejection}}

## Sign a body yourself

{{include website/snippets/testing-handler.ts#sign}}

`signWebhookBody` returns `sha256=<hex>`, the value of the `X-Hub-Signature-256` header.

Related: [the webhook handler](/whatsapp-cloud-api/webhooks/webhook-handler/) and [edge runtimes](/whatsapp-cloud-api/webhooks/edge-runtimes/).
