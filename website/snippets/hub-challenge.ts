import { verifyWebhook, verifyWebhookQuery, WebhookHandler } from '@solvejet/whatsapp-cloud-api';

declare const query: Record<string, string | undefined>; // decoded query string of the GET request

// #region handler
const handler = new WebhookHandler({ verifyToken: process.env.WHATSAPP_VERIFY_TOKEN! });

// Returns { statusCode: 200, body: <hub.challenge> } when hub.mode is "subscribe" and the
// token matches. Otherwise returns { statusCode: 403, body: 'Forbidden' }.
const { statusCode, body } = handler.handleVerification(query);
// Send `body` as plain text with status `statusCode`. Do not wrap it in JSON.
// #endregion

// #region functions
// The same check without a handler. Keys are the literal hub.* names.
const fromQuery = verifyWebhookQuery(query, process.env.WHATSAPP_VERIFY_TOKEN!);

// Or with the three values already extracted from hub.mode, hub.verify_token and hub.challenge.
declare const mode: string;
declare const token: string;
declare const challenge: string;
const fromParts = verifyWebhook({ mode, token, challenge }, process.env.WHATSAPP_VERIFY_TOKEN!);
// #endregion

console.log(statusCode, body, fromQuery.statusCode, fromParts.statusCode);
