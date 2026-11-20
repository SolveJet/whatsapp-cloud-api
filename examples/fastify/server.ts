import Fastify from 'fastify';
import { WebhookHandler, WhatsAppWebhookError } from '@solvejet/whatsapp-cloud-api';
import { echoText, requireEnv } from '../shared/reply.js';

const handler = new WebhookHandler({
  appSecret: requireEnv('WHATSAPP_APP_SECRET'),
  verifyToken: requireEnv('WHATSAPP_VERIFY_TOKEN'),
});
const app = Fastify();

// Keep the JSON body as a raw Buffer so the signature can be checked against
// the exact bytes Meta sent. The handler parses it after verification.
app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_request, body, done) => {
  done(null, body);
});

// Verify-token handshake.
app.get<{ Querystring: Record<string, string> }>('/webhook', async (request, reply) => {
  const { statusCode, body } = handler.handleVerification(request.query);
  return reply.code(statusCode).type('text/plain').send(body);
});

app.post('/webhook', async (request, reply) => {
  try {
    const { messages } = handler.parse(
      request.body as Buffer,
      request.headers['x-hub-signature-256'] as string | undefined,
    );
    for (const message of messages) {
      echoText(message).catch((error: unknown) => console.error(error));
    }
    return reply.code(200).send('OK');
  } catch (error) {
    if (error instanceof WhatsAppWebhookError) return reply.code(401).send('Unauthorized');
    throw error;
  }
});

await app.listen({ port: 3000 });
