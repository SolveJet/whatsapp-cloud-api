# Error handling

Every API failure is a subclass of `WhatsAppApiError`, so `.code` (the Graph
error code), `.httpStatus`, and related fields are always available. Branch on
the specific classes to react:

```ts
import {
  WhatsAppRateLimitError,
  WhatsAppReEngagementError,
  WhatsAppValidationError,
} from '@solvejet/whatsapp-cloud-api';

try {
  await client.messages.sendText('15551234567', 'Hello from the SDK');
} catch (err) {
  if (err instanceof WhatsAppRateLimitError) {
    // Rate limited: back off before retrying. When the response carried a
    // Retry-After header, `retryAfterMs` holds the server-advised delay.
    const waitMs = err.retryAfterMs ?? 60_000;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  } else if (err instanceof WhatsAppReEngagementError) {
    // Equivalent check: `err.code === WhatsAppErrorCode.RE_ENGAGEMENT_MESSAGE`.
    // Outside the 24-hour customer service window: fall back to a template.
    await client.messages.sendTemplate('15551234567', {
      name: 'hello_world',
      language: { code: 'en_US' },
    });
  } else if (err instanceof WhatsAppValidationError) {
    // Client-side limit or shape violation: fix the request before resending.
    console.error('Invalid request:', err.message);
  } else {
    throw err;
  }
}
```

**Error class mapping.** `errorFromResponse` picks the error class from the HTTP
status and Graph error `code`:

- `429`, `130429`, `131056`, `133016` → `WhatsAppRateLimitError`
- `131047` → `WhatsAppReEngagementError`
- `401`, `403`, `0`, `190` → `WhatsAppAuthenticationError`
- everything else → `WhatsAppApiError` (with `.code` set)

All of the above extend `WhatsAppApiError`. Network, abort, and timeout failures
raise `WhatsAppRequestError` (with an `isTimeout` flag). `WhatsAppValidationError`
is raised locally before a request is sent and is not part of this mapping.

For readable comparisons against `err.code`, the exported `WhatsAppErrorCode`
constants map names the common Graph error codes (e.g.
`WhatsAppErrorCode.ACCESS_TOKEN_EXPIRED`, `WhatsAppErrorCode.SPAM_RATE_LIMIT_HIT`,
`WhatsAppErrorCode.TEMPLATE_NOT_EXIST`), so you can branch on a named constant
instead of a magic number. Its value type is `WhatsAppErrorCodeValue`.

## Retries

The client retries failed requests with jittered exponential backoff (300 ms,
doubling per attempt) and waits for `Retry-After` when the response has it.
`maxRetries` (default `2`, so three attempts) and `timeoutMs` (default 30 s per
attempt) control it.

| Request                                                                                 | Retried on                             |
| --------------------------------------------------------------------------------------- | -------------------------------------- |
| `GET`, `DELETE`, and `POST` other than messages                                         | `429`, `5xx`, network errors, timeouts |
| `POST {phoneNumberId}/messages`: every send, `sendRaw`, mark-as-read, typing indicators | `429` only                             |
| Multipart media upload                                                                  | never                                  |

Never retried, for any request: a call aborted through its `signal`, a `200`
response whose body is not valid JSON, and any `4xx` other than `429`. A rate
limit code that arrives with another HTTP status, such as a `400`, is not
retried either.

**Why sends retry on `429` only.** Meta documents no idempotency key or
de-duplication for sends. A `5xx`, a timeout or a dropped connection can happen
after Meta accepted the message, and a retry would then send it a second time.
A `429` is a rejection, so retrying it is safe. A transient `5xx` on a send now
reaches your code as `WhatsAppApiError`, and a network failure or timeout as
`WhatsAppRequestError`. Check the `messages` and status webhooks before you
resend, or de-duplicate on your side.

To restore the older behaviour for sends, set `retryMessageSends: true`:

```ts
const client = new WhatsAppClient({
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
  retryMessageSends: true, // 5xx, network errors and timeouts are retried; duplicates are possible
});
```

[Back to the README](../README.md)
