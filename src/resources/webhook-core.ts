/**
 * Runtime-neutral webhook building blocks: body decoding and size limits,
 * envelope validation, message and status extraction, and the one-time warning
 * for unsigned deliveries.
 *
 * This module has no Node-only imports and relies only on web-standard
 * globals, so it is safe to bundle for Deno, Bun, Cloudflare Workers and other
 * web runtimes.
 */
import { WhatsAppWebhookError } from '../errors.js';
import type {
  IncomingMessage,
  MessageStatus,
  ParseWebhookOptions,
  WebhookPayload,
  WebhookValue,
} from '../types/webhooks.js';

/** True when `value` is a non-null, non-array object. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** True for a string with at least one character. */
export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

/** Cross-realm safe `Uint8Array` check (also true for Node byte buffers). */
const isUint8Array = (value: unknown): value is Uint8Array =>
  ArrayBuffer.isView(value) && Object.prototype.toString.call(value) === '[object Uint8Array]';

/** Cross-realm safe `ArrayBuffer` check. */
const isArrayBuffer = (value: unknown): value is ArrayBuffer =>
  Object.prototype.toString.call(value) === '[object ArrayBuffer]';

/**
 * Normalizes a raw request body to something a hash function can consume
 * without any re-encoding: strings and byte arrays pass through, an
 * `ArrayBuffer` is viewed as bytes. Returns `undefined` for any other input.
 */
export const toHashable = (body: unknown): string | Uint8Array | undefined => {
  if (typeof body === 'string' || isUint8Array(body)) {
    return body;
  }
  if (isArrayBuffer(body)) {
    return new Uint8Array(body);
  }
  return undefined;
};

/**
 * Decodes a raw body to text. `ignoreBOM: true` keeps a leading byte-order mark
 * in the output instead of silently dropping it, so the decoded text always
 * reflects the bytes that were signed (and `JSON.parse` then rejects it).
 * Returns `undefined` for an unsupported input type.
 */
export const decodeBody = (body: unknown): string | undefined => {
  const hashable = toHashable(body);
  if (hashable === undefined || typeof hashable === 'string') {
    return hashable;
  }
  return new TextDecoder('utf-8', { ignoreBOM: true }).decode(hashable);
};

/** Meta's documented maximum webhook payload size: 3 MiB. */
export const DEFAULT_MAX_BODY_BYTES = 3 * 1024 * 1024;

/** Resolves and validates a `maxBodyBytes` option. */
export const resolveMaxBodyBytes = (option: unknown): number | false => {
  if (option === undefined) {
    return DEFAULT_MAX_BODY_BYTES;
  }
  if (option === false) {
    return false;
  }
  if (typeof option !== 'number' || !Number.isSafeInteger(option) || option < 1) {
    throw new WhatsAppWebhookError('maxBodyBytes must be a positive integer or false.');
  }
  return option;
};

/**
 * Throws when a string or byte body is larger than `limit` bytes. Other input
 * types (already parsed objects) have no byte size and are not checked.
 */
export const assertBodySize = (body: unknown, limit: number | false): void => {
  if (limit === false) {
    return;
  }
  let size: number;
  if (typeof body === 'string') {
    size = new TextEncoder().encode(body).byteLength;
  } else if (isUint8Array(body) || isArrayBuffer(body)) {
    size = body.byteLength;
  } else {
    return;
  }
  if (size > limit) {
    throw new WhatsAppWebhookError(
      `Webhook body of ${size} bytes exceeds the maximum of ${limit} bytes.`,
    );
  }
};

/**
 * Validates the top-level envelope and returns it typed as a
 * {@link WebhookPayload}. Accepts a parsed object or a JSON string (parsed
 * internally). Only the top-level shape is validated (`object` is
 * `whatsapp_business_account` and `entry` is an array); per-message narrowing
 * happens lazily in {@link extractMessages}/{@link extractStatuses} so new Meta
 * message types never break parsing.
 *
 * String and byte bodies larger than `options.maxBodyBytes` (default 3 MiB,
 * Meta's documented maximum) are rejected before parsing.
 *
 * @param body - A parsed webhook object, or its JSON as a string, `Uint8Array`
 *   (including Node byte buffers) or `ArrayBuffer`. Byte bodies are decoded as UTF-8.
 * @param options - Optional size limit override.
 * @throws {@link WhatsAppWebhookError} when the body is unparseable or malformed.
 */
export const parseWebhook = (body: unknown, options: ParseWebhookOptions = {}): WebhookPayload => {
  assertBodySize(body, resolveMaxBodyBytes(options.maxBodyBytes));
  let parsed: unknown = body;
  const text = decodeBody(body);
  if (text !== undefined) {
    try {
      parsed = JSON.parse(text);
    } catch {
      // The SyntaxError is deliberately not attached as `cause`: its message
      // embeds a fragment of the (possibly unauthenticated) request body.
      throw new WhatsAppWebhookError('Webhook body is not valid JSON.');
    }
  }
  if (!isRecord(parsed)) {
    throw new WhatsAppWebhookError('Webhook payload must be an object.');
  }
  if (parsed['object'] !== 'whatsapp_business_account') {
    throw new WhatsAppWebhookError('Webhook payload "object" must be "whatsapp_business_account".');
  }
  if (!Array.isArray(parsed['entry'])) {
    throw new WhatsAppWebhookError('Webhook payload "entry" must be an array.');
  }
  return parsed as unknown as WebhookPayload;
};

/** True when a change value carries inbound messages. */
export const isMessageEvent = (
  value: WebhookValue,
): value is WebhookValue & { messages: IncomingMessage[] } => Array.isArray(value.messages);

/** True when a change value carries status updates. */
export const isStatusEvent = (
  value: WebhookValue,
): value is WebhookValue & { statuses: MessageStatus[] } => Array.isArray(value.statuses);

/**
 * Collects each change `value` from `messages` changes across all entries,
 * skipping malformed shapes (non-array `changes`, non-object entries, changes
 * and values). A change is read when its `field` is `messages` or is not a
 * string (hand-built envelopes may omit it); every other field (for example
 * `calls`, whose `statuses` are call events) is ignored.
 */
const iterateValues = (payload: WebhookPayload): WebhookValue[] => {
  const values: WebhookValue[] = [];
  const entries: unknown = payload.entry;
  if (!Array.isArray(entries)) {
    return values;
  }
  for (const entry of entries as unknown[]) {
    if (!isRecord(entry) || !Array.isArray(entry['changes'])) {
      continue;
    }
    for (const change of entry['changes'] as unknown[]) {
      if (!isRecord(change)) {
        continue;
      }
      const field = change['field'];
      if (typeof field === 'string' && field !== 'messages') {
        continue;
      }
      const value = change['value'];
      if (isRecord(value)) {
        values.push(value as unknown as WebhookValue);
      }
    }
  }
  return values;
};

/**
 * Appends the object elements of `source` to `target` with an index loop.
 * Spreading into `push(...source)` throws a `RangeError` for arrays of roughly
 * 125,000 elements or more; non-object elements are skipped.
 */
const appendObjects = <T>(target: T[], source: readonly unknown[]): void => {
  for (let index = 0; index < source.length; index += 1) {
    const item = source[index];
    if (isRecord(item)) {
      target.push(item as T);
    }
  }
};

/**
 * Flattens all inbound messages across `entry[].changes[].value` for changes
 * whose `field` is `messages`. Non-object elements are skipped. Returns an
 * empty array when the payload carries none.
 */
export const extractMessages = (payload: WebhookPayload): IncomingMessage[] => {
  const messages: IncomingMessage[] = [];
  for (const value of iterateValues(payload)) {
    if (isMessageEvent(value)) {
      appendObjects(messages, value.messages);
    }
  }
  return messages;
};

/**
 * Flattens all message status updates across `entry[].changes[].value` for
 * changes whose `field` is `messages`. Status values under other fields, such
 * as `calls`, are not message statuses and are ignored. Non-object elements
 * are skipped. Returns an empty array when the payload carries none.
 */
export const extractStatuses = (payload: WebhookPayload): MessageStatus[] => {
  const statuses: MessageStatus[] = [];
  for (const value of iterateValues(payload)) {
    if (isStatusEvent(value)) {
      appendObjects(statuses, value.statuses);
    }
  }
  return statuses;
};

/** Warning code emitted when an unsigned delivery is accepted. */
export const UNSIGNED_WARNING_CODE = 'WHATSAPP_WEBHOOK_UNSIGNED';

const UNSIGNED_WARNING_MESSAGE =
  'Accepting a WhatsApp webhook delivery without verifying its X-Hub-Signature-256 header, ' +
  'because no app secret is configured. Anyone who can reach this endpoint can send it ' +
  'forged events. Configure an app secret, or pass allowUnsigned: true if another layer ' +
  'authenticates the request.';

let unsignedWarned = false;

/**
 * Emits a one-time process warning that deliveries are accepted without a
 * signature check. Uses `process.emitWarning` where available, otherwise
 * `console.warn`.
 */
export const warnUnsignedOnce = (): void => {
  if (unsignedWarned) {
    return;
  }
  unsignedWarned = true;
  if (typeof process !== 'undefined' && typeof process.emitWarning === 'function') {
    process.emitWarning(UNSIGNED_WARNING_MESSAGE, { code: UNSIGNED_WARNING_CODE });
  } else {
    console.warn(UNSIGNED_WARNING_MESSAGE);
  }
};
