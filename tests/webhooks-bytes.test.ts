import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  WebhookHandler,
  WhatsAppWebhookError,
  extractMessages,
  parseWebhook,
  verifySignature,
} from '../src/index.js';

const APP_SECRET = 'my-app-secret';

const envelopeJson = (body: string): string =>
  JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '1',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '1', phone_number_id: '2' },
              messages: [
                {
                  from: '15550001111',
                  id: 'wamid.1',
                  timestamp: '1700000000',
                  type: 'text',
                  text: { body },
                },
              ],
            },
          },
        ],
      },
    ],
  });

const signBytes = (bytes: Uint8Array, secret = APP_SECRET): string =>
  `sha256=${createHmac('sha256', secret).update(bytes).digest('hex')}`;

const json = envelopeJson('héllo 👋');
const bytes = new TextEncoder().encode(json);
const signature = signBytes(bytes);

/** Copies `bytes` into a standalone ArrayBuffer. */
const toArrayBuffer = (source: Uint8Array): ArrayBuffer => {
  const buffer = new ArrayBuffer(source.byteLength);
  new Uint8Array(buffer).set(source);
  return buffer;
};

describe('verifySignature body types', () => {
  it('accepts a string, Buffer, Uint8Array and ArrayBuffer', () => {
    expect(verifySignature(json, signature, APP_SECRET)).toBe(true);
    expect(verifySignature(Buffer.from(bytes), signature, APP_SECRET)).toBe(true);
    expect(verifySignature(bytes, signature, APP_SECRET)).toBe(true);
    expect(verifySignature(toArrayBuffer(bytes), signature, APP_SECRET)).toBe(true);
  });

  it('respects the offset and length of a Uint8Array view', () => {
    const padded = new Uint8Array(bytes.length + 8);
    padded.set(bytes, 4);
    expect(verifySignature(padded.subarray(4, 4 + bytes.length), signature, APP_SECRET)).toBe(true);
    expect(verifySignature(padded, signature, APP_SECRET)).toBe(false);
  });

  it.each([
    [null],
    [undefined],
    [42],
    [{}],
    [['a']],
    [new Uint16Array(2)],
    [new DataView(new ArrayBuffer(2))],
  ])('returns false instead of throwing for an unsupported body type (%#)', (body) => {
    expect(() => verifySignature(body as never, signature, APP_SECRET)).not.toThrow();
    expect(verifySignature(body as never, signature, APP_SECRET)).toBe(false);
  });

  it('verifies the original bytes when the body has a BOM or invalid UTF-8', () => {
    const withBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(json)]);
    expect(verifySignature(withBom, signBytes(withBom), APP_SECRET)).toBe(true);
    const invalid = Buffer.concat([
      Buffer.from('{"a":"'),
      Buffer.from([0xff, 0xfe]),
      Buffer.from('"}'),
    ]);
    expect(verifySignature(invalid, signBytes(invalid), APP_SECRET)).toBe(true);
  });
});

describe('WebhookHandler.parse body types', () => {
  const handler = new WebhookHandler({ appSecret: APP_SECRET });

  it.each([
    ['string', json],
    ['Buffer', Buffer.from(bytes)],
    ['Uint8Array', bytes],
    ['ArrayBuffer', toArrayBuffer(bytes)],
  ])('parses a signed %s body', (_name, body) => {
    const result = handler.parse(body, signature);
    const [message] = result.messages;
    expect(message?.type === 'text' && message.text.body).toBe('héllo 👋');
  });

  it('exposes isValid and verifyOrThrow for byte bodies', () => {
    expect(handler.isValid(bytes, signature)).toBe(true);
    expect(handler.isValid(toArrayBuffer(bytes), signature)).toBe(true);
    expect(() => handler.verifyOrThrow(bytes, signature)).not.toThrow();
    expect(() => handler.verifyOrThrow(bytes, 'sha256=00')).toThrow(WhatsAppWebhookError);
  });

  it('parses byte bodies without a secret configured', () => {
    expect(new WebhookHandler().parse(bytes).messages).toHaveLength(1);
  });

  it('rejects an unsupported body type with WhatsAppWebhookError when verifying', () => {
    expect(() => handler.parse(null as never, signature)).toThrow(WhatsAppWebhookError);
  });

  it('keeps the BOM so signed bytes are not altered, then fails as invalid JSON', () => {
    const withBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(json)]);
    const header = signBytes(withBom);
    expect(handler.isValid(withBom, header)).toBe(true);
    expect(() => handler.parse(withBom, header)).toThrow(/not valid JSON/);
    expect(() => handler.parse(new Uint8Array(withBom), header)).toThrow(/not valid JSON/);
  });

  it('decodes invalid UTF-8 inside a string as U+FFFD after verifying the raw bytes', () => {
    const [head = '', tail = ''] = envelopeJson('x@@y').split('@@');
    const invalid = Buffer.concat([Buffer.from(head), Buffer.from([0xff]), Buffer.from(tail)]);
    const header = signBytes(invalid);
    const result = handler.parse(new Uint8Array(invalid), header);
    const [message] = result.messages;
    expect(message?.type === 'text' && message.text.body).toBe('x\uFFFDy');
  });
});

describe('parseWebhook body types', () => {
  it('decodes Uint8Array, ArrayBuffer and Buffer bodies', () => {
    for (const body of [bytes, toArrayBuffer(bytes), Buffer.from(bytes)]) {
      expect(extractMessages(parseWebhook(body))).toHaveLength(1);
    }
  });
});
