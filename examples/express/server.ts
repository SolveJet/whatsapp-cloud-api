import express from 'express';
import { WebhookHandler, WhatsAppWebhookError } from '@solvejet/whatsapp-cloud-api';
import { echoText, requireEnv } from '../shared/reply.js';

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
  try {
    const { messages } = handler.parse(req.body as Buffer, req.get('x-hub-signature-256'));
    res.sendStatus(200); // Acknowledge fast, then do the work.
    for (const message of messages) {
      echoText(message).catch((error: unknown) => console.error(error));
    }
  } catch (error) {
    if (error instanceof WhatsAppWebhookError) {
      res.sendStatus(401);
      return;
    }
    throw error;
  }
});

app.listen(3000, () => console.log('Listening on http://localhost:3000/webhook'));
