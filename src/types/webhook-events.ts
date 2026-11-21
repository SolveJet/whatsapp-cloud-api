/**
 * Typed events produced by `parseWebhookEvents`.
 *
 * A webhook delivery carries one or more changes, each tagged with a `field`.
 * Every change is flattened into events named after what happened (`message`,
 * `status`, `call`, ...). Fields this SDK does not model become `unknown`
 * events that carry the untouched `value`.
 */
import type {
  IncomingMessage,
  MessageStatus,
  WebhookContact,
  WebhookMessageError,
  WebhookMetadata,
} from './webhooks.js';

/** Where an event came from. */
export interface WebhookContext {
  /** The WhatsApp Business Account (WABA) ID of the entry. */
  wabaId: string;
  /** Unix epoch seconds of the entry, when Meta includes it. */
  time?: number;
  /** The subscription field that produced the event, e.g. `messages` or `calls`. */
  field: string;
  /** Business phone number metadata, when the change carries it. */
  metadata?: WebhookMetadata;
  /** The contact profile matching the sender or recipient, when the change carries one. */
  contact?: WebhookContact;
}

/** The fallback member of each typed event union: the field is known but the shape is not. */
export interface UnknownEventPayload {
  kind: 'unknown';
  /** The subscription field. */
  field: string;
  /** The untouched value (or list element) from the delivery. */
  value: unknown;
}

/** A call object from the `calls` field (`connect` and `terminate` events). */
export interface CallRecord {
  /** The call ID. */
  id?: string;
  /** The caller wa_id. */
  from?: string;
  /** The callee wa_id. */
  to?: string;
  /** `connect` or `terminate`. */
  event: string;
  /** `USER_INITIATED` or `BUSINESS_INITIATED`. */
  direction?: string;
  /** Unix epoch seconds as a string. */
  timestamp?: string;
  /** Final status of a terminated call, e.g. `COMPLETED` or `FAILED`. */
  status?: string;
  /** Call duration in seconds, on `terminate`. */
  duration?: number;
  [key: string]: unknown;
}

/** A call status entry (`RINGING`, `ACCEPTED`, `REJECTED`) from `value.statuses`. */
export interface CallStatusRecord {
  id?: string;
  type: 'call';
  status?: string;
  timestamp?: string;
  recipient_id?: string;
  [key: string]: unknown;
}

/** A call event from the `calls` field. */
export type CallWebhookEvent =
  | { kind: 'connect'; value: CallRecord }
  | { kind: 'terminate'; value: CallRecord }
  | { kind: 'status'; value: CallStatusRecord }
  | UnknownEventPayload;

/** The `event` values Meta sends on the `flows` field. */
export type FlowEventName =
  'FLOW_STATUS_CHANGE' | 'ENDPOINT_ERROR_RATE' | 'ENDPOINT_LATENCY' | 'ENDPOINT_AVAILABILITY';

/** A value from the `flows` field. */
export interface FlowValue {
  event: FlowEventName;
  /** Human-readable description. */
  message?: string;
  flow_id?: string;
  [key: string]: unknown;
}

/** A Flow event from the `flows` field. */
export type FlowWebhookEvent =
  | { kind: 'FLOW_STATUS_CHANGE'; value: FlowValue }
  | { kind: 'ENDPOINT_ERROR_RATE'; value: FlowValue }
  | { kind: 'ENDPOINT_LATENCY'; value: FlowValue }
  | { kind: 'ENDPOINT_AVAILABILITY'; value: FlowValue }
  | UnknownEventPayload;

/** A template-related change value. The exact keys depend on the field. */
export interface TemplateValue {
  message_template_id?: number | string;
  message_template_name?: string;
  message_template_language?: string;
  [key: string]: unknown;
}

/** A template event: status, quality or category changes. */
export type TemplateWebhookEvent =
  | { kind: 'message_template_status_update'; value: TemplateValue }
  | { kind: 'message_template_quality_update'; value: TemplateValue }
  | { kind: 'template_category_update'; value: TemplateValue }
  | UnknownEventPayload;

/** An account or phone number change value. The exact keys depend on the field. */
export interface AccountValue {
  [key: string]: unknown;
}

/** An account event: phone number quality, account updates and alerts, preferences, usernames. */
export type AccountWebhookEvent =
  | { kind: 'phone_number_quality_update'; value: AccountValue }
  | { kind: 'account_update'; value: AccountValue }
  | { kind: 'account_alerts'; value: AccountValue }
  | { kind: 'user_preferences'; value: AccountValue }
  | { kind: 'business_username_updates'; value: AccountValue }
  | UnknownEventPayload;

/** One element of `value.groups[]`. */
export interface GroupValue {
  group_id?: string;
  [key: string]: unknown;
}

/** A group event, one per element of `value.groups[]`. */
export type GroupWebhookEvent =
  | { kind: 'group_lifecycle_update'; value: GroupValue }
  | { kind: 'group_participants_update'; value: GroupValue }
  | { kind: 'group_settings_update'; value: GroupValue }
  | { kind: 'group_status_update'; value: GroupValue }
  | UnknownEventPayload;

/** Maps each event name to its event object. */
export interface WebhookEventMap {
  message: { name: 'message'; message: IncomingMessage; ctx: WebhookContext };
  status: { name: 'status'; status: MessageStatus; ctx: WebhookContext };
  error: { name: 'error'; error: WebhookMessageError; ctx: WebhookContext };
  call: { name: 'call'; event: CallWebhookEvent; ctx: WebhookContext };
  flow: { name: 'flow'; event: FlowWebhookEvent; ctx: WebhookContext };
  template: { name: 'template'; event: TemplateWebhookEvent; ctx: WebhookContext };
  account: { name: 'account'; event: AccountWebhookEvent; ctx: WebhookContext };
  group: { name: 'group'; event: GroupWebhookEvent; ctx: WebhookContext };
  unknown: { name: 'unknown'; field: string; value: unknown; ctx: WebhookContext };
}

/** The name of an event. */
export type WebhookEventName = keyof WebhookEventMap;

/** Any event produced by `parseWebhookEvents`. */
export type WebhookEvent = WebhookEventMap[WebhookEventName];
