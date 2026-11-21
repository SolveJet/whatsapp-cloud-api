import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { createWebhookHandler } from '@solvejet/whatsapp-cloud-api';
import { echoText, requireEnv } from '../shared/reply.js';

const webhook = createWebhookHandler({
  appSecrets: requireEnv('WHATSAPP_APP_SECRET'),
  verifyToken: requireEnv('WHATSAPP_VERIFY_TOKEN'),
});

webhook.on('message', ({ message }) => echoText(message));

const app = new Hono();

// handleRequest takes a fetch Request and answers both the GET handshake and the
// signed POST. It reads the raw bytes itself, so do not parse the body first.
app.all('/webhook', (c) => webhook.handleRequest(c.req.raw));

serve({ fetch: app.fetch, port: 3000 });
console.log('Listening on http://localhost:3000/webhook');
