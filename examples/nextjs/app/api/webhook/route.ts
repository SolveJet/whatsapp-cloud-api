// Next.js App Router route handler: app/api/webhook/route.ts
import { createWebhookHandler } from '@solvejet/whatsapp-cloud-api/web';
import { echoText, requireEnv } from '../../../../shared/reply.js';

// The default ackMode ('after') runs the handlers before answering, so the work
// finishes inside the invocation. To answer first, set ackMode: 'before' and
// pass waitUntil from @vercel/functions (or use after() from next/server).
const webhook = createWebhookHandler({
  appSecrets: requireEnv('WHATSAPP_APP_SECRET'),
  verifyToken: requireEnv('WHATSAPP_VERIFY_TOKEN'),
});

webhook.on('message', ({ message }) => echoText(message));

// Verify-token handshake and signed deliveries both go through handleRequest.
export const GET = (request: Request): Promise<Response> => webhook.handleRequest(request);
export const POST = (request: Request): Promise<Response> => webhook.handleRequest(request);
