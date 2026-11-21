import { WhatsAppClient } from '@solvejet/whatsapp-cloud-api';

const client = new WhatsAppClient({
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
});

// #region send
const response = await client.messages.sendTemplate('15551234567', {
  name: 'order_confirmation', // an APPROVED template in your account
  language: { code: 'en_US' }, // must match the language the template was created in
  components: [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: 'Jessica' },
        { type: 'text', text: 'SKBUP2-4CPIG9' },
      ],
    },
  ],
});

console.log(response.messages[0]?.id); // the WhatsApp message ID (WAMID)
// #endregion

// #region header-and-button
await client.messages.sendTemplate('15551234567', {
  name: 'shipping_update',
  language: { code: 'en_US' },
  components: [
    {
      type: 'header',
      parameters: [{ type: 'image', image: { id: '2762702990552401' } }],
    },
    {
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: 'track/12345' }],
    },
  ],
});
// #endregion
