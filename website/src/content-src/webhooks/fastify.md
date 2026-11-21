---
title: 'WhatsApp Cloud API webhook in Fastify with signature verification'
description: 'A Fastify route for the WhatsApp Cloud API webhook: a buffer content-type parser keeps the raw body, then verify X-Hub-Signature-256 and parse.'
sidebar:
  order: 8
---

Fastify parses JSON before your handler runs, so replace the `application/json` parser with one that uses `parseAs: 'buffer'`. The route then receives the raw `Buffer`, which `handler.isValid` and `handler.parse` take as is.

{{include examples/fastify/server.ts}}

The full runnable project is in [examples/fastify](https://github.com/SolveJet/whatsapp-cloud-api/tree/master/examples/fastify). Each step is explained in [verify the signature](/whatsapp-cloud-api/webhooks/verify-signature/) and [the hub.challenge handshake](/whatsapp-cloud-api/webhooks/verification-request/). Meta's own description of the two request types is in the [webhook endpoint guide](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint).
