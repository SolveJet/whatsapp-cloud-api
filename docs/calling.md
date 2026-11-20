# Calling

Manage the [WhatsApp Business Calling](https://developers.facebook.com/docs/whatsapp/cloud-api/calling)
settings and call lifecycle with `client.calls`. The methods are
phone-number-scoped: each accepts an optional trailing `phoneNumberId` and falls
back to the configured `phoneNumberId`; when neither is set the call throws
`WhatsAppValidationError`.

> **Scope: this SDK handles the REST signaling + settings only.** The WhatsApp
> Business Calling API also has a real-time **media plane** — the SDP
> offer/answer exchange carried over **WebRTC (and SIP)**. Running that media
> stack is **the caller's responsibility**: this SDK does not open, negotiate,
> or terminate media sessions. It passes SDP strings through as **opaque
> values** (never parsed or validated), so you produce and consume them with
> your own WebRTC/SIP implementation.

```ts
// Enable calling for the phone number and read the current settings.
await client.calls.updateSettings({ calling: { status: 'ENABLED' } });
const settings = await client.calls.getSettings();
console.log(settings.calling?.status);

// Call lifecycle. `sdp` is an opaque { sdpType, sdp } pair you produce/consume
// with your own WebRTC/SIP stack — the SDK only relays it.
const call = await client.calls.initiate({
  to: '15551234567',
  sdp: { sdpType: 'offer', sdp: localOfferSdp },
});
const callId = call.calls[0]?.id;

await client.calls.accept(callId, { sdpType: 'answer', sdp: localAnswerSdp });
await client.calls.terminate(callId);
```

Reject an inbound call with `reject(callId)` and send an early media answer with
`preAccept(callId, sdp)` before accepting.

[Back to the README](../README.md)
