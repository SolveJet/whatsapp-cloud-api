import Fastify from 'fastify';
import { WebhookHandler, WhatsAppWebhookError } from '@solvejet/whatsapp-cloud-api';
import { processMessages, requireEnv } from '../shared/reply.js';

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
  const rawBody = request.body as Buffer;
  const signature = request.headers['x-hub-signature-256'] as string | undefined;
  // Only a bad signature gets 401. Meta does not retry a 401 forever.
  if (!handler.isValid(rawBody, signature)) {
    return reply.code(401).type('text/plain').send('Unauthorized');
  }
  let messages;
  try {
    ({ messages } = handler.parse(rawBody, signature));
  } catch (error) {
    if (error instanceof WhatsAppWebhookError) {
      // Signed but malformed: acknowledge it so Meta does not retry a payload
      // that can never parse for days.
      request.log.error({ err: error }, 'Ignoring malformed webhook payload');
      return reply.code(200).type('text/plain').send('OK');
    }
    throw error;
  }
  void processMessages(messages);
  return reply.code(200).type('text/plain').send('OK');
});
await app.listen({ port: 3000 });
