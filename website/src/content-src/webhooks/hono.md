---
title: 'WhatsApp Cloud API webhook in Hono with signature verification'
description: 'A Hono route for the WhatsApp Cloud API webhook: createWebhookHandler and handleRequest verify X-Hub-Signature-256 and answer the challenge.'
sidebar:
  order: 7
---

In Hono, hand the underlying fetch `Request` (`c.req.raw`) to `handleRequest`. It answers the GET handshake and the signed POST, and reads the raw bytes itself, so do not call `c.req.json()` first.

{{include examples/hono/server.ts}}

The full runnable project is in [examples/hono](https://github.com/SolveJet/whatsapp-cloud-api/tree/master/examples/hono). Each step is explained in [verify the signature](/whatsapp-cloud-api/webhooks/verify-signature/) and [the hub.challenge handshake](/whatsapp-cloud-api/webhooks/verification-request/). Meta's own description of the two request types is in the [webhook endpoint guide](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint).
