---
title: 'Send a WhatsApp template message from Node.js / TypeScript'
description: 'Send an approved WhatsApp template message with the Cloud API from Node.js. Raw request shape first, then client.messages.sendTemplate in TypeScript.'
sidebar:
  order: 3
---

Template messages are the only message type you can send to a WhatsApp user outside the 24-hour customer service window, and you can also send them inside it. Meta describes the mechanics in [Template fundamentals](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview).

## What the Cloud API expects

A template message is a `POST` to `/<PHONE_NUMBER_ID>/messages` with `type` set to `template`. The `template` object carries the template `name`, a `language.code`, and `components` that fill the template's variables. Meta's examples for [positional and named parameters](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview#parameter-formats) show both shapes.

Rules from Meta's docs that matter when you send:

- The template must have the status `APPROVED`. A template in any other status cannot be sent ([template status](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview)).
- Template names are not unique across languages, so `language.code` has to match the language the template was created in.
- Parameter values go in `components`, in the order the placeholders appear in the template text (positional format).

If the number of parameters is wrong, the API answers with error `132000`. A name and language pair that does not exist, or a template that is not approved, gives `132001`. See the [error code reference](https://developers.facebook.com/documentation/business-messaging/whatsapp/support/error-codes).

## With the SDK

{{include website/snippets/send-template.ts#send}}

`sendTemplate` posts exactly this payload and returns the API response, so `response.messages[0]?.id` is the message ID you will see again in status webhooks. Components use the same field names as the API (`sub_type`, `index`, `parameters`).

Header media and button parameters use the same `components` array:

{{include website/snippets/send-template.ts#header-and-button}}

## Errors

A wrong template name, language or parameter count comes back as a `WhatsAppApiError` carrying the Graph error code in `error.code`. The SDK does not check template parameters against the template before sending. See [Errors and retries](/whatsapp-cloud-api/guides/errors/) for the class hierarchy and [Templates](/whatsapp-cloud-api/guides/templates/) for creating and listing templates with `client.templates`.

If you send a free-form message outside the 24-hour window, the API rejects it with code `131047`. See [Rate limits and the 24-hour window](/whatsapp-cloud-api/guides/rate-limits-and-24-hour-window/).
