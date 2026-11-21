/**
 * Fixtures follow the webhook reference pages under
 * https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/
 *   messages/text, messages/status (messages field)
 *   calls (connect, terminate and status events)
 *   flows (FLOW_STATUS_CHANGE and the endpoint alerts)
 *   message_template_status_update, message_template_quality_update, template_category_update
 *   phone_number_quality_update, account_update, account_alerts
 *   group_lifecycle_update, group_participants_update (groups reference)
 */
import { describe, expect, it } from 'vitest';
import { WhatsAppWebhookError } from '../src/errors.js';
import { parseWebhookEvents } from '../src/resources/webhook-events.js';
import { extractMessages, extractStatuses, parseWebhook } from '../src/resources/webhooks.js';

const metadata = { display_phone_number: '15550000000', phone_number_id: '1234' };

const deliver = (field: string, value: unknown, extra: Record<string, unknown> = {}): unknown => ({
  object: 'whatsapp_business_account',
  entry: [{ id: 'WABA1', time: 1700000000, changes: [{ field, value }], ...extra }],
});

describe('parseWebhookEvents', () => {
  it('emits message, status and error events with context for the messages field', () => {
    const events = parseWebhookEvents(
      deliver('messages', {
        messaging_product: 'whatsapp',
        metadata,
        contacts: [{ wa_id: '15551234567', user_id: 'US.1', profile: { name: 'Ana' } }],
        messages: [
          {
            from: '15551234567',
            id: 'wamid.M',
            timestamp: '1',
            type: 'text',
            text: { body: 'hi' },
          },
          'garbage',
          { from: '1', timestamp: '1' },
        ],
        statuses: [
          { id: 'wamid.S', status: 'read', timestamp: '2', recipient_id: '15551234567' },
          { status: 'sent' },
        ],
        errors: [{ code: 131000, title: 'Something went wrong' }],
      }),
    );
    expect(events.map((event) => event.name)).toEqual(['message', 'status', 'error']);
    const [message, status] = events;
    expect(message?.ctx).toMatchObject({
      wabaId: 'WABA1',
      time: 1700000000,
      field: 'messages',
      metadata,
      contact: { user_id: 'US.1' },
    });
    expect(status?.ctx.contact?.wa_id).toBe('15551234567');
  });

  it('emits call events for connect, terminate and call statuses', () => {
    const events = parseWebhookEvents(
      deliver('calls', {
        messaging_product: 'whatsapp',
        metadata,
        calls: [
          {
            id: 'wacid.1',
            from: '1555',
            to: '1556',
            event: 'connect',
            direction: 'USER_INITIATED',
          },
          { id: 'wacid.1', event: 'terminate', status: 'COMPLETED', duration: 12 },
          { id: 'wacid.1', event: 'future' },
        ],
        statuses: [
          { id: 'wacid.1', type: 'call', status: 'RINGING', timestamp: '1', recipient_id: '1556' },
        ],
      }),
    );
    expect(events.every((event) => event.name === 'call')).toBe(true);
    const kinds = events.map((event) => (event.name === 'call' ? event.event.kind : ''));
    expect(kinds).toEqual(['connect', 'terminate', 'unknown', 'status']);
  });

  it('does not treat call statuses as message statuses', () => {
    const body = deliver('calls', {
      metadata,
      statuses: [{ id: 'wacid.1', type: 'call', status: 'ACCEPTED' }],
    });
    expect(extractStatuses(parseWebhook(body))).toEqual([]);
    expect(extractMessages(parseWebhook(body))).toEqual([]);
  });

  it('emits flow events by event name and falls back for unknown ones', () => {
    const flow = (event: string): string => {
      const [parsed] = parseWebhookEvents(
        deliver('flows', { event, message: 'm', flow_id: '9', old_status: 'DRAFT' }),
      );
      return parsed?.name === 'flow' ? parsed.event.kind : 'not-flow';
    };
    expect(flow('FLOW_STATUS_CHANGE')).toBe('FLOW_STATUS_CHANGE');
    expect(flow('ENDPOINT_ERROR_RATE')).toBe('ENDPOINT_ERROR_RATE');
    expect(flow('ENDPOINT_LATENCY')).toBe('ENDPOINT_LATENCY');
    expect(flow('ENDPOINT_AVAILABILITY')).toBe('ENDPOINT_AVAILABILITY');
    expect(flow('SOMETHING_NEW')).toBe('unknown');
  });

  it('emits template events for the three template fields', () => {
    const fields = [
      ['message_template_status_update', { event: 'APPROVED', message_template_id: 1 }],
      ['message_template_quality_update', { new_quality_score: 'GREEN', message_template_id: 1 }],
      ['template_category_update', { new_category: 'UTILITY', message_template_id: 1 }],
    ] as const;
    for (const [field, value] of fields) {
      const [event] = parseWebhookEvents(deliver(field, value));
      expect(event).toMatchObject({ name: 'template', event: { kind: field, value } });
    }
  });

  it('emits account events for account-level fields', () => {
    const fields = [
      'phone_number_quality_update',
      'account_update',
      'account_alerts',
      'user_preferences',
      'business_username_updates',
    ];
    for (const field of fields) {
      const [event] = parseWebhookEvents(deliver(field, { event: 'X' }));
      expect(event).toMatchObject({ name: 'account', event: { kind: field } });
    }
  });

  it('emits one group event per groups element', () => {
    const events = parseWebhookEvents(
      deliver('group_participants_update', {
        metadata,
        groups: [{ group_id: 'g1' }, { group_id: 'g2' }, 7],
      }),
    );
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({
      name: 'group',
      event: { kind: 'group_participants_update', value: { group_id: 'g2' } },
    });
    const [fallback] = parseWebhookEvents(deliver('group_status_update', { metadata }));
    expect(fallback).toMatchObject({ name: 'group', event: { kind: 'unknown' } });
  });

  it.each(['history', 'smb_app_state_sync', 'partner_solutions', 'made_up_field'])(
    'emits only an unknown event for the %s field',
    (field) => {
      const value = { anything: [1, 2, 3], messages: [{ id: 'x', type: 'text' }] };
      const events = parseWebhookEvents(deliver(field, value));
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ name: 'unknown', field });
      expect(events[0]).toHaveProperty('value', value);
    },
  );

  it('keeps extractors limited to the messages field', () => {
    const body = parseWebhook(deliver('history', { messages: [{ id: 'x', type: 'text' }] }));
    expect(extractMessages(body)).toEqual([]);
    expect(extractStatuses(body)).toEqual([]);
  });

  it('accepts strings and bytes and rejects an invalid envelope', () => {
    const json = JSON.stringify(deliver('flows', { event: 'FLOW_STATUS_CHANGE' }));
    expect(parseWebhookEvents(json)).toHaveLength(1);
    expect(parseWebhookEvents(new TextEncoder().encode(json))).toHaveLength(1);
    expect(() => parseWebhookEvents('{')).toThrow(WhatsAppWebhookError);
    expect(() => parseWebhookEvents({ object: 'page', entry: [] })).toThrow(WhatsAppWebhookError);
  });

  it('skips malformed entries and changes without throwing', () => {
    const events = parseWebhookEvents({
      object: 'whatsapp_business_account',
      entry: [null, { id: 'W', changes: 'nope' }, { id: 'W', changes: [null, { field: 'x' }] }],
    });
    expect(events).toEqual([
      { name: 'unknown', field: 'x', value: undefined, ctx: { wabaId: 'W', field: 'x' } },
    ]);
  });
});
