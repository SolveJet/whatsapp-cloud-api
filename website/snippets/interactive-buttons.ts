import { WhatsAppClient, WhatsAppValidationError } from '@solvejet/whatsapp-cloud-api';

const client = new WhatsAppClient({
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
});

// #region send
await client.messages.sendInteractiveButtons('15551234567', {
  header: 'Workshop details', // optional, text up to 60 characters
  body: 'Your gardening workshop is tomorrow at 9am. Need to reschedule?',
  footer: 'Lucky Shrub', // optional
  buttons: [
    { id: 'change-button', title: 'Change' },
    { id: 'cancel-button', title: 'Cancel' },
  ],
});
// #endregion

// #region validation
try {
  await client.messages.sendInteractiveButtons('15551234567', {
    body: 'Pick one',
    buttons: [
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B' },
      { id: 'c', title: 'C' },
      { id: 'd', title: 'D' }, // a fourth button
    ],
  });
} catch (error) {
  if (error instanceof WhatsAppValidationError) {
    // Thrown before any request is made.
    console.error(error.message);
  }
}
// #endregion

// #region reply
// The tap arrives as an inbound webhook message of type "interactive".
declare const message: import('@solvejet/whatsapp-cloud-api').IncomingMessage;

if (message.type === 'interactive') {
  const { button_reply: button, list_reply: row } = message.interactive;
  if (button) console.log('Button tapped:', button.id, button.title);
  if (row) console.log('List row chosen:', row.id, row.title);
}
// #endregion
