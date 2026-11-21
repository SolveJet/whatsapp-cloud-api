/**
 * Flattens a webhook delivery into typed events. Runtime-neutral: no `node:*`
 * imports.
 */
import type {
  AccountWebhookEvent,
  CallRecord,
  CallStatusRecord,
  CallWebhookEvent,
  FlowValue,
  FlowWebhookEvent,
  GroupValue,
  GroupWebhookEvent,
  TemplateValue,
  TemplateWebhookEvent,
  WebhookContext,
  WebhookEvent,
  WebhookEventMap,
} from '../types/webhook-events.js';
import type {
  IncomingMessage,
  MessageStatus,
  ParseWebhookOptions,
  WebhookContact,
  WebhookMessageError,
  WebhookMetadata,
} from '../types/webhooks.js';
import { isRecord, parseWebhook } from './webhook-core.js';

const FLOW_EVENTS = [
  'FLOW_STATUS_CHANGE',
  'ENDPOINT_ERROR_RATE',
  'ENDPOINT_LATENCY',
  'ENDPOINT_AVAILABILITY',
] as const;

const TEMPLATE_FIELDS = [
  'message_template_status_update',
  'message_template_quality_update',
  'template_category_update',
] as const;

const ACCOUNT_FIELDS = [
  'phone_number_quality_update',
  'account_update',
  'account_alerts',
  'user_preferences',
  'business_username_updates',
] as const;

const GROUP_FIELDS = [
  'group_lifecycle_update',
  'group_participants_update',
  'group_settings_update',
  'group_status_update',
] as const;

const includes = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (list as readonly string[]).includes(value);

const toMetadata = (value: unknown): WebhookMetadata | undefined =>
  isRecord(value) &&
  typeof value['display_phone_number'] === 'string' &&
  typeof value['phone_number_id'] === 'string'
    ? (value as unknown as WebhookMetadata)
    : undefined;

const recordsOf = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? (value as unknown[]).filter(isRecord) : [];

const findContact = (
  contacts: readonly Record<string, unknown>[],
  waId: unknown,
  userId: unknown,
): WebhookContact | undefined => {
  const match = contacts.find(
    (contact) =>
      (typeof waId === 'string' && waId.length > 0 && contact['wa_id'] === waId) ||
      (typeof userId === 'string' && userId.length > 0 && contact['user_id'] === userId),
  );
  return match as unknown as WebhookContact | undefined;
};

const withContact = (ctx: WebhookContext, contact: WebhookContact | undefined): WebhookContext =>
  contact === undefined ? ctx : { ...ctx, contact };

const callEvent = (field: string, value: Record<string, unknown>): CallWebhookEvent => {
  const event = value['event'];
  if (event === 'connect' || event === 'terminate') {
    return { kind: event, value: value as CallRecord };
  }
  return { kind: 'unknown', field, value };
};

const callEventsOf = (value: Record<string, unknown>, field: string): CallWebhookEvent[] => {
  const events: CallWebhookEvent[] = [];
  const calls = recordsOf(value['calls']);
  for (const call of calls) {
    events.push(callEvent(field, call));
  }
  const statuses = recordsOf(value['statuses']);
  for (const status of statuses) {
    events.push(
      status['type'] === 'call'
        ? { kind: 'status', value: status as CallStatusRecord }
        : { kind: 'unknown', field, value: status },
    );
  }
  if (calls.length === 0 && statuses.length === 0) {
    events.push({ kind: 'unknown', field, value });
  }
  return events;
};

const flowEvent = (field: string, value: Record<string, unknown>): FlowWebhookEvent => {
  const event = value['event'];
  if (includes(FLOW_EVENTS, event)) {
    return { kind: event, value: value as FlowValue };
  }
  return { kind: 'unknown', field, value };
};

/**
 * Parses a webhook delivery into a flat list of typed events, in delivery order.
 *
 * Accepts the same inputs as `parseWebhook`: a parsed object or its JSON as a
 * string, `Uint8Array` or `ArrayBuffer`. Fields this SDK does not model, and
 * known fields whose shape does not match, are returned as `unknown` events (or
 * the `unknown` member of a typed event) instead of throwing. Only an invalid
 * envelope throws.
 *
 * `statuses` under the `messages` field are message statuses; `statuses` under
 * `calls` are call statuses. Signature verification is not part of this
 * function; verify the raw body first.
 *
 * @param body - The delivery body.
 * @param options - Optional size limit override.
 * @throws {@link WhatsAppWebhookError} when the body is not a valid envelope.
 */
export const parseWebhookEvents = (
  body: unknown,
  options: ParseWebhookOptions = {},
): WebhookEvent[] => {
  const payload = parseWebhook(body, options);
  const events: WebhookEvent[] = [];
  for (const entry of recordsOf(payload.entry)) {
    if (!Array.isArray(entry['changes'])) {
      continue;
    }
    const wabaId = typeof entry['id'] === 'string' ? entry['id'] : '';
    const time = typeof entry['time'] === 'number' ? entry['time'] : undefined;
    for (const change of recordsOf(entry['changes'])) {
      const field = typeof change['field'] === 'string' ? change['field'] : 'messages';
      const value = change['value'];
      const baseCtx: WebhookContext = {
        wabaId,
        field,
        ...(time !== undefined ? { time } : {}),
        ...(isRecord(value) && toMetadata(value['metadata']) !== undefined
          ? { metadata: toMetadata(value['metadata']) as WebhookMetadata }
          : {}),
      };
      appendChangeEvents(events, field, value, baseCtx);
    }
  }
  return events;
};

const appendChangeEvents = (
  events: WebhookEvent[],
  field: string,
  value: unknown,
  ctx: WebhookContext,
): void => {
  const push = <N extends keyof WebhookEventMap>(event: WebhookEventMap[N]): void => {
    events.push(event);
  };
  if (!isRecord(value)) {
    if (field !== 'messages') {
      push<'unknown'>({ name: 'unknown', field, value, ctx });
    }
    return;
  }
  const contacts = recordsOf(value['contacts']);

  if (field === 'messages') {
    for (const message of recordsOf(value['messages'])) {
      if (typeof message['id'] !== 'string' || typeof message['type'] !== 'string') {
        continue;
      }
      push<'message'>({
        name: 'message',
        message: message as unknown as IncomingMessage,
        ctx: withContact(ctx, findContact(contacts, message['from'], message['from_user_id'])),
      });
    }
    for (const status of recordsOf(value['statuses'])) {
      if (typeof status['id'] !== 'string') {
        continue;
      }
      push<'status'>({
        name: 'status',
        status: status as unknown as MessageStatus,
        ctx: withContact(
          ctx,
          findContact(contacts, status['recipient_id'], status['recipient_user_id']),
        ),
      });
    }
    appendErrors(events, value, ctx);
    return;
  }

  if (field === 'calls') {
    for (const event of callEventsOf(value, field)) {
      push<'call'>({ name: 'call', event, ctx });
    }
    appendErrors(events, value, ctx);
    return;
  }

  if (field === 'flows') {
    push<'flow'>({ name: 'flow', event: flowEvent(field, value), ctx });
    return;
  }

  if (includes(TEMPLATE_FIELDS, field)) {
    const event: TemplateWebhookEvent = { kind: field, value: value as TemplateValue };
    push<'template'>({ name: 'template', event, ctx });
    return;
  }

  if (includes(ACCOUNT_FIELDS, field)) {
    const event: AccountWebhookEvent = { kind: field, value };
    push<'account'>({ name: 'account', event, ctx });
    return;
  }

  if (includes(GROUP_FIELDS, field)) {
    const groups = recordsOf(value['groups']);
    if (groups.length === 0) {
      push<'group'>({ name: 'group', event: { kind: 'unknown', field, value }, ctx });
      return;
    }
    for (const group of groups) {
      const event: GroupWebhookEvent = { kind: field, value: group as GroupValue };
      push<'group'>({ name: 'group', event, ctx });
    }
    return;
  }

  push<'unknown'>({ name: 'unknown', field, value, ctx });
};

const appendErrors = (
  events: WebhookEvent[],
  value: Record<string, unknown>,
  ctx: WebhookContext,
): void => {
  for (const error of recordsOf(value['errors'])) {
    events.push({ name: 'error', error: error as unknown as WebhookMessageError, ctx });
  }
};
