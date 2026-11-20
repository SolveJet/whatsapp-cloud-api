# Flows management

Build and manage [WhatsApp Flows](https://developers.facebook.com/docs/whatsapp/flows)
with `client.flows`. The methods are WABA-scoped: each accepts an optional
trailing `businessAccountId` and falls back to the configured
`businessAccountId`; when neither is set the call throws
`WhatsAppValidationError`. `create` validates a non-empty `name` and a non-empty
`categories` array client-side before sending.

```ts
// Create a draft flow, then upload its Flow JSON and publish it.
const flow = await client.flows.create({
  name: 'lead_capture',
  categories: ['LEAD_GENERATION'],
});

// Upload the Flow JSON as a FLOW_JSON asset (string, Uint8Array, or Blob).
await client.flows.updateJson(flow.id, JSON.stringify(flowJson), { name: 'flow.json' });

// Publish once the JSON validates. Only DRAFT flows can be deleted.
await client.flows.publish(flow.id);

// List flows, read one, and fetch a short-lived preview URL.
const { data } = await client.flows.list({ fields: ['id', 'name', 'status'] });
const detail = await client.flows.get(flow.id);
const preview = await client.flows.getPreview(flow.id, { invalidate: true });
console.log(preview.preview?.preview_url);
```

Update a flow's metadata with `update` (at least one editable field is
required), inspect its uploaded assets with `listAssets`, retire it with
`deprecate`, and remove a draft with `delete`.

[Back to the README](../README.md)
