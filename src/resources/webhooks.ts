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
  ParsedWebhook,
  WebhookHandlerConfig,
  WebhookRawBody,
  WebhookVerificationResult,
} from '../types/webhooks.js';
import {
  assertBodySize,
  decodeBody,
  extractMessages,
  extractStatuses,
  isMessageEvent,
  isNonEmptyString,
  isStatusEvent,
  parseWebhook,
  resolveMaxBodyBytes,
  toHashable,
  warnUnsignedOnce,
} from './webhook-core.js';

export { extractMessages, extractStatuses, isMessageEvent, isStatusEvent, parseWebhook };

export type { WebhookVerificationResult };

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
 * @param appSecret - The App Secret used to compute the expected signature, or
 *   an array of secrets to accept during rotation. Every secret is checked
 *   (there is no early exit); empty or non-string entries are ignored.
 * @returns `true` only when the signature is present, well-formed, and matches
 *   at least one secret. Returns `false` when no usable secret is given, so an
 *   empty key can never validate a signature.
 */
export const verifySignature = (
  rawBody: WebhookRawBody,
  signatureHeader: string | undefined,
  appSecret: string | readonly string[],
): boolean => {
  const secrets: readonly unknown[] = Array.isArray(appSecret)
    ? (appSecret as readonly unknown[])
    : [appSecret];
  const hashable = toHashable(rawBody);
  if (hashable === undefined) {
    return false;
  }
  if (typeof signatureHeader !== 'string' || !signatureHeader.startsWith(SIGNATURE_PREFIX)) {
    return false;
  }
  let valid = false;
  for (const secret of secrets) {
    if (!isNonEmptyString(secret)) {
      continue;
    }
    const expected = `${SIGNATURE_PREFIX}${createHmac('sha256', secret).update(hashable).digest('hex')}`;
    if (constantTimeEqual(expected, signatureHeader)) {
      valid = true;
    }
  }
  return valid;
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
  private readonly appSecrets?: readonly string[];
  private readonly allowUnsigned: boolean;
  private readonly verifyToken?: string;
  private readonly maxBodyBytes: number | false;

  /**
   * @throws {@link WhatsAppWebhookError} when `appSecret` or `verifyToken` is
   *   present in `config` but is not a non-empty string.
   */
  constructor(config: WebhookHandlerConfig = {}) {
    if (Object.hasOwn(config, 'appSecret')) {
      const configured: unknown = config.appSecret;
      if (Array.isArray(configured)) {
        if (configured.length === 0) {
          throw new WhatsAppWebhookError(
            'WebhookHandler config "appSecret" was provided as an empty array. ' +
              'Omit the key to disable it, or check the environment variable it comes from.',
          );
        }
        this.appSecrets = (configured as unknown[]).map((secret) =>
          requireConfiguredSecret(secret, 'appSecret'),
        );
      } else {
        this.appSecrets = [requireConfiguredSecret(configured, 'appSecret')];
      }
    }
    this.allowUnsigned = config.allowUnsigned === true;
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
    if (this.appSecrets === undefined) {
      return false;
    }
    return verifySignature(rawBody, signatureHeader, this.appSecrets);
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
    if (this.appSecrets === undefined) {
      return;
    }
    if (!verifySignature(rawBody, signatureHeader, this.appSecrets)) {
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
    if (this.appSecrets === undefined && !this.allowUnsigned) {
      warnUnsignedOnce();
    }
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
