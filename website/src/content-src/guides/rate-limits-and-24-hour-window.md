---
title: 'WhatsApp Cloud API rate limits, error 131047 and the 24-hour window'
description: 'What Meta documents about throughput, rate limit errors and the 24-hour customer service window, and how the Node.js SDK retries and reports each case.'
sidebar:
  order: 9
---

Two separate things block a send: rate limits (you are sending too fast) and the customer service window (you are not allowed to send a free-form message right now).

## Rate limits in the Cloud API

Meta's [throughput page](https://developers.facebook.com/documentation/business-messaging/whatsapp/throughput) states that each registered business phone number supports 80 messages per second by default, with an automatic upgrade to 1,000 messages per second for eligible numbers. Throughput counts inbound and outbound messages. When you exceed it, the API returns error `130429` until you are back within the limit.

The [error codes page](https://developers.facebook.com/documentation/business-messaging/whatsapp/support/error-codes) lists related throttling errors:

- `130429`: Cloud API message throughput reached.
- `131056`: too many messages from your number to the same recipient in a short period. You can still send to other numbers.
- `80007`: the WhatsApp Business Account reached its rate limit.
- `131048`: sending is restricted because of quality or spam signals.

## The 24-hour customer service window

When a user messages or calls you, a 24-hour [customer service window](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages#customer-service-windows) opens. Each new message or call from the user resets it to 24 hours. While it is open you can send any service message. After it closes you can only send approved template messages.

If you send a free-form message with the window closed, the API returns error `131047`, described in the error table as more than 24 hours since the recipient last replied. Meta's remedy is to send a [template message](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview) instead.

## How the SDK behaves

The client retries on HTTP `429`, any `5xx`, and network or timeout failures. Defaults are `maxRetries: 2` (three attempts in total) and a 30-second timeout per attempt. When the response has a `Retry-After` header, the SDK waits that long. Otherwise it waits with exponential backoff and jitter, starting at 300 ms and doubling per attempt. Multipart uploads are never retried.

The error classes help you branch:

- `WhatsAppRateLimitError` is thrown for HTTP 429 and for the codes `130429`, `131056` and `133016`. Its `retryAfterMs` is set when the server sent `Retry-After`. The SDK retries only on the HTTP status, so a rate limit code returned with a status other than 429 or 5xx reaches you without a retry.
- `WhatsAppReEngagementError` is thrown for code `131047`.

{{include website/snippets/rate-limits-and-window.ts#client}}

{{include website/snippets/rate-limits-and-window.ts#handle}}

`WhatsAppErrorCode` has named constants for the codes the SDK maps:

{{include website/snippets/rate-limits-and-window.ts#codes}}

The SDK does not track the window or throttle for you. Record the time of each inbound message if you need to decide between a free-form message and a template before sending. See [Errors and retries](/whatsapp-cloud-api/guides/errors/) for the full hierarchy and [Send a template message](/whatsapp-cloud-api/guides/send-template-message/) for the fallback.
