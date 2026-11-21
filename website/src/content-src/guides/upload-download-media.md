---
title: 'Upload and download WhatsApp media with the Cloud API in Node.js'
description: "Upload files to get a media ID, send them, and download media received in webhooks. Meta's size limits and expiry rules, then client.media in TypeScript."
sidebar:
  order: 7
---

Meta's [media reference](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media) covers four operations: upload (`POST /<PHONE_NUMBER_ID>/media`), get a URL (`GET /<MEDIA_ID>`), download (`GET <media URL>`), and delete (`DELETE /<MEDIA_ID>`).

## What the Cloud API does

- An upload is multipart form data with `messaging_product=whatsapp`, the `file` and its `type`. It returns a media `id`.
- Uploaded files persist for 30 days unless you delete them earlier. A media ID returned by the API expires after 30 days. A media ID received in a webhook expires after 7 days.
- A media URL expires after 5 minutes. Query the ID again for a fresh one.
- Downloading requires your access token in the `Authorization` header, and the request fails without it. If a download returns `404`, request a new URL and try again.
- Meta's size limits per type: audio and video 16 MB, images 5 MB (JPEG, PNG, static WebP), documents 100 MB, static stickers 100 KB, animated stickers 500 KB. The [supported types table](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media#supported-media-types) lists the accepted MIME types.
- A mismatched MIME type is a common cause of error `131053` ([error codes](https://developers.facebook.com/documentation/business-messaging/whatsapp/support/error-codes)).

## Upload and send

{{include website/snippets/media-upload-download.ts#upload}}

`upload` accepts a `Blob` or `File`, or an object `{ file, type, filename }` where `file` is a `Blob`, `Uint8Array` or `ArrayBuffer`. A content type is required: from the `Blob`'s `type` or the explicit `type`, otherwise it throws `WhatsAppValidationError`. A `phoneNumberId` must be configured on the client or passed per call.

Uploads are sent as one attempt and are not retried, because a multipart body is not safely replayable. Retry an upload yourself if it fails with a network error or a 5xx response.

## Download received media

{{include website/snippets/media-upload-download.ts#download}}

`download` looks up the URL and then fetches the bytes with your bearer token in one call, so the 5-minute URL lifetime is not an issue. It returns the bytes as a `Uint8Array` with the `mimeType` and, when Meta supplies one, the `sha256`. To fetch a URL you already have, use `client.media.downloadByUrl(url)`. Downloads follow the normal retry policy.

## Look up and delete

{{include website/snippets/media-upload-download.ts#lookup-delete}}

For sending media by link or by ID in messages, see [Messaging](/whatsapp-cloud-api/guides/messaging/) and [Media](/whatsapp-cloud-api/guides/media/). Meta recommends media IDs over URLs for [high throughput](https://developers.facebook.com/documentation/business-messaging/whatsapp/throughput#media-messages).
