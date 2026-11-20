import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  WebhookHandler,
  WhatsAppWebhookError,
  extractMessages,
  extractStatuses,
  parseWebhook,
} from '../src/index.js';
import type { WebhookPayload } from '../src/index.js';

const MIB = 1024 * 1024;

const messagesPayload = (value: Record<string, unknown>): WebhookPayload =>
  ({
    object: 'whatsapp_business_account',
    entry: [{ id: '1', changes: [{ field: 'messages', value }] }],
  }) as unknown as WebhookPayload;

const rawEnvelope = (entry: unknown): WebhookPayload =>
  ({ object: 'whatsapp_business_account', entry }) as unknown as WebhookPayload;

describe('extractors on large arrays', () => {
  it('returns every element of a 200,000-element messages array', () => {
    const messages = Array.from({ length: 200_000 }, () => ({}));
    expect(extractMessages(messagesPayload({ messages }))).toHaveLength(200_000);
  });

  it('returns every element of a 200,000-element statuses array', () => {
    const statuses = Array.from({ length: 200_000 }, () => ({}));
    expect(extractStatuses(messagesPayload({ statuses }))).toHaveLength(200_000);
  });
});

describe('extractors on malformed shapes', () => {
  it('skips non-object elements of messages and statuses', () => {
    const payload = messagesPayload({
      messages: [null, 1, 'x', {}, [], true],
      statuses: [undefined, 'sent', { id: 'a' }, 7],
    });
    expect(extractMessages(payload)).toEqual([{}]);
    expect(extractStatuses(payload)).toEqual([{ id: 'a' }]);
  });

  it.each([[{ length: 1 }], ['abc'], [42], [null], [{ 0: {} }]])(
    'treats non-array changes as a no-op (%j)',
    (changes) => {
      const payload = rawEnvelope([{ id: '1', changes }]);
      expect(() => extractMessages(payload)).not.toThrow();
      expect(extractMessages(payload)).toEqual([]);
      expect(extractStatuses(payload)).toEqual([]);
    },
  );

  it('treats non-object entry items as a no-op', () => {
    const payload = rawEnvelope([null, 7, 'x', [], { id: '1' }]);
    expect(extractMessages(payload)).toEqual([]);
    expect(extractStatuses(payload)).toEqual([]);
  });

  it('treats a non-object change and non-object value as a no-op', () => {
    const payload = rawEnvelope([{ id: '1', changes: [null, 1, { value: 'x' }, { value: null }] }]);
    expect(extractMessages(payload)).toEqual([]);
  });

  it('WebhookHandler.parse does not throw a bare TypeError on non-iterable changes', () => {
    const body = JSON.stringify(rawEnvelope([{ id: '1', changes: { length: 1 } }]));
    const result = new WebhookHandler().parse(body);
    expect(result.messages).toEqual([]);
    expect(result.statuses).toEqual([]);
  });

  it('treats a hand-built payload whose entry is not an array as empty', () => {
    const payload = { object: 'whatsapp_business_account', entry: 'x' } as never;
    expect(extractMessages(payload)).toEqual([]);
    expect(extractStatuses(payload)).toEqual([]);
  });

  it('throws WhatsAppWebhookError for an unsupported body type when no secret is set', () => {
    expect(() => new WebhookHandler().parse(null as never)).toThrow(
      /string, Uint8Array or ArrayBuffer/,
    );
  });

  it('ignores a messages value that is not an array', () => {
    expect(extractMessages(messagesPayload({ messages: 'abc' }))).toEqual([]);
    expect(extractMessages(messagesPayload({ messages: { length: 3 } }))).toEqual([]);
  });
});

describe('prototype pollution', () => {
  it('does not pollute Object.prototype when parsing __proto__ keys', () => {
    const body =
      '{"object":"whatsapp_business_account","entry":[],"__proto__":{"polluted":"yes"},' +
      '"constructor":{"prototype":{"polluted2":"yes"}}}';
    const payload = parseWebhook(body);
    extractMessages(payload);
    extractStatuses(payload);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(({} as Record<string, unknown>)['polluted2']).toBeUndefined();
    expect(Object.getPrototypeOf(payload)).toBe(Object.prototype);
  });

  it('does not pollute through message objects either', () => {
    const body = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{ id: '1', changes: [{ field: 'messages', value: { messages: [{}] } }] }],
    }).replace('{}]', '{"__proto__":{"polluted3":"yes"}}]');
    const result = new WebhookHandler().parse(body);
    expect(result.messages).toHaveLength(1);
    expect(({} as Record<string, unknown>)['polluted3']).toBeUndefined();
  });
});

describe('JSON errors do not leak the payload', () => {
  const secretText = 'SECRETPAYLOADFRAGMENT';
  const broken = `{"object":"whatsapp_business_account","entry":${secretText}`;

  it('does not attach the SyntaxError as cause', () => {
    try {
      parseWebhook(broken);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(WhatsAppWebhookError);
      const webhookError = error as WhatsAppWebhookError;
      expect(webhookError.message).not.toContain(secretText);
      expect(webhookError.cause).toBeUndefined();
      expect(JSON.stringify(webhookError, Object.getOwnPropertyNames(webhookError))).not.toContain(
        secretText,
      );
    }
  });

  it('does not leak through WebhookHandler.parse either', () => {
    try {
      new WebhookHandler().parse(Buffer.from(broken));
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain(secretText);
      expect((error as Error).cause).toBeUndefined();
    }
  });
});

describe('maximum body size', () => {
  const filler = (bytes: number): string => {
    const head = '{"object":"whatsapp_business_account","entry":[]}';
    return head + ' '.repeat(bytes - head.length);
  };

  it('accepts a body of exactly 3 MiB by default', () => {
    const body = filler(3 * MIB);
    expect(new WebhookHandler().parse(body).messages).toEqual([]);
    expect(parseWebhook(body).object).toBe('whatsapp_business_account');
  });

  it('rejects a body over 3 MiB before parsing it', () => {
    const body = filler(3 * MIB + 1);
    expect(() => new WebhookHandler().parse(body)).toThrow(/exceeds the maximum/);
    expect(() => parseWebhook(body)).toThrow(WhatsAppWebhookError);
    expect(() => new WebhookHandler().parse(Buffer.from(body))).toThrow(/exceeds the maximum/);
    expect(() => new WebhookHandler().parse(new TextEncoder().encode(body))).toThrow(
      /exceeds the maximum/,
    );
  });

  it('reports the size error, not a JSON error, for an oversized non-JSON body', () => {
    expect(() => parseWebhook('x'.repeat(3 * MIB + 1))).toThrow(/exceeds the maximum/);
  });

  it('counts bytes, not characters', () => {
    const body = `${'é'.repeat(MIB + 1)}`; // 2 bytes each, over 2 MiB
    const handler = new WebhookHandler({ maxBodyBytes: 2 * MIB });
    expect(() => handler.parse(body)).toThrow(/exceeds the maximum/);
  });

  it('checks the size before the signature', () => {
    const handler = new WebhookHandler({ appSecret: 's', maxBodyBytes: 10 });
    expect(() => handler.parse(filler(100), 'sha256=00')).toThrow(/exceeds the maximum/);
  });

  it('accepts a signed body under a custom limit', () => {
    const body = filler(100);
    const header = `sha256=${createHmac('sha256', 's').update(body).digest('hex')}`;
    const handler = new WebhookHandler({ appSecret: 's', maxBodyBytes: 100 });
    expect(handler.parse(body, header).raw.object).toBe('whatsapp_business_account');
    expect(() =>
      new WebhookHandler({ appSecret: 's', maxBodyBytes: 99 }).parse(body, header),
    ).toThrow(/exceeds the maximum/);
  });

  it('can be raised or disabled', () => {
    const body = filler(3 * MIB + 1);
    expect(new WebhookHandler({ maxBodyBytes: 4 * MIB }).parse(body).raw.entry).toEqual([]);
    expect(new WebhookHandler({ maxBodyBytes: false }).parse(body).raw.entry).toEqual([]);
    expect(parseWebhook(body, { maxBodyBytes: false }).entry).toEqual([]);
    expect(parseWebhook(body, { maxBodyBytes: 4 * MIB }).entry).toEqual([]);
    expect(() => parseWebhook(filler(200), { maxBodyBytes: 100 })).toThrow(WhatsAppWebhookError);
  });

  it('does not apply to an already parsed object', () => {
    expect(parseWebhook(rawEnvelope([]), { maxBodyBytes: 1 }).entry).toEqual([]);
  });

  it.each([[0], [-1], [Number.NaN], [1.5], ['10'], [null]])(
    'rejects an invalid maxBodyBytes (%j)',
    (maxBodyBytes) => {
      expect(() => new WebhookHandler({ maxBodyBytes } as never)).toThrow(WhatsAppWebhookError);
      expect(() => parseWebhook('{}', { maxBodyBytes } as never)).toThrow(WhatsAppWebhookError);
    },
  );
});
