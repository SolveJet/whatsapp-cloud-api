/**
 * Helpers for testing a webhook endpoint: sign a body the way Meta does, build
 * realistic delivery payloads, and create signed `Request` objects. Built on
 * Web Crypto and web-standard globals only, so it runs on Node 20+, Deno, Bun
 * and Cloudflare Workers.
 */
import { WhatsAppWebhookError } from './errors.js';
import type { WebhookPayload } from './types/webhooks.js';

/**
 * Signs a webhook body like Meta does: HMAC-SHA256 of the body bytes with the
 * App Secret, returned as the `X-Hub-Signature-256` header value
 * (`sha256=<hex>`).
 *
 * @param body - The exact body to send, as a string or bytes.
 * @param secret - The App Secret.
 */
export const signWebhookBody = async (
  body: string | Uint8Array,
  secret: string,
): Promise<string> => {
  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const bytes: Uint8Array<ArrayBuffer> =
    typeof body === 'string' ? encoder.encode(body) : new Uint8Array(body);
  const signature = new Uint8Array(await globalThis.crypto.subtle.sign('HMAC', key, bytes));
  let hex = '';
  for (const byte of signature) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return `sha256=${hex}`;
};

/** The kinds of delivery {@link buildWebhookPayload} can build. */
export type WebhookPayloadKind =
  'text' | 'status' | 'call' | 'template_status' | 'flow' | 'account_update' | 'group';

const WABA_ID = '102290129340398';
const PHONE_NUMBER_ID = '106540352242922';
const TIMESTAMP = '1700000000';

const metadata = {
  display_phone_number: '15550783881',
  phone_number_id: PHONE_NUMBER_ID,
};

const envelope = (field: string, value: Record<string, unknown>): Record<string, unknown> => ({
  object: 'whatsapp_business_account',
  entry: [{ id: WABA_ID, changes: [{ field, value }] }],
});

const baseValue = (): Record<string, unknown> => ({
  messaging_product: 'whatsapp',
  metadata: { ...metadata },
});

const builders: Record<WebhookPayloadKind, () => Record<string, unknown>> = {
  text: () =>
    envelope('messages', {
      ...baseValue(),
      contacts: [{ profile: { name: 'Test User' }, wa_id: '16315551234' }],
      messages: [
        {
          from: '16315551234',
          id: 'wamid.TEST_TEXT',
          timestamp: TIMESTAMP,
          type: 'text',
          text: { body: 'Hello' },
        },
      ],
    }),
  status: () =>
    envelope('messages', {
      ...baseValue(),
      statuses: [
        {
          id: 'wamid.TEST_STATUS',
          status: 'delivered',
          timestamp: TIMESTAMP,
          recipient_id: '16315551234',
        },
      ],
    }),
  call: () =>
    envelope('calls', {
      ...baseValue(),
      calls: [
        {
          id: 'wacid.TEST_CALL',
          from: '16315551234',
          to: metadata.display_phone_number,
          event: 'connect',
          direction: 'USER_INITIATED',
          timestamp: TIMESTAMP,
        },
      ],
    }),
  template_status: () =>
    envelope('message_template_status_update', {
      event: 'APPROVED',
      message_template_id: 1234567890,
      message_template_name: 'order_update',
      message_template_language: 'en_US',
      reason: 'NONE',
    }),
  flow: () =>
    envelope('flows', {
      event: 'FLOW_STATUS_CHANGE',
      message: 'Flow status changed from DRAFT to PUBLISHED',
      flow_id: '1234567890',
      old_status: 'DRAFT',
      new_status: 'PUBLISHED',
    }),
  account_update: () =>
    envelope('account_update', {
      phone_number: metadata.display_phone_number,
      event: 'VERIFIED_ACCOUNT',
    }),
  group: () =>
    envelope('group_lifecycle_update', {
      ...baseValue(),
      groups: [
        {
          timestamp: TIMESTAMP,
          group_id: 'TEST_GROUP_ID',
          type: 'group_create',
          request_id: 'TEST_REQUEST_ID',
          subject: 'Test group',
        },
      ],
    }),
};

const FORBIDDEN_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const merge = (target: Record<string, unknown>, source: Record<string, unknown>): void => {
  for (const key of Object.keys(source)) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new WhatsAppWebhookError(`Payload override key "${key}" is not allowed.`);
    }
    const next = source[key];
    const current = target[key];
    if (isPlainObject(next) && isPlainObject(current)) {
      merge(current, next);
    } else if (isPlainObject(next)) {
      const copy: Record<string, unknown> = {};
      merge(copy, next);
      target[key] = copy;
    } else {
      target[key] = next;
    }
  }
};

/**
 * Builds a valid webhook delivery of the given kind. `overrides` is merged into
 * the delivery: plain objects merge key by key, arrays and other values replace
 * what was there.
 *
 * @throws {@link WhatsAppWebhookError} when `overrides` contains `__proto__`,
 *   `constructor` or `prototype` keys.
 */
export const buildWebhookPayload = (
  kind: WebhookPayloadKind,
  overrides: Record<string, unknown> = {},
): WebhookPayload => {
  const payload = builders[kind]();
  merge(payload, overrides);
  return payload as unknown as WebhookPayload;
};

/** Options for {@link createTestRequest}. */
export interface CreateTestRequestOptions {
  /** A delivery to send as JSON. Use this or `body`. */
  payload?: WebhookPayload | Record<string, unknown>;
  /** An exact body to send, as a string or bytes. Use this or `payload`. */
  body?: string | Uint8Array;
  /** App Secret used to sign the body. Without it (and without `signature`) the request is unsigned. */
  secret?: string;
  /** Header value to send instead of a computed signature, for testing rejection. */
  signature?: string;
  /** Request URL. Defaults to `https://example.com/webhook`. */
  url?: string;
  /** Extra headers. */
  headers?: Record<string, string>;
}

/**
 * Creates a POST `Request` shaped like a Meta delivery, signed with
 * `X-Hub-Signature-256` when a `secret` is given.
 *
 * @throws {@link WhatsAppWebhookError} unless exactly one of `payload` and `body` is given.
 */
export const createTestRequest = async (options: CreateTestRequestOptions): Promise<Request> => {
  if ((options.payload === undefined) === (options.body === undefined)) {
    throw new WhatsAppWebhookError('createTestRequest needs exactly one of "payload" or "body".');
  }
  const body = options.body ?? JSON.stringify(options.payload);
  const headers = new Headers({ 'content-type': 'application/json', ...options.headers });
  const signature =
    options.signature ??
    (options.secret !== undefined ? await signWebhookBody(body, options.secret) : undefined);
  if (signature !== undefined) {
    headers.set('x-hub-signature-256', signature);
  }
  return new Request(options.url ?? 'https://example.com/webhook', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : new Uint8Array(body),
  });
};
