import Fastify from 'fastify';
import { createWebhookHandler } from '@solvejet/whatsapp-cloud-api';
import { echoText, requireEnv } from '../shared/reply.js';

const webhook = createWebhookHandler({
  appSecrets: requireEnv('WHATSAPP_APP_SECRET'),
  verifyToken: requireEnv('WHATSAPP_VERIFY_TOKEN'),
});

webhook.on('message', ({ message }) => echoText(message));

const app = Fastify();

// Keep the JSON body as a raw Buffer so the signature can be checked against
// the exact bytes Meta sent. The handler parses it after verification.
app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_request, body, done) => {
  done(null, body);
});

// Verify-token handshake.
app.get<{ Querystring: Record<string, string> }>('/webhook', async (request, reply) => {
  const { statusCode, body } = webhook.handleVerification(request.query);
  return reply.code(statusCode).type('text/plain').send(body);
});

app.post('/webhook', async (request, reply) => {
  const signature = request.headers['x-hub-signature-256'];
  const result = await webhook.handleDelivery(
    request.body as Buffer,
    typeof signature === 'string' ? signature : undefined,
  );
  return reply.code(result.httpStatus).type('text/plain').send('');
});

await app.listen({ port: 3000 });
