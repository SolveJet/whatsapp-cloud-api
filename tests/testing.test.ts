import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { WhatsAppWebhookError } from '../src/errors.js';
import { createWebhookHandler } from '../src/resources/webhook-handler.js';
import { verifySignature } from '../src/resources/webhooks.js';
import { buildWebhookPayload, createTestRequest, signWebhookBody } from '../src/testing.js';
import { parseWebhookEvents } from '../src/resources/webhook-events.js';

describe('signWebhookBody', () => {
  it('matches node:crypto and verifySignature for strings and bytes', async () => {
    const body = '{"a":"é"}';
    const expected = `sha256=${createHmac('sha256', 's').update(body).digest('hex')}`;
    expect(await signWebhookBody(body, 's')).toBe(expected);
    expect(await signWebhookBody(new TextEncoder().encode(body), 's')).toBe(expected);
    expect(verifySignature(body, expected, 's')).toBe(true);
  });
});

describe('buildWebhookPayload', () => {
  it.each([
    ['text', 'message'],
    ['status', 'status'],
    ['call', 'call'],
    ['template_status', 'template'],
    ['flow', 'flow'],
    ['account_update', 'account'],
    ['group', 'group'],
  ] as const)('builds a %s payload that parses as a %s event', (kind, name) => {
    const events = parseWebhookEvents(buildWebhookPayload(kind));
    expect(events.map((event) => event.name)).toEqual([name]);
    if (name !== 'message' && name !== 'status') {
      const event = events[0];
      expect(event !== undefined && 'event' in event && event.event.kind).not.toBe('unknown');
    }
  });

  it('merges plain-object overrides and replaces arrays', () => {
    const payload = buildWebhookPayload('text', { entry: [{ id: 'other', changes: [] }] });
    expect(payload.entry).toEqual([{ id: 'other', changes: [] }]);
    const merged = buildWebhookPayload('status', { object: 'whatsapp_business_account' });
    expect(merged.object).toBe('whatsapp_business_account');
  });

  it('does not share state between calls', () => {
    const first = buildWebhookPayload('text');
    (first.entry as unknown as { id: string }[])[0]!.id = 'changed';
    expect((buildWebhookPayload('text').entry as unknown as { id: string }[])[0]?.id).not.toBe(
      'changed',
    );
  });

  it('rejects prototype-polluting override keys', () => {
    const polluted = JSON.parse('{"__proto__":{"polluted":true}}') as Record<string, unknown>;
    expect(() => buildWebhookPayload('text', polluted)).toThrow(WhatsAppWebhookError);
    expect(() => buildWebhookPayload('text', { constructor: { x: 1 } })).toThrow(
      WhatsAppWebhookError,
    );
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});

describe('createTestRequest', () => {
  it('round-trips through createWebhookHandler', async () => {
    const handler = createWebhookHandler({ appSecrets: 'sec' });
    const bodies: string[] = [];
    handler.on('message', (event) => {
      bodies.push(event.message.type === 'text' ? event.message.text.body : '');
    });
    const request = await createTestRequest({
      payload: buildWebhookPayload('text', {
        entry: [
          {
            id: '1',
            changes: [
              {
                field: 'messages',
                value: {
                  messages: [
                    { id: 'm', type: 'text', from: '1', timestamp: '1', text: { body: 'hi' } },
                  ],
                },
              },
            ],
          },
        ],
      }),
      secret: 'sec',
    });
    expect(request.method).toBe('POST');
    expect((await handler.handleRequest(request)).status).toBe(200);
    expect(bodies).toEqual(['hi']);
  });

  it('detects tampering and wrong secrets', async () => {
    const handler = createWebhookHandler({ appSecrets: 'sec' });
    const wrong = await createTestRequest({ payload: buildWebhookPayload('text'), secret: 'nope' });
    expect((await handler.handleRequest(wrong)).status).toBe(401);
    const forced = await createTestRequest({
      payload: buildWebhookPayload('text'),
      secret: 'sec',
      signature: 'sha256=bad',
    });
    expect((await handler.handleRequest(forced)).status).toBe(401);
  });

  it('sends unsigned requests without a secret, honours url and headers, and needs payload or body', async () => {
    const request = await createTestRequest({
      body: '{}',
      url: 'https://example.org/hook',
      headers: { 'x-extra': '1' },
    });
    expect(request.headers.get('x-hub-signature-256')).toBeNull();
    expect(request.headers.get('x-extra')).toBe('1');
    expect(request.url).toBe('https://example.org/hook');
    await expect(createTestRequest({})).rejects.toThrow(WhatsAppWebhookError);
    await expect(createTestRequest({ body: '{}', payload: {} })).rejects.toThrow(
      WhatsAppWebhookError,
    );
  });
});
