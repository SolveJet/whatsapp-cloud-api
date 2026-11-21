---
title: 'WhatsApp Cloud API webhook in a Next.js App Router route handler'
description: 'A Next.js App Router route handler for the WhatsApp Cloud API webhook: createWebhookHandler and handleRequest verify X-Hub-Signature-256 and answer the challenge.'
sidebar:
  order: 6
---

In a Next.js App Router route handler, pass the `Request` to `handleRequest` from `createWebhookHandler`. It reads the raw bytes itself, so do not call `request.json()` first. The example imports from the `/web` entry point and keeps the default `ackMode`, so the handlers finish before the response. To answer first, set `ackMode: 'before'` and pass `waitUntil`; see [Edge runtimes](/whatsapp-cloud-api/webhooks/edge-runtimes/).

{{include examples/nextjs/app/api/webhook/route.ts}}

The full runnable project is in [examples/nextjs](https://github.com/SolveJet/whatsapp-cloud-api/tree/master/examples/nextjs). Each step is explained in [verify the signature](/whatsapp-cloud-api/webhooks/verify-signature/) and [the hub.challenge handshake](/whatsapp-cloud-api/webhooks/verification-request/). Meta's own description of the two request types is in the [webhook endpoint guide](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint).
