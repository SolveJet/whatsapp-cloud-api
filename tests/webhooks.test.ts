import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  WebhookHandler,
  WhatsAppWebhookError,
  extractMessages,
  extractStatuses,
  isMessageEvent,
  isStatusEvent,
  parseWebhook,
  verifySignature,
  verifyWebhook,
  verifyWebhookQuery,
} from '../src/index.js';
import type {
  IncomingMessage,
  MessageStatus,
  UnknownIncomingMessage,
  WebhookPayload,
} from '../src/index.js';

const VERIFY_TOKEN = 'my-verify-token';
const APP_SECRET = 'my-app-secret';

/** Builds a valid `X-Hub-Signature-256` header for a raw body + secret. */
const sign = (rawBody: string, secret: string): string =>
  `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;

/** Wraps a change `value` into a complete webhook envelope. */
const envelope = (value: Record<string, unknown>): WebhookPayload =>
  ({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '123456',
        changes: [{ value, field: 'messages' }],
      },
    ],
  }) as unknown as WebhookPayload;

const metadata = { display_phone_number: '15551234567', phone_number_id: '99887766' };

describe('verifyWebhook', () => {
  it('returns 200 + challenge when mode is subscribe and token matches', () => {
    const result = verifyWebhook(
      { mode: 'subscribe', token: VERIFY_TOKEN, challenge: 'echo-me' },
      VERIFY_TOKEN,
    );
    expect(result).toEqual({ statusCode: 200, body: 'echo-me' });
  });

  it('returns 403 Forbidden when the token is wrong', () => {
    const result = verifyWebhook(
      { mode: 'subscribe', token: 'wrong-token', challenge: 'echo-me' },
      VERIFY_TOKEN,
    );
    expect(result).toEqual({ statusCode: 403, body: 'Forbidden' });
  });

  it('returns 403 Forbidden when params are missing (no throw)', () => {
    expect(() => verifyWebhook({}, VERIFY_TOKEN)).not.toThrow();
    expect(verifyWebhook({}, VERIFY_TOKEN)).toEqual({ statusCode: 403, body: 'Forbidden' });
  });

  it('returns 403 when mode is not subscribe even if token matches', () => {
    expect(verifyWebhook({ mode: 'unsubscribe', token: VERIFY_TOKEN }, VERIFY_TOKEN)).toEqual({
      statusCode: 403,
      body: 'Forbidden',
    });
  });

  it('does not throw on a different-length token (constant-time path)', () => {
    expect(() =>
      verifyWebhook({ mode: 'subscribe', token: 'x', challenge: 'c' }, VERIFY_TOKEN),
    ).not.toThrow();
  });

  it('verifyWebhookQuery reads hub.* keys and matches verifyWebhook', () => {
    expect(
      verifyWebhookQuery(
        {
          'hub.mode': 'subscribe',
          'hub.verify_token': VERIFY_TOKEN,
          'hub.challenge': 'raw-challenge',
        },
        VERIFY_TOKEN,
      ),
    ).toEqual({ statusCode: 200, body: 'raw-challenge' });

    expect(
      verifyWebhookQuery(
        { 'hub.mode': 'subscribe', 'hub.verify_token': 'nope', 'hub.challenge': 'c' },
        VERIFY_TOKEN,
      ),
    ).toEqual({ statusCode: 403, body: 'Forbidden' });
  });
});

describe('verifySignature', () => {
  const rawBody = JSON.stringify(envelope({ messaging_product: 'whatsapp', metadata }));

  it('returns true for a real HMAC-SHA256 signature over the raw body', () => {
    expect(verifySignature(rawBody, sign(rawBody, APP_SECRET), APP_SECRET)).toBe(true);
  });

  it('works over a Buffer body too', () => {
    const buf = Buffer.from(rawBody, 'utf8');
    const header = `sha256=${createHmac('sha256', APP_SECRET).update(buf).digest('hex')}`;
    expect(verifySignature(buf, header, APP_SECRET)).toBe(true);
  });

  it('returns false when the body is tampered', () => {
    const header = sign(rawBody, APP_SECRET);
    expect(verifySignature(`${rawBody} `, header, APP_SECRET)).toBe(false);
  });

  it('returns false when the secret is wrong', () => {
    expect(verifySignature(rawBody, sign(rawBody, APP_SECRET), 'other-secret')).toBe(false);
  });

  it('returns false (no throw) when the header is missing', () => {
    expect(() => verifySignature(rawBody, undefined, APP_SECRET)).not.toThrow();
    expect(verifySignature(rawBody, undefined, APP_SECRET)).toBe(false);
  });

  it('returns false (no throw) for a malformed header without the sha256= prefix', () => {
    const hex = createHmac('sha256', APP_SECRET).update(rawBody).digest('hex');
    expect(verifySignature(rawBody, hex, APP_SECRET)).toBe(false);
  });

  it('returns false (no throw) for a different-length signature', () => {
    expect(() => verifySignature(rawBody, 'sha256=abc', APP_SECRET)).not.toThrow();
    expect(verifySignature(rawBody, 'sha256=abc', APP_SECRET)).toBe(false);
  });
});

describe('parseWebhook + extractMessages', () => {
  const makeMessage = (extra: Record<string, unknown>): WebhookPayload =>
    envelope({
      messaging_product: 'whatsapp',
      metadata,
      contacts: [{ wa_id: '15550001111', profile: { name: 'Alice' } }],
      messages: [{ from: '15550001111', id: 'wamid.1', timestamp: '1700000000', ...extra }],
    });

  it('parses from a JSON string', () => {
    const payload = parseWebhook(
      JSON.stringify(makeMessage({ type: 'text', text: { body: 'hi' } })),
    );
    expect(payload.object).toBe('whatsapp_business_account');
  });

  it('narrows a text message and extracts the body', () => {
    const [msg] = extractMessages(makeMessage({ type: 'text', text: { body: 'hello' } }));
    expect(msg?.type).toBe('text');
    if (msg?.type === 'text') {
      expect(msg.text.body).toBe('hello');
    } else {
      expect.unreachable();
    }
  });

  it('narrows an image message and extracts media fields', () => {
    const [msg] = extractMessages(
      makeMessage({
        type: 'image',
        image: { id: 'media-1', mime_type: 'image/jpeg', caption: 'cap' },
      }),
    );
    if (msg?.type === 'image') {
      expect(msg.image.id).toBe('media-1');
      expect(msg.image.caption).toBe('cap');
    } else {
      expect.unreachable();
    }
  });

  it('narrows an interactive button_reply', () => {
    const [msg] = extractMessages(
      makeMessage({
        type: 'interactive',
        interactive: { type: 'button_reply', button_reply: { id: 'btn-1', title: 'Yes' } },
      }),
    );
    if (msg?.type === 'interactive') {
      expect(msg.interactive.type).toBe('button_reply');
      expect(msg.interactive.button_reply?.id).toBe('btn-1');
    } else {
      expect.unreachable();
    }
  });

  it('narrows an interactive list_reply', () => {
    const [msg] = extractMessages(
      makeMessage({
        type: 'interactive',
        interactive: {
          type: 'list_reply',
          list_reply: { id: 'row-1', title: 'Option', description: 'desc' },
        },
      }),
    );
    if (msg?.type === 'interactive') {
      expect(msg.interactive.list_reply?.description).toBe('desc');
    } else {
      expect.unreachable();
    }
  });

  it('narrows an interactive nfm_reply (address submission) and exposes the raw response_json', () => {
    const responseJson = JSON.stringify({ name: 'Ada', city: 'Bengaluru' });
    const [msg] = extractMessages(
      makeMessage({
        type: 'interactive',
        interactive: {
          type: 'nfm_reply',
          nfm_reply: {
            name: 'address_message',
            response_json: responseJson,
            body: 'Address submitted',
          },
        },
      }),
    );
    if (msg?.type === 'interactive') {
      expect(msg.interactive.type).toBe('nfm_reply');
      expect(msg.interactive.nfm_reply?.name).toBe('address_message');
      expect(msg.interactive.nfm_reply?.body).toBe('Address submitted');
      // response_json is surfaced as a raw string; callers parse it themselves.
      expect(msg.interactive.nfm_reply?.response_json).toBe(responseJson);
      expect(JSON.parse(msg.interactive.nfm_reply?.response_json ?? '{}')).toEqual({
        name: 'Ada',
        city: 'Bengaluru',
      });
    } else {
      expect.unreachable();
    }
  });

  it('narrows a template quick-reply button message', () => {
    const [msg] = extractMessages(
      makeMessage({ type: 'button', button: { text: 'Stop', payload: 'STOP' } }),
    );
    if (msg?.type === 'button') {
      expect(msg.button.payload).toBe('STOP');
    } else {
      expect.unreachable();
    }
  });

  it('narrows a reaction message', () => {
    const [msg] = extractMessages(
      makeMessage({ type: 'reaction', reaction: { message_id: 'wamid.0', emoji: '👍' } }),
    );
    if (msg?.type === 'reaction') {
      expect(msg.reaction.message_id).toBe('wamid.0');
      expect(msg.reaction.emoji).toBe('👍');
    } else {
      expect.unreachable();
    }
  });

  it('narrows a location message', () => {
    const [msg] = extractMessages(
      makeMessage({
        type: 'location',
        location: { latitude: 12.34, longitude: 56.78, name: 'HQ', address: '1 Main St' },
      }),
    );
    if (msg?.type === 'location') {
      expect(msg.location.latitude).toBe(12.34);
      expect(msg.location.name).toBe('HQ');
    } else {
      expect.unreachable();
    }
  });

  it('parses an unknown message type via the fallback without throwing', () => {
    const payload = makeMessage({ type: 'order', order: { catalog_id: 'cat-1' } });
    expect(() => parseWebhook(payload)).not.toThrow();
    const messages: IncomingMessage[] = extractMessages(payload);
    // Unknown types fall outside the known union; a consumer handles them in a
    // `default` branch, treating the value as an UnknownIncomingMessage.
    const [msg] = messages;
    expect(msg?.type).toBe('order');
    const unknown = msg as unknown as UnknownIncomingMessage;
    expect((unknown['order'] as { catalog_id: string }).catalog_id).toBe('cat-1');
  });

  it('isMessageEvent / isStatusEvent discriminate correctly', () => {
    const msgValue = { messaging_product: 'whatsapp' as const, metadata, messages: [] };
    const statusValue = { messaging_product: 'whatsapp' as const, metadata, statuses: [] };
    expect(isMessageEvent(msgValue)).toBe(true);
    expect(isStatusEvent(msgValue)).toBe(false);
    expect(isStatusEvent(statusValue)).toBe(true);
    expect(isMessageEvent(statusValue)).toBe(false);
  });
});

describe('extractStatuses', () => {
  it('extracts delivered and failed-with-errors statuses', () => {
    const payload = envelope({
      messaging_product: 'whatsapp',
      metadata,
      statuses: [
        {
          id: 'wamid.a',
          status: 'delivered',
          timestamp: '1700000001',
          recipient_id: '15550001111',
        },
        {
          id: 'wamid.b',
          status: 'failed',
          timestamp: '1700000002',
          recipient_id: '15550001111',
          errors: [
            {
              code: 131026,
              title: 'Message undeliverable',
              message: 'Message failed to send',
              error_data: { details: 'Recipient has not accepted the terms' },
            },
          ],
        },
      ],
    });
    const statuses: MessageStatus[] = extractStatuses(payload);
    expect(statuses).toHaveLength(2);
    expect(statuses[0]?.status).toBe('delivered');
    expect(statuses[1]?.status).toBe('failed');
    expect(statuses[1]?.errors?.[0]?.error_data?.details).toBe(
      'Recipient has not accepted the terms',
    );
  });
});

describe('malformed and empty payloads', () => {
  it('throws WhatsAppWebhookError on a non-object body', () => {
    expect(() => parseWebhook(42)).toThrow(WhatsAppWebhookError);
  });

  it('throws WhatsAppWebhookError on a wrong object value', () => {
    expect(() => parseWebhook({ object: 'page', entry: [] })).toThrow(WhatsAppWebhookError);
  });

  it('throws WhatsAppWebhookError when entry is not an array', () => {
    expect(() => parseWebhook({ object: 'whatsapp_business_account', entry: {} })).toThrow(
      WhatsAppWebhookError,
    );
  });

  it('throws WhatsAppWebhookError on an unparseable JSON string', () => {
    expect(() => parseWebhook('{not json')).toThrow(WhatsAppWebhookError);
  });

  it('yields empty arrays when a value has neither messages nor statuses', () => {
    const payload = envelope({ messaging_product: 'whatsapp', metadata });
    expect(extractMessages(payload)).toEqual([]);
    expect(extractStatuses(payload)).toEqual([]);
  });
});

describe('WebhookHandler', () => {
  const payload = envelope({
    messaging_product: 'whatsapp',
    metadata,
    messages: [
      {
        from: '15550001111',
        id: 'wamid.1',
        timestamp: '1700000000',
        type: 'text',
        text: { body: 'hi' },
      },
    ],
  });
  const rawBody = JSON.stringify(payload);

  it('handleVerification delegates to the configured verify token', () => {
    const handler = new WebhookHandler({ verifyToken: VERIFY_TOKEN });
    expect(
      handler.handleVerification({
        'hub.mode': 'subscribe',
        'hub.verify_token': VERIFY_TOKEN,
        'hub.challenge': 'c1',
      }),
    ).toEqual({ statusCode: 200, body: 'c1' });
  });

  it('handleVerification throws when no verify token was configured', () => {
    const handler = new WebhookHandler();
    expect(() => handler.handleVerification({ 'hub.mode': 'subscribe' })).toThrow(
      WhatsAppWebhookError,
    );
  });

  it('parse enforces the signature when appSecret is configured', () => {
    const handler = new WebhookHandler({ appSecret: APP_SECRET });
    expect(() => handler.parse(rawBody, 'sha256=deadbeef')).toThrow(WhatsAppWebhookError);
    expect(() => handler.parse(rawBody, undefined)).toThrow(WhatsAppWebhookError);
  });

  it('parse returns messages/statuses/raw on a valid signature', () => {
    const handler = new WebhookHandler({ appSecret: APP_SECRET });
    const result = handler.parse(rawBody, sign(rawBody, APP_SECRET));
    expect(result.messages).toHaveLength(1);
    expect(result.statuses).toEqual([]);
    expect(result.raw.object).toBe('whatsapp_business_account');
  });

  it('parse skips signature enforcement when no appSecret is configured', () => {
    const handler = new WebhookHandler();
    const result = handler.parse(rawBody);
    expect(result.messages[0]?.type).toBe('text');
  });

  it('isValid returns false without an appSecret, true with a valid signature', () => {
    expect(new WebhookHandler().isValid(rawBody, sign(rawBody, APP_SECRET))).toBe(false);
    expect(
      new WebhookHandler({ appSecret: APP_SECRET }).isValid(rawBody, sign(rawBody, APP_SECRET)),
    ).toBe(true);
  });
});
