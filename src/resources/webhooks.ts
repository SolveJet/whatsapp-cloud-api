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
import { WhatsAppWebhookError } from '../errors.js';
import type {
  IncomingMessage,
  MessageStatus,
  ParsedWebhook,
  WebhookHandlerConfig,
  WebhookPayload,
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
 * @param rawBody - The raw request body (string or Buffer).
 * @param signatureHeader - The `X-Hub-Signature-256` header value, if present.
 * @param appSecret - The App Secret used to compute the expected signature.
 * @returns `true` only when the signature is present, well-formed, and matches.
 */
export const verifySignature = (
  rawBody: string | Buffer,
  signatureHeader: string | undefined,
  appSecret: string,
): boolean => {
  if (typeof signatureHeader !== 'string' || !signatureHeader.startsWith(SIGNATURE_PREFIX)) {
    return false;
  }
  const expected = `${SIGNATURE_PREFIX}${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
  return constantTimeEqual(expected, signatureHeader);
};

/** True when `value` is a non-null object. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Validates the top-level envelope and returns it typed as a
 * {@link WebhookPayload}. Accepts a parsed object or a JSON string (parsed
 * internally). Only the top-level shape is validated (`object` is
 * `whatsapp_business_account` and `entry` is an array); per-message narrowing
 * happens lazily in {@link extractMessages}/{@link extractStatuses} so new Meta
 * message types never break parsing.
 *
 * @param body - A parsed webhook object or its JSON string.
 * @throws {@link WhatsAppWebhookError} when the body is unparseable or malformed.
 */
export const parseWebhook = (body: unknown): WebhookPayload => {
  let parsed: unknown = body;
  if (typeof body === 'string') {
    try {
      parsed = JSON.parse(body);
    } catch (cause) {
      throw new WhatsAppWebhookError('Webhook body is not valid JSON.', { cause });
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

/** Yields each change `value` across all entries, skipping malformed shapes. */
const iterateValues = (payload: WebhookPayload): WebhookValue[] => {
  const values: WebhookValue[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value;
      if (isRecord(value)) {
        values.push(value as WebhookValue);
      }
    }
  }
  return values;
};

/**
 * Flattens all inbound messages across `entry[].changes[].value`. Returns an
 * empty array when the payload carries none.
 */
export const extractMessages = (payload: WebhookPayload): IncomingMessage[] => {
  const messages: IncomingMessage[] = [];
  for (const value of iterateValues(payload)) {
    if (isMessageEvent(value)) {
      messages.push(...value.messages);
    }
  }
  return messages;
};

/**
 * Flattens all message status updates across `entry[].changes[].value`. Returns
 * an empty array when the payload carries none.
 */
export const extractStatuses = (payload: WebhookPayload): MessageStatus[] => {
  const statuses: MessageStatus[] = [];
  for (const value of iterateValues(payload)) {
    if (isStatusEvent(value)) {
      statuses.push(...value.statuses);
    }
  }
  return statuses;
};

/**
 * Framework-agnostic webhook handler binding a verify token and/or App Secret.
 *
 * It imports no web framework; the caller wires it into their HTTP layer,
 * passing the raw request body for signature verification. See the README for a
 * complete Express example.
 */
export class WebhookHandler {
  private readonly appSecret?: string;
  private readonly verifyToken?: string;

  constructor(config: WebhookHandlerConfig = {}) {
    if (config.appSecret !== undefined) {
      this.appSecret = config.appSecret;
    }
    if (config.verifyToken !== undefined) {
      this.verifyToken = config.verifyToken;
    }
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
   * @param rawBody - The raw, unparsed request body bytes.
   * @param signatureHeader - The `X-Hub-Signature-256` header value.
   */
  isValid(rawBody: string | Buffer, signatureHeader: string | undefined): boolean {
    if (this.appSecret === undefined) {
      return false;
    }
    return verifySignature(rawBody, signatureHeader, this.appSecret);
  }

  /**
   * Verifies the signature and throws on failure. A no-op when no App Secret was
   * configured (nothing to verify against).
   *
   * @param rawBody - The raw, unparsed request body bytes.
   * @param signatureHeader - The `X-Hub-Signature-256` header value.
   * @throws {@link WhatsAppWebhookError} when verification fails.
   */
  verifyOrThrow(rawBody: string | Buffer, signatureHeader: string | undefined): void {
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
   * @param rawBody - The raw, unparsed request body bytes.
   * @param signatureHeader - The `X-Hub-Signature-256` header value, if present.
   * @throws {@link WhatsAppWebhookError} on failed verification or malformed payload.
   */
  parse(rawBody: string | Buffer, signatureHeader?: string): ParsedWebhook {
    this.verifyOrThrow(rawBody, signatureHeader);
    const raw = parseWebhook(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'));
    return {
      messages: extractMessages(raw),
      statuses: extractStatuses(raw),
      raw,
    };
  }
}
