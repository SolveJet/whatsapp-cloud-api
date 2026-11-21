import express from 'express';
import { createWebhookHandler } from '@solvejet/whatsapp-cloud-api';
import { echoText, requireEnv } from '../shared/reply.js';

const webhook = createWebhookHandler({
  appSecrets: requireEnv('WHATSAPP_APP_SECRET'),
  verifyToken: requireEnv('WHATSAPP_VERIFY_TOKEN'),
});

// One handler per event. A throw in one handler is passed to onError and does not
// stop the other events of the delivery.
webhook.on('message', ({ message }) => echoText(message));
webhook.on('status', ({ status }) => {
  console.log(`message ${status.id} -> ${status.status}`);
});

const app = express();

// Verify-token handshake: Meta calls this once when you save the webhook URL.
app.get('/webhook', (req, res) => {
  const query: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string') query[key] = value;
  }
  const { statusCode, body } = webhook.handleVerification(query);
  res.status(statusCode).type('text/plain').send(body);
});

// The signature is computed over the exact bytes Meta sent. express.raw keeps
// them as a Buffer; do NOT put express.json() in front of this route.
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const rawBody = req.body as Buffer;
  const result = await webhook.handleDelivery(rawBody, req.get('x-hub-signature-256'));
  res.sendStatus(result.httpStatus);
});

app.listen(3000, () => console.log('Listening on http://localhost:3000/webhook'));
