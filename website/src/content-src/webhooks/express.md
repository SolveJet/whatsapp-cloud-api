---
title: 'WhatsApp Cloud API webhook in Express with signature verification'
description: 'A working Express route for the WhatsApp Cloud API webhook: express.raw for the raw body, verify X-Hub-Signature-256, handle the challenge.'
sidebar:
  order: 5
---

In Express, the signature must be checked against the bytes Meta sent. Mount `express.raw({ type: 'application/json' })` on the POST route so `req.body` is a `Buffer`, and do not put `express.json()` in front of it. Pass that buffer to `handleDelivery` and answer with the status it returns. The GET route reads `req.query` for the verification request.

{{include examples/express/server.ts}}

The full runnable project is in [examples/express](https://github.com/SolveJet/whatsapp-cloud-api/tree/master/examples/express). Each step is explained in [verify the signature](/whatsapp-cloud-api/webhooks/verify-signature/) and [the hub.challenge handshake](/whatsapp-cloud-api/webhooks/verification-request/). Meta's own description of the two request types is in the [webhook endpoint guide](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint).
