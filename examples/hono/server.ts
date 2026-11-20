import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { WebhookHandler, WhatsAppWebhookError } from '@solvejet/whatsapp-cloud-api';
import { echoText, requireEnv } from '../shared/reply.js';

const handler = new WebhookHandler({
  appSecret: requireEnv('WHATSAPP_APP_SECRET'),
  verifyToken: requireEnv('WHATSAPP_VERIFY_TOKEN'),
});
const app = new Hono();

// Verify-token handshake.
app.get('/webhook', (c) => {
  const { statusCode, body } = handler.handleVerification(c.req.query());
  return c.text(body, statusCode === 200 ? 200 : 403);
});

app.post('/webhook', async (c) => {
  // c.req.text() returns the raw body; c.req.json() would lose the exact bytes.
  const rawBody = await c.req.text();
  try {
    const { messages } = handler.parse(rawBody, c.req.header('x-hub-signature-256'));
    for (const message of messages) {
      echoText(message).catch((error: unknown) => console.error(error));
    }
    return c.text('OK', 200);
  } catch (error) {
    if (error instanceof WhatsAppWebhookError) return c.text('Unauthorized', 401);
    throw error;
  }
});

serve({ fetch: app.fetch, port: 3000 });
console.log('Listening on http://localhost:3000/webhook');
