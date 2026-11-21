import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { verifySignatureAsync } from '../src/resources/webhook-verify-web.js';
import { verifySignature } from '../src/resources/webhooks.js';

const sign = (body: string | Uint8Array, secret: string): string =>
  `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

const body = JSON.stringify({ text: 'héllo 日本語 \u{1F600}', n: 1 });
const goodHeader = sign(body, 'secret');

interface Vector {
  name: string;
  body: string | Uint8Array | ArrayBuffer;
  header: string | undefined;
  secrets: string | string[];
}

const encoded = new TextEncoder().encode(body);
const arrayBuffer = encoded.buffer.slice(
  encoded.byteOffset,
  encoded.byteOffset + encoded.byteLength,
);

const vectors: Vector[] = [
  { name: 'valid string', body, header: goodHeader, secrets: 'secret' },
  { name: 'valid Uint8Array', body: encoded, header: goodHeader, secrets: 'secret' },
  { name: 'valid ArrayBuffer', body: arrayBuffer, header: goodHeader, secrets: 'secret' },
  { name: 'uppercase hex', body, header: goodHeader.toUpperCase(), secrets: 'secret' },
  {
    name: 'uppercase digits only',
    body,
    header: `sha256=${goodHeader.slice(7).toUpperCase()}`,
    secrets: 'secret',
  },
  { name: 'wrong prefix', body, header: goodHeader.replace('sha256=', 'sha1='), secrets: 'secret' },
  { name: 'truncated', body, header: goodHeader.slice(0, -2), secrets: 'secret' },
  { name: 'too long', body, header: `${goodHeader}00`, secrets: 'secret' },
  { name: 'non-hex', body, header: `sha256=${'z'.repeat(64)}`, secrets: 'secret' },
  { name: 'missing header', body, header: undefined, secrets: 'secret' },
  { name: 'wrong secret', body, header: goodHeader, secrets: 'other' },
  { name: 'tampered body', body: `${body} `, header: goodHeader, secrets: 'secret' },
  { name: 'rotation, old secret', body, header: goodHeader, secrets: ['new', 'secret'] },
  { name: 'rotation, none match', body, header: goodHeader, secrets: ['a', 'b'] },
  { name: 'empty secret', body, header: sign(body, ''), secrets: '' },
  { name: 'empty list', body, header: goodHeader, secrets: [] },
  { name: 'empty element', body, header: sign(body, ''), secrets: [''] },
];

describe('verifySignatureAsync', () => {
  it.each(vectors)('matches the Node verifier: $name', async (vector) => {
    const expected = verifySignature(vector.body, vector.header, vector.secrets);
    expect(await verifySignatureAsync(vector.body, vector.header, vector.secrets)).toBe(expected);
  });

  it('accepts the valid vectors', async () => {
    expect(await verifySignatureAsync(body, goodHeader, 'secret')).toBe(true);
    expect(await verifySignatureAsync(encoded, goodHeader, ['x', 'secret'])).toBe(true);
  });

  it('returns false for unsupported body types without throwing', async () => {
    await expect(verifySignatureAsync(42 as never, goodHeader, 'secret')).resolves.toBe(false);
    await expect(verifySignatureAsync({} as never, goodHeader, 'secret')).resolves.toBe(false);
  });

  it('keeps working past the key cache bound', async () => {
    for (let index = 0; index < 40; index += 1) {
      const secret = `secret-${index}`;
      expect(await verifySignatureAsync(body, sign(body, secret), secret)).toBe(true);
    }
    expect(await verifySignatureAsync(body, goodHeader, 'secret')).toBe(true);
  });
  it('returns false when the key cannot be imported and retries on the next call', async () => {
    const spy = vi
      .spyOn(globalThis.crypto.subtle, 'importKey')
      .mockRejectedValueOnce(new Error('import failed'));
    try {
      expect(await verifySignatureAsync(body, sign(body, 'retry-me'), 'retry-me')).toBe(false);
      expect(await verifySignatureAsync(body, sign(body, 'retry-me'), 'retry-me')).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});
