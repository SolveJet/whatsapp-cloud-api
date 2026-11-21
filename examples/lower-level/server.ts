// The building blocks without createWebhookHandler: verify, parse and dispatch yourself.
import { createServer } from 'node:http';
import {
  extractMessages,
  extractStatuses,
  parseWebhook,
  verifySignature,
  WebhookHandler,
  WhatsAppWebhookError,
} from '@solvejet/whatsapp-cloud-api';
import { processMessages, requireEnv } from '../shared/reply.js';

const appSecret = requireEnv('WHATSAPP_APP_SECRET');
const handler = new WebhookHandler({ appSecret, verifyToken: requireEnv('WHATSAPP_VERIFY_TOKEN') });

const readBody = async (request: AsyncIterable<Buffer>): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks);
};

createServer((req, res) => {
  void (async () => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/webhook') {
      res.writeHead(404).end();
      return;
    }
    if (req.method === 'GET') {
      const { statusCode, body } = handler.handleVerification(Object.fromEntries(url.searchParams));
      res.writeHead(statusCode, { 'content-type': 'text/plain' }).end(body);
      return;
    }
    if (req.method !== 'POST') {
      res.writeHead(405, { allow: 'GET, POST' }).end();
      return;
    }
    const rawBody = await readBody(req);
    const signature = req.headers['x-hub-signature-256'];
    const header = typeof signature === 'string' ? signature : undefined;
    if (!verifySignature(rawBody, header, appSecret)) {
      res.writeHead(401).end();
      return;
    }
    try {
      const payload = parseWebhook(rawBody);
      res.writeHead(200).end();
      for (const status of extractStatuses(payload)) {
        console.log(`message ${status.id} -> ${status.status}`);
      }
      void processMessages(extractMessages(payload));
    } catch (error) {
      if (!(error instanceof WhatsAppWebhookError)) throw error;
      // Signed but malformed: acknowledge it so Meta does not retry it.
      console.error('Ignoring malformed webhook payload:', error.message);
      res.writeHead(200).end();
    }
  })().catch((error: unknown) => {
    console.error(error);
    if (!res.headersSent) res.writeHead(500).end();
  });
}).listen(3000, () => console.log('Listening on http://localhost:3000/webhook'));
