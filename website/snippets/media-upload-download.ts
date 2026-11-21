import { readFile, writeFile } from 'node:fs/promises';
import { WhatsAppClient } from '@solvejet/whatsapp-cloud-api';

const client = new WhatsAppClient({
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
});

// #region upload
// Raw bytes carry no content type, so pass one. A Blob or File with a type works as is.
const bytes = await readFile('./invoice.pdf');
const { id } = await client.media.upload({
  file: bytes,
  type: 'application/pdf',
  filename: 'invoice.pdf',
});

// Send it by media ID.
await client.messages.sendDocument('15551234567', { id, filename: 'invoice.pdf' });
// #endregion

// #region download
// For a media ID taken from an inbound webhook message:
const received = await client.media.download('1037543291543636');
await writeFile('./received-file', received.data); // a Uint8Array
console.log(received.mimeType, received.sha256);
// #endregion

// #region lookup-delete
const info = await client.media.getUrl(id); // url, mimeType, sha256, fileSize
console.log(info.url, info.fileSize);

await client.media.delete(id); // { success: true }
// #endregion
