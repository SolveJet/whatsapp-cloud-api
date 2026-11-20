// Next.js App Router route handler: app/api/webhook/route.ts
import { WebhookHandler, WhatsAppWebhookError } from '@solvejet/whatsapp-cloud-api';
import { processMessages, requireEnv } from '../../../../shared/reply.js';

const handler = new WebhookHandler({
  appSecret: requireEnv('WHATSAPP_APP_SECRET'),
  verifyToken: requireEnv('WHATSAPP_VERIFY_TOKEN'),
});

// Verify-token handshake.
export async function GET(request: Request): Promise<Response> {
  const query: Record<string, string | undefined> = {};
  for (const [key, value] of new URL(request.url).searchParams) query[key] = value;
  const { statusCode, body } = handler.handleVerification(query);
  return new Response(body, { status: statusCode, headers: { 'content-type': 'text/plain' } });
}

export async function POST(request: Request): Promise<Response> {
  // arrayBuffer() returns the exact bytes Meta sent. Calling request.json()
  // would re-serialize the body and the signature check would fail.
  const rawBody = await request.arrayBuffer();
  const signature = request.headers.get('x-hub-signature-256') ?? undefined;
  // Only a bad signature gets 401. Meta does not retry a 401 forever.
  if (!handler.isValid(rawBody, signature)) {
    return new Response('Unauthorized', { status: 401 });
  }
  let messages;
  try {
    ({ messages } = handler.parse(rawBody, signature));
  } catch (error) {
    if (error instanceof WhatsAppWebhookError) {
      // Signed but malformed: acknowledge it so Meta does not retry a payload
      // that can never parse for days.
      console.error('Ignoring malformed webhook payload:', error.message);
      return new Response('OK', { status: 200 });
    }
    console.error(error);
    return new Response('Internal Server Error', { status: 500 });
  }
  // Await the work here: serverless functions may stop after the response. The
  // messages run concurrently and each failure is logged without dropping the
  // rest of the batch.
  await processMessages(messages);
  return new Response('OK', { status: 200 });
}
