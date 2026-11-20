import express from 'express';
import { WebhookHandler, WhatsAppWebhookError } from '@solvejet/whatsapp-cloud-api';
import { processMessages, requireEnv } from '../shared/reply.js';

const handler = new WebhookHandler({
  appSecret: requireEnv('WHATSAPP_APP_SECRET'),
  verifyToken: requireEnv('WHATSAPP_VERIFY_TOKEN'),
});
const app = express();

// Verify-token handshake: Meta calls this once when you save the webhook URL.
app.get('/webhook', (req, res) => {
  const query: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string') query[key] = value;
  }
  const { statusCode, body } = handler.handleVerification(query);
  res.status(statusCode).type('text/plain').send(body);
});

// The signature is computed over the exact bytes Meta sent. express.raw keeps
// them as a Buffer; do NOT put express.json() in front of this route.
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const rawBody = req.body as Buffer;
  const signature = req.get('x-hub-signature-256');
  // Only a bad signature gets 401. Meta does not retry a 401 forever.
  if (!handler.isValid(rawBody, signature)) {
    res.sendStatus(401);
    return;
  }
  let messages;
  try {
    ({ messages } = handler.parse(rawBody, signature));
  } catch (error) {
    if (error instanceof WhatsAppWebhookError) {
      // Signed but malformed: acknowledge it, otherwise Meta retries a payload
      // that can never parse for days.
      console.error('Ignoring malformed webhook payload:', error.message);
      res.sendStatus(200);
      return;
    }
    console.error(error);
    res.sendStatus(500);
    return;
  }
  res.sendStatus(200); // Acknowledge fast, then do the work.
  void processMessages(messages);
});
app.listen(3000, () => console.log('Listening on http://localhost:3000/webhook'));
