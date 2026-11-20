import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { WebhookHandler, WhatsAppWebhookError } from '@solvejet/whatsapp-cloud-api';
import { processMessages, requireEnv } from '../shared/reply.js';

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
  // arrayBuffer() returns the exact bytes Meta sent; c.req.json() would lose them.
  const rawBody = await c.req.arrayBuffer();
  const signature = c.req.header('x-hub-signature-256');
  // Only a bad signature gets 401. Meta does not retry a 401 forever.
  if (!handler.isValid(rawBody, signature)) return c.text('Unauthorized', 401);
  let messages;
  try {
    ({ messages } = handler.parse(rawBody, signature));
  } catch (error) {
    if (error instanceof WhatsAppWebhookError) {
      // Signed but malformed: acknowledge it so Meta does not retry a payload
      // that can never parse for days.
      console.error('Ignoring malformed webhook payload:', error.message);
      return c.text('OK', 200);
    }
    console.error(error);
    return c.text('Internal Server Error', 500);
  }
  void processMessages(messages);
  return c.text('OK', 200);
});
serve({ fetch: app.fetch, port: 3000 });
console.log('Listening on http://localhost:3000/webhook');
