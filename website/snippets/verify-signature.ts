import { verifySignature, WebhookHandler } from '@solvejet/whatsapp-cloud-api';

declare const rawBody: Buffer; // the exact bytes of the request, before any JSON parsing
declare const signatureHeader: string | undefined; // the X-Hub-Signature-256 header value

// #region function
// The function form: returns true only when the header is present, starts with
// "sha256=" and matches the HMAC-SHA256 of the raw body keyed with the app secret.
const ok = verifySignature(rawBody, signatureHeader, process.env.WHATSAPP_APP_SECRET!);
if (!ok) {
  // Respond 401 and stop. Do not parse the body.
}
// #endregion

// #region handler
// The handler form: binds the secret once. The constructor throws
// WhatsAppWebhookError when appSecret is present but empty or not a string.
const handler = new WebhookHandler({ appSecret: process.env.WHATSAPP_APP_SECRET! });

handler.isValid(rawBody, signatureHeader); // boolean, never throws
handler.verifyOrThrow(rawBody, signatureHeader); // throws WhatsAppWebhookError when invalid
const { messages, statuses } = handler.parse(rawBody, signatureHeader); // verify, then parse
// #endregion

// #region max-body
// Default 3 MiB. Pass a number to lower it, or false to turn the check off.
new WebhookHandler({ appSecret: process.env.WHATSAPP_APP_SECRET!, maxBodyBytes: 1024 * 1024 });
// #endregion

console.log(ok, messages.length, statuses.length);
