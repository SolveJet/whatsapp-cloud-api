// Next.js App Router route handler: app/api/webhook/route.ts
import { WebhookHandler, WhatsAppWebhookError } from '@solvejet/whatsapp-cloud-api';
import { echoText, requireEnv } from '../../../../shared/reply.js';

const handler = new WebhookHandler({
  appSecret: requireEnv('WHATSAPP_APP_SECRET'),
  verifyToken: requireEnv('WHATSAPP_VERIFY_TOKEN'),
});

// Verify-token handshake.
export async function GET(request: Request): Promise<Response> {
  const query: Record<string, string | undefined> = {};
  for (const [key, value] of new URL(request.url).searchParams) query[key] = value;
  const { statusCode, body } = handler.handleVerification(query);
  return new Response(body, { status: statusCode });
}

export async function POST(request: Request): Promise<Response> {
  // Read the body as text. Calling request.json() would re-serialize it and the
  // signature check would fail.
  const rawBody = await request.text();
  try {
    const { messages } = handler.parse(rawBody, request.headers.get('x-hub-signature-256') ?? '');
    // Await the work here: serverless functions may stop after the response.
    for (const message of messages) await echoText(message);
    return new Response('OK', { status: 200 });
  } catch (error) {
    if (error instanceof WhatsAppWebhookError) return new Response('Unauthorized', { status: 401 });
    throw error;
  }
}
