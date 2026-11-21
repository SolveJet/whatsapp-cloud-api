import { WhatsAppClient } from '@solvejet/whatsapp-cloud-api';

const client = new WhatsAppClient({
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
});

// #region send
await client.messages.sendInteractiveList('15551234567', {
  header: 'Choose shipping option',
  body: 'Which shipping option do you prefer?',
  footer: 'Lucky Shrub',
  button: 'Shipping options', // label of the button that opens the list
  sections: [
    {
      title: 'I want it ASAP',
      rows: [
        {
          id: 'priority_express',
          title: 'Priority Mail Express',
          description: 'Next day to 2 days',
        },
        { id: 'priority_mail', title: 'Priority Mail', description: '1 to 3 days' },
      ],
    },
    {
      title: 'I can wait a bit',
      rows: [{ id: 'media_mail', title: 'Media Mail', description: '2 to 8 days' }],
    },
  ],
});
// #endregion
