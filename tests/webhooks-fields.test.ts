import { describe, expect, it } from 'vitest';
import { extractMessages, extractStatuses, parseWebhook } from '../src/index.js';
import type { WebhookPayload } from '../src/index.js';

const metadata = { display_phone_number: '15551234567', phone_number_id: '99887766' };

const payloadFor = (change: Record<string, unknown>): WebhookPayload =>
  ({
    object: 'whatsapp_business_account',
    entry: [{ id: '1', changes: [change] }],
  }) as unknown as WebhookPayload;

const textMessage = {
  from: '15550001111',
  id: 'wamid.1',
  timestamp: '1700000000',
  type: 'text',
  text: { body: 'hi' },
};

describe('field gating', () => {
  it('does not return calls statuses as message statuses', () => {
    const payload = payloadFor({
      field: 'calls',
      value: {
        messaging_product: 'whatsapp',
        metadata,
        statuses: [
          {
            id: 'wacid.1',
            type: 'call',
            status: 'RINGING',
            timestamp: '1700000000',
            recipient_id: '15550001111',
          },
          { id: 'wacid.1', type: 'call', status: 'ACCEPTED', timestamp: '1700000001' },
          { id: 'wacid.2', type: 'call', status: 'REJECTED', timestamp: '1700000002' },
        ],
      },
    });
    expect(extractStatuses(payload)).toEqual([]);
  });

  it('ignores a stray messages array under another field', () => {
    const payload = payloadFor({
      field: 'account_update',
      value: { messaging_product: 'whatsapp', metadata, messages: [textMessage] },
    });
    expect(extractMessages(payload)).toEqual([]);
  });

  it('ignores messages and statuses under an unknown field', () => {
    const payload = payloadFor({
      field: 'totally_new_field',
      value: { messages: [textMessage], statuses: [{ id: 'x', status: 'sent' }] },
    });
    expect(extractMessages(payload)).toEqual([]);
    expect(extractStatuses(payload)).toEqual([]);
  });

  it('still reads the messages field', () => {
    const payload = payloadFor({
      field: 'messages',
      value: {
        messaging_product: 'whatsapp',
        metadata,
        messages: [textMessage],
      },
    });
    expect(extractMessages(payload)).toHaveLength(1);
  });

  it('reads changes whose field is missing or not a string (hand-built envelopes)', () => {
    const noField = payloadFor({ value: { messages: [textMessage] } });
    const numericField = payloadFor({ field: 7, value: { messages: [textMessage] } });
    expect(extractMessages(noField)).toHaveLength(1);
    expect(extractMessages(numericField)).toHaveLength(1);
  });

  it('only collects from messages changes in a mixed delivery', () => {
    const payload = parseWebhook({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '1',
          changes: [
            { field: 'messages', value: { statuses: [{ id: 'a', status: 'read' }] } },
            {
              field: 'calls',
              value: { statuses: [{ id: 'b', type: 'call', status: 'RINGING' }] },
            },
          ],
        },
      ],
    });
    expect(extractStatuses(payload).map((status) => status.id)).toEqual(['a']);
  });
});
