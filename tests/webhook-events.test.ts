/**
 * Fixtures follow the field names and enum values on these pages, all under
 * https://developers.facebook.com/documentation/business-messaging/whatsapp/
 *   webhooks/reference/messages/text and messages/status  (messages field)
 *   calling/user-initiated-calls and calling/business-initiated-calls  (calls: connect, terminate, call status)
 *   flows/guides/flowswebhooks  (flows)
 *   webhooks/reference/message_template_status_update
 *   webhooks/reference/message_template_quality_update
 *   webhooks/reference/template_category_update
 *   webhooks/reference/phone_number_quality_update
 *   webhooks/reference/account_update
 *   webhooks/reference/account_alerts
 *   webhooks/reference/user_preferences
 *   business-scoped-user-ids#business_username_updates-webhook
 *   groups/webhooks  (group_lifecycle_update, group_participants_update, group_settings_update, group_status_update)
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
          {
            id: 'wacid.1',
            from: '1555',
            to: '1556',
            event: 'terminate',
            direction: 'USER_INITIATED',
            timestamp: '1749197480',
            status: 'COMPLETED',
            start_time: '1671644824',
            end_time: '1671644944',
            duration: 120,
          },
          { id: 'wacid.1', event: 'future' },
        ],
        statuses: [
          {
            id: 'wacid.1',
            type: 'call',
            status: 'RINGING',
            timestamp: '1',
            recipient_id: '1556',
            biz_opaque_callback_data: 'tag',
          },
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
        deliver('flows', {
          event,
          message: 'm',
          flow_id: '6627390910605886',
          old_status: 'DRAFT',
          new_status: 'PUBLISHED',
        }),
      );
      return parsed?.name === 'flow' ? parsed.event.kind : 'not-flow';
    };
    expect(flow('FLOW_STATUS_CHANGE')).toBe('FLOW_STATUS_CHANGE');
    expect(flow('CLIENT_ERROR_RATE')).toBe('CLIENT_ERROR_RATE');
    expect(flow('ENDPOINT_ERROR_RATE')).toBe('ENDPOINT_ERROR_RATE');
    expect(flow('FLOW_VERSION_EXPIRY_WARNING')).toBe('FLOW_VERSION_EXPIRY_WARNING');
    expect(flow('ENDPOINT_LATENCY')).toBe('ENDPOINT_LATENCY');
    expect(flow('ENDPOINT_AVAILABILITY')).toBe('ENDPOINT_AVAILABILITY');
    expect(flow('SOMETHING_NEW')).toBe('unknown');
  });

  it('emits template events for the three template fields', () => {
    const fields = [
      [
        'message_template_status_update',
        {
          event: 'APPROVED',
          message_template_id: 1689556908129832,
          message_template_name: 'order_confirmation',
          message_template_language: 'en-US',
          reason: 'NONE',
          message_template_category: 'UTILITY',
        },
      ],
      [
        'message_template_quality_update',
        {
          previous_quality_score: 'GREEN',
          new_quality_score: 'YELLOW',
          message_template_id: 806312974732579,
          message_template_name: 'welcome_template',
          message_template_language: 'en-US',
        },
      ],
      [
        'template_category_update',
        {
          message_template_id: 278077987957091,
          message_template_name: 'welcome_template',
          message_template_language: 'en-US',
          previous_category: 'UTILITY',
          new_category: 'MARKETING',
        },
      ],
    ] as const;
    for (const [field, value] of fields) {
      const [event] = parseWebhookEvents(deliver(field, value));
      expect(event).toMatchObject({ name: 'template', event: { kind: field, value } });
    }
  });

  it('emits account events for account-level fields', () => {
    const fields: [string, unknown][] = [
      [
        'phone_number_quality_update',
        {
          display_phone_number: '15550783881',
          event: 'THROUGHPUT_UPGRADE',
          current_limit: 'TIER_UNLIMITED',
        },
      ],
      [
        'account_update',
        { event: 'ACCOUNT_VIOLATION', violation_info: { violation_type: 'ADULT' } },
      ],
      [
        'account_alerts',
        {
          entity_type: 'BUSINESS',
          entity_id: '506914307656634',
          alert_info: {
            alert_severity: 'WARNING',
            alert_status: 'ACTIVE',
            alert_type: 'INCREASED_CAPABILITIES_ELIGIBILITY_DEFERRED',
            alert_description: 'Limits cannot be increased for your business.',
          },
        },
      ],
      [
        'user_preferences',
        {
          messaging_product: 'whatsapp',
          metadata,
          contacts: [{ wa_id: '16505551234', user_id: 'US.13491208655302741918' }],
          user_preferences: [
            {
              wa_id: '16505551234',
              user_id: 'US.13491208655302741918',
              detail: 'User requested to resume marketing messages',
              category: 'marketing_messages',
              value: 'resume',
              timestamp: 1731705721,
            },
          ],
        },
      ],
      [
        'business_username_updates',
        { display_phone_number: '15550783881', username: 'acme', status: 'approved' },
      ],
    ];
    for (const [field, value] of fields) {
      const [event] = parseWebhookEvents(deliver(field, value));
      expect(event).toMatchObject({ name: 'account', event: { kind: field, value } });
    }
  });

  it('emits one group event per groups element', () => {
    const events = parseWebhookEvents(
      deliver('group_participants_update', {
        metadata,
        groups: [
          { timestamp: '1', group_id: 'g1', type: 'group_participants_add', reason: 'invite_link' },
          { timestamp: '2', group_id: 'g2', type: 'group_participants_remove' },
          7,
        ],
      }),
    );
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({
      name: 'group',
      event: {
        kind: 'group_participants_update',
        value: { group_id: 'g2', type: 'group_participants_remove' },
      },
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
