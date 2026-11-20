# Block API

Block and unblock the WhatsApp users who have messaged your business with
`client.blocks`. The methods are phone-number-scoped: each accepts an optional
trailing `phoneNumberId` and falls back to the configured `phoneNumberId`; when
neither is set the call throws `WhatsAppValidationError`. You can block or
unblock up to **1000 users per call** — an empty or over-limit list throws
`WhatsAppValidationError` before any request is sent.

```ts
// Block one or more users by WhatsApp phone number.
const res = await client.blocks.block(['15551234567']);
console.log(res.block_users.added_users?.map((u) => u.wa_id));

// Per-user failures are reported even when the overall call succeeds.
for (const failure of res.block_users.failed_users ?? []) {
  console.error(`could not block ${failure.input}:`, failure.errors[0]?.message);
}

// Unblock users (issued as a DELETE with a JSON body) and list blocked users.
await client.blocks.unblock(['15551234567']);
const { data } = await client.blocks.list({ limit: 100 });
console.log(data.map((u) => u.wa_id));
```

Only users who messaged your business in the **last 24 hours** can be blocked.

[Back to the README](../README.md)
