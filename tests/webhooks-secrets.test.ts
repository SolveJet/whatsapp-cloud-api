import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  WebhookHandler,
  WhatsAppWebhookError,
  verifySignature,
  verifyWebhook,
  verifyWebhookQuery,
} from '../src/index.js';
import type { WebhookHandlerConfig } from '../src/index.js';

const rawBody = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });

const sign = (body: string, secret: string): string =>
  `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

describe('verifySignature with a bad secret', () => {
  it('returns false for an empty secret even when the signature uses an empty HMAC key', () => {
    expect(verifySignature(rawBody, sign(rawBody, ''), '')).toBe(false);
  });

  it.each([[undefined], [null], [42], [{}], [Buffer.from('secret')]])(
    'returns false without throwing for a non-string secret (%#)',
    (secret) => {
      const header = sign(rawBody, 'secret');
      expect(() => verifySignature(rawBody, header, secret as never)).not.toThrow();
      expect(verifySignature(rawBody, header, secret as never)).toBe(false);
    },
  );
});

describe('verifySignature with an array of secrets', () => {
  it('accepts a signature made with either secret', () => {
    const secrets = ['old-secret', 'new-secret'];
    expect(verifySignature(rawBody, sign(rawBody, 'old-secret'), secrets)).toBe(true);
    expect(verifySignature(rawBody, sign(rawBody, 'new-secret'), secrets)).toBe(true);
  });
  it('rejects a signature made with a secret that is not in the array', () => {
    expect(verifySignature(rawBody, sign(rawBody, 'other'), ['old-secret', 'new-secret'])).toBe(
      false,
    );
  });
  it('fails closed for an empty array', () => {
    expect(verifySignature(rawBody, sign(rawBody, 'secret'), [])).toBe(false);
  });
  it('fails closed when the only entries are empty strings', () => {
    expect(verifySignature(rawBody, sign(rawBody, ''), [''])).toBe(false);
    expect(verifySignature(rawBody, sign(rawBody, ''), ['', ''])).toBe(false);
  });
  it('ignores an empty or non-string entry but still accepts a valid secret', () => {
    const header = sign(rawBody, 'secret');
    expect(verifySignature(rawBody, header, ['', 'secret'])).toBe(true);
    expect(verifySignature(rawBody, header, [42, 'secret'] as never)).toBe(true);
    expect(verifySignature(rawBody, sign(rawBody, ''), ['', 'secret'])).toBe(false);
  });
});
describe('WebhookHandler with an array of app secrets', () => {
  it('validates a delivery signed with either secret', () => {
    const handler = new WebhookHandler({ appSecret: ['old-secret', 'new-secret'] });
    expect(handler.isValid(rawBody, sign(rawBody, 'old-secret'))).toBe(true);
    expect(handler.isValid(rawBody, sign(rawBody, 'new-secret'))).toBe(true);
    expect(handler.isValid(rawBody, sign(rawBody, 'other'))).toBe(false);
  });
  it('throws for an empty array or an array containing an empty string', () => {
    expect(() => new WebhookHandler({ appSecret: [] })).toThrow(WhatsAppWebhookError);
    expect(() => new WebhookHandler({ appSecret: ['ok', ''] })).toThrow(WhatsAppWebhookError);
  });
});
describe('verify token handshake with a bad expected token', () => {
  const forbidden = { statusCode: 403, body: 'Forbidden' };

  it('verifyWebhook returns 403 when the expected token is empty, even if the token is empty', () => {
    expect(verifyWebhook({ mode: 'subscribe', token: '', challenge: 'c' }, '')).toEqual(forbidden);
  });

  it.each([[undefined], [null], [42], [{}]])(
    'verifyWebhook returns 403 for a non-string expected token (%#)',
    (expected) => {
      expect(
        verifyWebhook({ mode: 'subscribe', token: 'x', challenge: 'c' }, expected as never),
      ).toEqual(forbidden);
    },
  );

  it('verifyWebhookQuery returns 403 when the expected token is empty or missing', () => {
    const query = { 'hub.mode': 'subscribe', 'hub.verify_token': '', 'hub.challenge': 'c' };
    expect(verifyWebhookQuery(query, '')).toEqual(forbidden);
    expect(verifyWebhookQuery(query, undefined as never)).toEqual(forbidden);
  });
});

describe('WebhookHandler constructor', () => {
  it.each([
    ['appSecret', undefined],
    ['appSecret', ''],
    ['verifyToken', undefined],
    ['verifyToken', ''],
  ])('throws WhatsAppWebhookError when %s is present but %o', (key, value) => {
    const config = { [key]: value } as WebhookHandlerConfig;
    expect(() => new WebhookHandler(config)).toThrow(WhatsAppWebhookError);
    expect(() => new WebhookHandler(config)).toThrow(new RegExp(key));
  });

  it('throws when a secret is present but not a string', () => {
    expect(() => new WebhookHandler({ appSecret: null } as never)).toThrow(WhatsAppWebhookError);
  });

  it('still accepts a config with the keys omitted (no signature enforcement)', () => {
    const handler = new WebhookHandler({});
    expect(handler.parse(rawBody).messages).toEqual([]);
    expect(() => new WebhookHandler()).not.toThrow();
  });

  it('still enforces the signature when appSecret is a real string', () => {
    const handler = new WebhookHandler({ appSecret: 's', verifyToken: 't' });
    expect(handler.isValid(rawBody, sign(rawBody, 's'))).toBe(true);
    expect(handler.isValid(rawBody, sign(rawBody, ''))).toBe(false);
  });
});
