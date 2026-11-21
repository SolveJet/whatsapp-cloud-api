---
title: 'WhatsApp Cloud API webhook in Hono with signature verification'
description: 'A Hono handler for the WhatsApp Cloud API webhook: read the raw body with c.req.arrayBuffer(), verify X-Hub-Signature-256, answer the challenge.'
sidebar:
  order: 7
---

In Hono, read the body with `c.req.arrayBuffer()` before anything parses it. `c.req.json()` would lose the original bytes. The handler accepts the resulting `ArrayBuffer` directly. The GET route passes `c.req.query()` to `handleVerification`.

{{include examples/hono/server.ts}}

The full runnable project is in [examples/hono](https://github.com/SolveJet/whatsapp-cloud-api/tree/master/examples/hono). Each step is explained in [verify the signature](/whatsapp-cloud-api/webhooks/verify-signature/) and [the hub.challenge handshake](/whatsapp-cloud-api/webhooks/verification-request/). Meta's own description of the two request types is in the [webhook endpoint guide](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint).
