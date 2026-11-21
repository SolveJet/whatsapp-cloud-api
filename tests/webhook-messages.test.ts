/**
 * One fixture per inbound message type added in 1.4.0. Field names follow the
 * message pages under
 * https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/
 * (order, unsupported, edit, revoke, interactive).
 */
import { describe, expect, it } from 'vitest';
import { isKnownMessage } from '../src/resources/webhook-helpers.js';
import { extractMessages, parseWebhook } from '../src/resources/webhooks.js';
import type { IncomingMessage, UnknownIncomingMessage } from '../src/types/webhooks.js';

const base = { from: '15551234567', id: 'wamid.X', timestamp: '1700000000' };

const envelope = (messages: unknown[]): string =>
  JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WABA',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '15550000000', phone_number_id: '1' },
              messages,
            },
          },
        ],
      },
    ],
  });

const describeMessage = (message: IncomingMessage): string => {
  switch (message.type) {
    case 'order':
      return `order:${message.order.catalog_id}:${message.order.product_items.length}`;
    case 'unsupported':
      return `unsupported:${message.errors?.[0]?.code ?? 0}`;
    case 'edit':
      return `edit:${message.edit.original_message_id}:${message.edit.message.type}`;
    case 'revoke':
      return `revoke:${message.revoke.original_message_id}`;
    case 'interactive':
      return `interactive:${message.interactive.type}`;
    default:
      return message.type;
  }
};

describe('new inbound message types', () => {
  const fixtures: { message: Record<string, unknown>; expected: string }[] = [
    {
      message: {
        ...base,
        type: 'order',
        order: {
          catalog_id: 'CAT1',
          text: 'please',
          product_items: [
            { product_retailer_id: 'SKU1', quantity: 2, item_price: 10.5, currency: 'USD' },
          ],
        },
      },
      expected: 'order:CAT1:1',
    },
    {
      message: {
        ...base,
        type: 'unsupported',
        unsupported: { type: 'poll' },
        errors: [{ code: 131051, title: 'Unsupported message type' }],
      },
      expected: 'unsupported:131051',
    },
    {
      message: {
        ...base,
        type: 'edit',
        edit: {
          original_message_id: 'wamid.OLD',
          message: { type: 'text', text: { body: 'fixed' } },
        },
      },
      expected: 'edit:wamid.OLD:text',
    },
    {
      message: { ...base, type: 'revoke', revoke: { original_message_id: 'wamid.OLD' } },
      expected: 'revoke:wamid.OLD',
    },
    {
      message: {
        ...base,
        type: 'interactive',
        interactive: { type: 'product', product_reply: { id: 'SKU1' } },
      },
      expected: 'interactive:product',
    },
    {
      message: {
        ...base,
        type: 'interactive',
        interactive: {
          type: 'call_permission_reply',
          call_permission_reply: { response: 'accept' },
        },
      },
      expected: 'interactive:call_permission_reply',
    },
  ];

  it.each(fixtures)('parses and narrows $expected', ({ message, expected }) => {
    const [parsed] = extractMessages(parseWebhook(envelope([message])));
    expect(parsed).toBeDefined();
    expect(describeMessage(parsed as IncomingMessage)).toBe(expected);
  });
});

describe('isKnownMessage', () => {
  it('is true for every modeled type and false for an unknown one', () => {
    const types = ['text', 'order', 'unsupported', 'edit', 'revoke', 'system', 'reaction'];
    for (const type of types) {
      expect(isKnownMessage({ ...base, type } as unknown as IncomingMessage)).toBe(true);
    }
    const unknown: UnknownIncomingMessage = { ...base, type: 'future_type' };
    expect(isKnownMessage(unknown)).toBe(false);
  });
});
