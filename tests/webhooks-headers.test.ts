import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifySignature, verifyWebhook, verifyWebhookQuery } from '../src/index.js';

const SECRET = 'my-app-secret';
const body = '{"object":"whatsapp_business_account","entry":[]}';
const hex = createHmac('sha256', SECRET).update(body).digest('hex');

describe('verifySignature header handling', () => {
  it('accepts the exact lowercase header', () => {
    expect(verifySignature(body, `sha256=${hex}`, SECRET)).toBe(true);
  });

  it.each([
    ['uppercase hex', `sha256=${hex.toUpperCase()}`],
    ['uppercase prefix', `SHA256=${hex}`],
    ['leading space', ` sha256=${hex}`],
    ['trailing space', `sha256=${hex} `],
    ['trailing newline', `sha256=${hex}\n`],
    ['duplicated header joined by a comma', `sha256=${hex}, sha256=${hex}`],
    ['duplicated without separator', `sha256=${hex}sha256=${hex}`],
    ['sha1 prefix', `sha1=${hex}`],
    ['empty prefix only', 'sha256='],
    ['empty string', ''],
    ['multi-byte string of equal length', `sha256=${'é'.repeat(hex.length / 2)}`],
  ])('rejects %s', (_name, header) => {
    expect(() => verifySignature(body, header, SECRET)).not.toThrow();
    expect(verifySignature(body, header, SECRET)).toBe(false);
  });

  it.each([[['sha256=abc']], [null], [42], [{}]])(
    'rejects a non-string header (%j) without throwing',
    (header) => {
      expect(verifySignature(body, header as never, SECRET)).toBe(false);
    },
  );
});

describe('verify token query handling', () => {
  const token = 'my-verify-token';
  const forbidden = { statusCode: 403, body: 'Forbidden' };

  it('returns 403 for an array token (duplicated query parameter)', () => {
    expect(
      verifyWebhookQuery(
        {
          'hub.mode': 'subscribe',
          'hub.verify_token': [token, token] as never,
          'hub.challenge': 'c',
        },
        token,
      ),
    ).toEqual(forbidden);
  });

  it('returns 403 for a nested hub object instead of flat keys', () => {
    const query = { hub: { mode: 'subscribe', verify_token: token, challenge: 'c' } };
    expect(verifyWebhookQuery(query as never, token)).toEqual(forbidden);
  });

  it('returns 403 for a non-string mode', () => {
    expect(verifyWebhook({ mode: ['subscribe'] as never, token, challenge: 'c' }, token)).toEqual(
      forbidden,
    );
  });
});
