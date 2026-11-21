---
title: 'WhatsApp Cloud API webhook in a Next.js App Router route handler'
description: 'A Next.js App Router route handler for the WhatsApp Cloud API webhook: read the raw body with arrayBuffer(), verify the signature, return the challenge.'
sidebar:
  order: 6
---

In a Next.js App Router route handler, call `request.arrayBuffer()` to get the exact bytes. Calling `request.json()` first would lose them and the signature check would fail. `handler.isValid` and `handler.parse` accept an `ArrayBuffer`. Because serverless functions can stop after the response, the example awaits its work before returning.

{{include examples/nextjs/app/api/webhook/route.ts}}

The full runnable project is in [examples/nextjs](https://github.com/SolveJet/whatsapp-cloud-api/tree/master/examples/nextjs). Each step is explained in [verify the signature](/whatsapp-cloud-api/webhooks/verify-signature/) and [the hub.challenge handshake](/whatsapp-cloud-api/webhooks/verification-request/). Meta's own description of the two request types is in the [webhook endpoint guide](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint).
