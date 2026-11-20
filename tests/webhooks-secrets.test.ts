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

  it.each([[undefined], [null], [42], [{}], [['secret']], [Buffer.from('secret')]])(
    'returns false without throwing for a non-string secret (%#)',
    (secret) => {
      const header = sign(rawBody, 'secret');
      expect(() => verifySignature(rawBody, header, secret as never)).not.toThrow();
      expect(verifySignature(rawBody, header, secret as never)).toBe(false);
    },
  );
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
