import { createWebhookHandler, verifySignatureAsync } from '@solvejet/whatsapp-cloud-api/web';
declare const body: Uint8Array;
declare const header: string | undefined;
// #region worker
interface Env {
  WHATSAPP_APP_SECRET: string;
  WHATSAPP_VERIFY_TOKEN: string;
}
export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: { waitUntil(promise: Promise<unknown>): void },
  ): Promise<Response> {
    const webhook = createWebhookHandler({
      appSecrets: env.WHATSAPP_APP_SECRET,
      verifyToken: env.WHATSAPP_VERIFY_TOKEN,
      ackMode: 'before', // answer first, run handlers after the response
    });
    webhook.on('message', ({ message }) => {
      console.log('message', message.id, message.type);
    });
    return webhook.handleRequest(request, { waitUntil: (promise) => ctx.waitUntil(promise) });
  },
};
// #endregion
// #region verify
// Web Crypto only, no node:crypto. Resolves to a boolean and never throws.
const valid = await verifySignatureAsync(body, header, process.env.WHATSAPP_APP_SECRET!);
// #endregion
console.log(valid);
