import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebhookHandler, WhatsAppWebhookError, verifySignature } from '../src/index.js';

const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
const sign = (payload: string, secret: string): string =>
  `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;

describe('secret arrays', () => {
  it('accepts a signature made with any listed secret', () => {
    const secrets = ['old-secret', 'new-secret'];
    expect(verifySignature(body, sign(body, 'old-secret'), secrets)).toBe(true);
    expect(verifySignature(body, sign(body, 'new-secret'), secrets)).toBe(true);
    expect(verifySignature(body, sign(body, 'other'), secrets)).toBe(false);
  });

  it('ignores empty and non-string entries and rejects an empty list', () => {
    const mixed = ['', 123 as unknown as string, 'real'];
    expect(verifySignature(body, sign(body, 'real'), mixed)).toBe(true);
    expect(verifySignature(body, sign(body, ''), [''])).toBe(false);
    expect(verifySignature(body, sign(body, 'real'), [])).toBe(false);
  });

  it('works through WebhookHandler during rotation', () => {
    const handler = new WebhookHandler({ appSecret: ['old', 'new'] });
    expect(handler.isValid(body, sign(body, 'old'))).toBe(true);
    expect(handler.isValid(body, sign(body, 'new'))).toBe(true);
    expect(handler.isValid(body, sign(body, 'nope'))).toBe(false);
    expect(handler.parse(body, sign(body, 'new')).raw.object).toBe('whatsapp_business_account');
    expect(() => handler.parse(body, sign(body, 'nope'))).toThrow(WhatsAppWebhookError);
  });

  it('throws for an empty array or an empty element', () => {
    expect(() => new WebhookHandler({ appSecret: [] })).toThrow(WhatsAppWebhookError);
    expect(() => new WebhookHandler({ appSecret: ['ok', ''] })).toThrow(WhatsAppWebhookError);
  });
});

describe('unsigned delivery warning', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  const load = async () => import('../src/resources/webhooks.js');

  it('warns once through process.emitWarning', async () => {
    const spy = vi.spyOn(process, 'emitWarning').mockImplementation(() => undefined);
    const { WebhookHandler: Handler } = await load();
    const handler = new Handler();
    handler.parse(body);
    handler.parse(body);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[1]).toEqual({ code: 'WHATSAPP_WEBHOOK_UNSIGNED' });
  });

  it('does not warn with allowUnsigned or a configured secret', async () => {
    const spy = vi.spyOn(process, 'emitWarning').mockImplementation(() => undefined);
    const { WebhookHandler: Handler } = await load();
    new Handler({ allowUnsigned: true }).parse(body);
    new Handler({ appSecret: 's' }).parse(body, sign(body, 's'));
    expect(spy).not.toHaveBeenCalled();
  });

  it('falls back to console.warn when process.emitWarning is unavailable', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const original = process.emitWarning;
    Object.defineProperty(process, 'emitWarning', { value: undefined, configurable: true });
    try {
      const { WebhookHandler: Handler } = await load();
      new Handler().parse(body);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(process, 'emitWarning', { value: original, configurable: true });
    }
  });
});
