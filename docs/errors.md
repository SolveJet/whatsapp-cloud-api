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

[Back to the README](../README.md)
