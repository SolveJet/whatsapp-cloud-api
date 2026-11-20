/**
 * Framework-agnostic webhook utilities for the WhatsApp Cloud API.
 *
 * Provides the GET verification handshake, constant-time `X-Hub-Signature-256`
 * validation, and typed parsing of inbound webhook deliveries, plus a thin
 * {@link WebhookHandler} that binds configured secrets. Built entirely on the
 * `node:crypto` built-in, so the package stays dependency-free at runtime.
 *
 * SECURITY: callers MUST pass the raw, unparsed request body bytes to
 * {@link verifySignature}. Re-serializing parsed JSON changes the bytes and
 * breaks the HMAC. Nothing here logs the app secret, verify token, or
 * signature header.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { types } from 'node:util';
import { WhatsAppWebhookError } from '../errors.js';
import type {
  IncomingMessage,
  MessageStatus,
  ParsedWebhook,
  ParseWebhookOptions,
  WebhookHandlerConfig,
  WebhookPayload,
  WebhookRawBody,
  WebhookValue,
} from '../types/webhooks.js';

/** Result of the GET verification handshake. */
export interface WebhookVerificationResult {
  /** HTTP status code to return: `200` on success, `403` otherwise. */
  statusCode: number;
  /** Response body: the raw challenge on success, otherwise `Forbidden`. */
  body: string;
}

/** Prefix Meta uses on the `X-Hub-Signature-256` header value. */
const SIGNATURE_PREFIX = 'sha256=';

/**
 * Normalizes a raw request body to something `createHmac` can hash without any
 * re-encoding: strings and byte arrays pass through, an `ArrayBuffer` is viewed
 * as bytes. Returns `undefined` for any other input type.
 */
const toHashable = (body: unknown): string | Uint8Array | undefined => {
  if (typeof body === 'string' || types.isUint8Array(body)) {
    return body;
  }
  if (types.isArrayBuffer(body)) {
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
const decodeBody = (body: unknown): string | undefined => {
  const hashable = toHashable(body);
  if (hashable === undefined || typeof hashable === 'string') {
    return hashable;
  }
  return new TextDecoder('utf-8', { ignoreBOM: true }).decode(hashable);
};

/** Meta's documented maximum webhook payload size: 3 MiB. */
const DEFAULT_MAX_BODY_BYTES = 3 * 1024 * 1024;

/** Resolves and validates a `maxBodyBytes` option. */
const resolveMaxBodyBytes = (option: unknown): number | false => {
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
const assertBodySize = (body: unknown, limit: number | false): void => {
  if (limit === false) {
    return;
  }
  let size: number;
  if (typeof body === 'string') {
    size = Buffer.byteLength(body, 'utf8');
  } else if (types.isUint8Array(body) || types.isArrayBuffer(body)) {
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

/** True for a string with at least one character. */
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

/**
 * Constant-time string comparison. Returns `false` immediately when the two
 * strings differ in byte length (guarding {@link timingSafeEqual}, which throws
 * on unequal lengths), otherwise defers to the constant-time comparison.
 */
const constantTimeEqual = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
};

/**
 * Verifies the GET verification handshake Meta performs when a webhook is
 * configured. Returns `{ statusCode: 200, body: challenge }` when `mode` is
 * `subscribe` and the token matches `expectedToken` (compared in constant
 * time); otherwise `{ statusCode: 403, body: 'Forbidden' }`.
 *
 * On success the `body` is the RAW challenge string and MUST be returned as the
 * raw response body — do NOT wrap it in JSON. Missing params are handled safely
 * (a missing challenge yields an empty-string body on an otherwise valid
 * request).
 *
 * Fails closed: an `expectedToken` that is empty or not a string always yields
 * `403`, so an unset environment variable can never accept a request.
 *
 * @param params - The decoded `hub.mode`, `hub.verify_token`, `hub.challenge`.
 * @param expectedToken - The verify token configured for this endpoint.
 */
export const verifyWebhook = (
  params: { mode?: string; token?: string; challenge?: string },
  expectedToken: string,
): WebhookVerificationResult => {
  const { mode, token } = params;
  if (
    mode === 'subscribe' &&
    isNonEmptyString(expectedToken) &&
    typeof token === 'string' &&
    constantTimeEqual(token, expectedToken)
  ) {
    return { statusCode: 200, body: params.challenge ?? '' };
  }
  return { statusCode: 403, body: 'Forbidden' };
};

/**
 * Convenience wrapper around {@link verifyWebhook} accepting a raw query map
 * with the literal `hub.mode`, `hub.verify_token`, and `hub.challenge` keys as
 * delivered on the verification request.
 *
 * @param query - Raw query parameters keyed by their `hub.*` names.
 * @param expectedToken - The verify token configured for this endpoint.
 */
export const verifyWebhookQuery = (
  query: Record<string, string | undefined>,
  expectedToken: string,
): WebhookVerificationResult =>
  verifyWebhook(
    {
      ...(query['hub.mode'] !== undefined ? { mode: query['hub.mode'] } : {}),
      ...(query['hub.verify_token'] !== undefined ? { token: query['hub.verify_token'] } : {}),
      ...(query['hub.challenge'] !== undefined ? { challenge: query['hub.challenge'] } : {}),
    },
    expectedToken,
  );

/**
 * Verifies the `X-Hub-Signature-256` header against the HMAC-SHA256 of the raw
 * request body using the App Secret. Uses a constant-time comparison and never
 * throws on malformed input.
 *
 * SECURITY: `rawBody` MUST be the raw, unparsed request bytes exactly as
 * received. Passing re-serialized JSON changes the bytes and makes a legitimate
 * signature fail. The app secret and signature are never logged or embedded in
 * errors.
 *
 * @param rawBody - The raw request body: a string, `Uint8Array` (including
 *   `Buffer`) or `ArrayBuffer`. Any other type yields `false`.
 * @param signatureHeader - The `X-Hub-Signature-256` header value, if present.
 * @param appSecret - The App Secret used to compute the expected signature.
 * @returns `true` only when the signature is present, well-formed, and matches.
 *   Returns `false` when `appSecret` is not a non-empty string, so an empty key
 *   can never validate a signature.
 */
export const verifySignature = (
  rawBody: WebhookRawBody,
  signatureHeader: string | undefined,
  appSecret: string,
): boolean => {
  if (!isNonEmptyString(appSecret)) {
    return false;
  }
  const hashable = toHashable(rawBody);
  if (hashable === undefined) {
    return false;
  }
  if (typeof signatureHeader !== 'string' || !signatureHeader.startsWith(SIGNATURE_PREFIX)) {
    return false;
  }
  const expected = `${SIGNATURE_PREFIX}${createHmac('sha256', appSecret).update(hashable).digest('hex')}`;
  return constantTimeEqual(expected, signatureHeader);
};

/** True when `value` is a non-null, non-array object. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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
 *   (including `Buffer`) or `ArrayBuffer`. Byte bodies are decoded as UTF-8.
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

/**
 * Returns `value` when it is a non-empty string, otherwise throws. Used so that
 * a misconfigured environment variable cannot silently disable verification.
 */
const requireConfiguredSecret = (value: unknown, name: string): string => {
  if (!isNonEmptyString(value)) {
    throw new WhatsAppWebhookError(
      `WebhookHandler config "${name}" was provided but is empty or not a string. ` +
        `Omit the key to disable it, or check the environment variable it comes from.`,
    );
  }
  return value;
};

/**
 * Framework-agnostic webhook handler binding a verify token and/or App Secret.
 *
 * It imports no web framework; the caller wires it into their HTTP layer,
 * passing the raw request body for signature verification. See the README for a
 * complete Express example.
 *
 * Configuration rules:
 * - Omitting the `appSecret` key entirely means no signature enforcement:
 *   {@link WebhookHandler.parse} and {@link WebhookHandler.verifyOrThrow} accept
 *   unsigned bodies. Only do this when something else authenticates the request.
 * - Passing `appSecret` or `verifyToken` with an `undefined` or empty value
 *   (typically an unset environment variable) throws
 *   {@link WhatsAppWebhookError} instead of silently disabling verification.
 */
export class WebhookHandler {
  private readonly appSecret?: string;
  private readonly verifyToken?: string;
  private readonly maxBodyBytes: number | false;

  /**
   * @throws {@link WhatsAppWebhookError} when `appSecret` or `verifyToken` is
   *   present in `config` but is not a non-empty string.
   */
  constructor(config: WebhookHandlerConfig = {}) {
    if (Object.hasOwn(config, 'appSecret')) {
      this.appSecret = requireConfiguredSecret(config.appSecret, 'appSecret');
    }
    if (Object.hasOwn(config, 'verifyToken')) {
      this.verifyToken = requireConfiguredSecret(config.verifyToken, 'verifyToken');
    }
    this.maxBodyBytes = resolveMaxBodyBytes(config.maxBodyBytes);
  }

  /**
   * Runs the GET verification handshake using the configured verify token.
   *
   * @param query - Raw query map with `hub.*` keys.
   * @throws {@link WhatsAppWebhookError} when no verify token was configured.
   */
  handleVerification(query: Record<string, string | undefined>): WebhookVerificationResult {
    if (this.verifyToken === undefined) {
      throw new WhatsAppWebhookError('WebhookHandler was constructed without a verifyToken.');
    }
    return verifyWebhookQuery(query, this.verifyToken);
  }

  /**
   * Returns whether the signature is valid for the raw body using the
   * configured App Secret. Returns `false` (rather than throwing) when no App
   * Secret was configured.
   *
   * @param rawBody - The raw, unparsed request body (string, `Uint8Array`/`Buffer` or `ArrayBuffer`).
   * @param signatureHeader - The `X-Hub-Signature-256` header value.
   */
  isValid(rawBody: WebhookRawBody, signatureHeader: string | undefined): boolean {
    if (this.appSecret === undefined) {
      return false;
    }
    return verifySignature(rawBody, signatureHeader, this.appSecret);
  }

  /**
   * Verifies the signature and throws on failure. A no-op when no App Secret was
   * configured (nothing to verify against).
   *
   * @param rawBody - The raw, unparsed request body (string, `Uint8Array`/`Buffer` or `ArrayBuffer`).
   * @param signatureHeader - The `X-Hub-Signature-256` header value.
   * @throws {@link WhatsAppWebhookError} when verification fails.
   */
  verifyOrThrow(rawBody: WebhookRawBody, signatureHeader: string | undefined): void {
    if (this.appSecret === undefined) {
      return;
    }
    if (!verifySignature(rawBody, signatureHeader, this.appSecret)) {
      throw new WhatsAppWebhookError('Webhook signature verification failed.');
    }
  }

  /**
   * Verifies (when an App Secret is configured) and parses a webhook delivery.
   *
   * When an App Secret was configured, a missing or invalid signature throws a
   * {@link WhatsAppWebhookError} before parsing. The raw body is used both for
   * signature verification and for parsing.
   *
   * @param rawBody - The raw, unparsed request body (string, `Uint8Array`/`Buffer` or `ArrayBuffer`).
   * @param signatureHeader - The `X-Hub-Signature-256` header value, if present.
   * A body larger than `maxBodyBytes` (default 3 MiB) is rejected before it is
   * hashed or parsed.
   *
   * @throws {@link WhatsAppWebhookError} on an oversized body, failed verification
   *   or malformed payload.
   */
  parse(rawBody: WebhookRawBody, signatureHeader?: string): ParsedWebhook {
    assertBodySize(rawBody, this.maxBodyBytes);
    this.verifyOrThrow(rawBody, signatureHeader);
    const text = decodeBody(rawBody);
    if (text === undefined) {
      throw new WhatsAppWebhookError('Webhook body must be a string, Uint8Array or ArrayBuffer.');
    }
    const raw = parseWebhook(text, { maxBodyBytes: false });
    return {
      messages: extractMessages(raw),
      statuses: extractStatuses(raw),
      raw,
    };
  }
}
