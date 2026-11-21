---
title: 'Send WhatsApp interactive reply buttons and list messages in Node.js'
description: "Send reply buttons and list messages through the WhatsApp Cloud API with Meta's limits, SDK validation, and how to read the user's tap in a webhook."
sidebar:
  order: 4
---

Interactive messages let a user answer with a tap. They are service messages, so you can send them while the [customer service window](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages#customer-service-windows) is open.

## Reply buttons

Meta's [reply buttons page](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/interactive-reply-buttons-messages) documents these limits:

| Field                  | Limit                                    |
| ---------------------- | ---------------------------------------- |
| Buttons                | up to 3                                  |
| Button label (`title`) | 20 characters, unique across the buttons |
| Button `id`            | 256 characters                           |
| Body                   | 1024 characters                          |
| Footer                 | 60 characters                            |
| Header                 | optional: text, image, video or document |

{{include website/snippets/interactive-buttons.ts#send}}

The SDK checks these limits before it sends anything. A fourth button, an empty or duplicate `id`, a title over 20 characters or an over-long body or footer throws `WhatsAppValidationError` with no network call:

{{include website/snippets/interactive-buttons.ts#validation}}

## List messages

Meta's [list messages page](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/interactive-list-messages) documents these limits:

| Field             | Limit                                             |
| ----------------- | ------------------------------------------------- |
| Sections          | up to 10                                          |
| Rows              | up to 10 in total across all sections, at least 1 |
| Button label      | 20 characters                                     |
| Row `title`       | 24 characters                                     |
| Row `description` | 72 characters                                     |
| Row `id`          | 200 characters                                    |
| Section `title`   | required by Meta, 24 characters                   |
| Header            | text only, 60 characters                          |
| Footer            | 60 characters                                     |
| Body              | 4096 characters                                   |

{{include website/snippets/interactive-list.ts#send}}

The SDK checks the section count, the total row count, the button label, row titles and row descriptions. Two differences from Meta's table are worth knowing:

- The SDK applies a 1024-character limit to the body of every interactive message, including lists, which is stricter than the 4096 that Meta lists for lists. For a longer list body, use `client.messages.sendRaw` (see [Raw sends](/whatsapp-cloud-api/guides/raw-sends/)).
- The SDK does not check row `id` length or section titles, and the API remains the authority on both.

## Read the user's choice

When a user taps a button or picks a row, Meta sends a `messages` webhook with `interactive.button_reply` or `interactive.list_reply`. It contains the `id` you set, which is the value to branch on.

{{include website/snippets/interactive-buttons.ts#reply}}

See [Handling events](/whatsapp-cloud-api/webhooks/handling-events/) for flattening a webhook delivery into messages, and [Messaging](/whatsapp-cloud-api/guides/messaging/) for the other message types.
