import { createWebhookHandler } from '@solvejet/whatsapp-cloud-api/web';

interface Env {
  WHATSAPP_APP_SECRET: string;
  WHATSAPP_VERIFY_TOKEN: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const handler = createWebhookHandler({
      appSecrets: env.WHATSAPP_APP_SECRET,
      verifyToken: env.WHATSAPP_VERIFY_TOKEN,
      // Reply 200 immediately and finish the handlers after the response.
      ackMode: 'before',
    });

    handler.on('message', ({ message }) => {
      console.log('message', message.id, message.type);
    });

    return handler.handleRequest(request, { waitUntil: (promise) => ctx.waitUntil(promise) });
  },
} satisfies ExportedHandler<Env>;
