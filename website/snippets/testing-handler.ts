import { createWebhookHandler } from '@solvejet/whatsapp-cloud-api/web';
import {
  buildWebhookPayload,
  createTestRequest,
  signWebhookBody,
} from '@solvejet/whatsapp-cloud-api/testing';
const secret = 'test-app-secret';
// #region round-trip
const webhook = createWebhookHandler({ appSecrets: secret, verifyToken: 'test-token' });
const texts: string[] = [];
webhook.on('message', ({ message }) => {
  if (message.type === 'text') texts.push(message.text.body);
});
// A signed POST shaped like a Meta delivery.
const request = await createTestRequest({
  payload: buildWebhookPayload('text', {
    entry: [
      {
        id: '102290129340398',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '15550783881', phone_number_id: '106540352242922' },
              messages: [
                {
                  from: '15551234567',
                  id: 'wamid.TEST',
                  timestamp: '1700000000',
                  type: 'text',
                  text: { body: 'hi' },
                },
              ],
            },
          },
        ],
      },
    ],
  }),
  secret,
});
const response = await webhook.handleRequest(request);
// response.status is 200 and texts is ['hi'].
// #endregion
// #region rejection
// A request with a wrong signature gets 401 and runs no handler.
const forged = await createTestRequest({
  payload: buildWebhookPayload('status'),
  signature: 'sha256=' + '0'.repeat(64),
});
const rejected = await webhook.handleRequest(forged);
// rejected.status is 401.
// #endregion
// #region sign
// Sign a body yourself, for example to call a running server with fetch.
const signature = await signWebhookBody('{"object":"whatsapp_business_account"}', secret);
// #endregion
console.log(response.status, rejected.status, signature, texts);
