---
title: 'Send your first WhatsApp message from Node.js'
description: 'Send a text message with the WhatsApp Cloud API from Node.js and TypeScript using an access token and a phone number ID, and read the message ID back.'
sidebar:
  order: 3
---

You need two values from the [WhatsApp section of the App Dashboard](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started): an access token and the ID of the business phone number you send from. A message to a number that is not in a [customer service window](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages#customer-service-windows) can only be a template message. See [Send a template message](/whatsapp-cloud-api/guides/send-template-message/).

{{include website/snippets/install-check.ts#client}}

`sendText` posts to `/<PHONE_NUMBER_ID>/messages` and returns the API response. The first entry in `messages` holds the WhatsApp message ID, which later appears in status webhooks. See [Configuration](/whatsapp-cloud-api/getting-started/configuration/) for timeouts, retries and the API version, and [Messaging](/whatsapp-cloud-api/guides/messaging/) for the other message types.
