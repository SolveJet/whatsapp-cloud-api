import { client, requireEnv } from '../shared/reply.js';

// Usage: WHATSAPP_RECIPIENT=15551234567 pnpm tsx scripts/send.ts
const to = requireEnv('WHATSAPP_RECIPIENT');

// Free-form text (only delivered inside the 24-hour customer service window).
const text = await client.messages.sendText(to, 'Hello from @solvejet/whatsapp-cloud-api');
console.log('text:', text.messages[0]?.id);

// A pre-approved template (works outside the 24-hour window).
const template = await client.messages.sendTemplate(to, {
  name: 'hello_world',
  language: { code: 'en_US' },
});
console.log('template:', template.messages[0]?.id);

// An image by public link.
const image = await client.messages.sendImage(to, {
  link: 'https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png',
  caption: 'A sample image',
});
console.log('image:', image.messages[0]?.id);
