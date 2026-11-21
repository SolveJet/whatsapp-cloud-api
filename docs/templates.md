# Template management

Create, list, read, edit, and delete message templates with `client.templates`.
Last verified against Graph API v26.0 on 2026-11-21.

Every method accepts an optional trailing `businessAccountId` (the id-scoped
`get`/`edit` take a required template id instead), falling back to the
configured `businessAccountId`; when neither is set the call throws
`WhatsAppValidationError`. `create` validates the documented hard limits
client-side before sending.

```ts
// Create a template. Exactly one BODY component is required.
const created = await client.templates.create({
  name: 'order_confirmation',
  language: 'en_US',
  category: 'UTILITY',
  components: [
    {
      type: 'BODY',
      text: 'Hi {{1}}, your order {{2}} is confirmed.',
      example: { body_text: [['Sam', '12345']] },
    },
    { type: 'FOOTER', text: 'Reply STOP to opt out.' },
  ],
});
console.log(created.id, created.status); // e.g. "123..." "PENDING"

// List templates on the business account (filters and paging are optional).
const { data } = await client.templates.list({ status: 'APPROVED', limit: 20 });
console.log(data.map((t) => t.name));

// Delete every version of a template by name.
await client.templates.delete({ name: 'order_confirmation' });
```

Editing an approved template resets it to `PENDING` for re-review, and a
template's `name` and `language` are immutable.

[Back to the README](../README.md)
