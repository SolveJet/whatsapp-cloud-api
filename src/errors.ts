/**
 * Typed error hierarchy for the WhatsApp Cloud API client.
 *
 * All errors extend {@link WhatsAppError}. Access tokens are NEVER included in
 * any error message or field.
 */

import type { GraphErrorEnvelope } from './types/common.js';

/**
 * Ergonomic constants for common WhatsApp Cloud API (Graph) error codes.
 *
 * These mirror the numeric `code` values Meta returns in a Graph error
 * envelope, so callers can compare `err.code` against a named constant instead
 * of a magic number. Values are authoritative per the WhatsApp Cloud API error
 * reference; the map is frozen (`as const`) and acts as the single source of
 * truth for the code sets used by this module's error mapping.
 *
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
 */
export const WhatsAppErrorCode = Object.freeze({
  /** Generic authentication exception; also the sentinel for an unparseable code. */
  AUTH_EXCEPTION: 0,
  /** Permission denied for the attempted capability. */
  PERMISSION_DENIED: 10,
  /** Unsupported or unknown API method/request. */
  API_METHOD: 100,
  /** The access token has expired and must be refreshed. */
  ACCESS_TOKEN_EXPIRED: 190,
  /** The phone number provided is invalid. */
  INVALID_PHONE_NUMBER: 1013,
  /** Account/throughput rate limit hit; retry after a backoff. */
  RATE_LIMIT_HIT: 130429,
  /** Message undeliverable (e.g. recipient cannot receive it). */
  MESSAGE_UNDELIVERABLE: 131026,
  /** The WhatsApp Business Account is restricted or locked. */
  BUSINESS_ACCOUNT_RESTRICTED: 131031,
  /** A re-engagement (free-form) message was sent outside the 24-hour window. */
  RE_ENGAGEMENT_MESSAGE: 131047,
  /** Spam rate limit hit due to prior message quality/engagement. */
  SPAM_RATE_LIMIT_HIT: 131048,
  /** Media could not be downloaded from the provided source. */
  MEDIA_DOWNLOAD_ERROR: 131053,
  /** Too many messages sent to this recipient in a short period. */
  TOO_MANY_MESSAGES: 131056,
  /** Template parameters do not match the approved template. */
  TEMPLATE_PARAM_MISMATCH: 132000,
  /** The referenced template does not exist (name/language mismatch). */
  TEMPLATE_NOT_EXIST: 132001,
  /** The account has reached a messaging/registration limit. */
  ACCOUNT_LIMIT_REACHED: 133016,
} as const);

/** A numeric value from the {@link WhatsAppErrorCode} map. */
export type WhatsAppErrorCodeValue = (typeof WhatsAppErrorCode)[keyof typeof WhatsAppErrorCode];

/** Base error for all failures surfaced by this SDK. */
export class WhatsAppError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'WhatsAppError';
  }
}

/** Fields describing a Graph API error response. */
export interface WhatsAppApiErrorFields {
  /** HTTP status code of the failing response. */
  httpStatus: number;
  /** Numeric Graph API error code. */
  code: number;
  /** More granular numeric subcode, when present. */
  subcode?: number;
  /** Error category, e.g. `OAuthException`. */
  type?: string;
  /** Additional details from the error envelope. */
  details?: string;
  /** Internal trace identifier for Meta support. */
  fbtraceId?: string;
  /** The raw parsed body (envelope or text) for debugging. */
  raw: unknown;
}

/** Thrown for non-2xx responses carrying a parseable Graph error envelope. */
export class WhatsAppApiError extends WhatsAppError {
  readonly httpStatus: number;
  readonly code: number;
  readonly subcode?: number;
  readonly type?: string;
  readonly details?: string;
  readonly fbtraceId?: string;
  readonly raw: unknown;

  constructor(message: string, fields: WhatsAppApiErrorFields, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'WhatsAppApiError';
    this.httpStatus = fields.httpStatus;
    this.code = fields.code;
    if (fields.subcode !== undefined) {
      this.subcode = fields.subcode;
    }
    if (fields.type !== undefined) {
      this.type = fields.type;
    }
    if (fields.details !== undefined) {
      this.details = fields.details;
    }
    if (fields.fbtraceId !== undefined) {
      this.fbtraceId = fields.fbtraceId;
    }
    this.raw = fields.raw;
  }
}

/** Thrown for authentication/authorization failures (HTTP 401/403 or auth codes). */
export class WhatsAppAuthenticationError extends WhatsAppApiError {
  constructor(message: string, fields: WhatsAppApiErrorFields, options?: { cause?: unknown }) {
    super(message, fields, options);
    this.name = 'WhatsAppAuthenticationError';
  }
}

/** Thrown for rate-limit/throttling failures (HTTP 429 or rate-limit codes). */
export class WhatsAppRateLimitError extends WhatsAppApiError {
  /** Server-advised wait before retrying, in milliseconds, when available. */
  retryAfterMs?: number;

  constructor(message: string, fields: WhatsAppApiErrorFields, options?: { cause?: unknown }) {
    super(message, fields, options);
    this.name = 'WhatsAppRateLimitError';
  }
}

/** Thrown when messaging is blocked by the 24-hour customer service window. */
export class WhatsAppReEngagementError extends WhatsAppApiError {
  constructor(message: string, fields: WhatsAppApiErrorFields, options?: { cause?: unknown }) {
    super(message, fields, options);
    this.name = 'WhatsAppReEngagementError';
  }
}

/** Thrown for network, abort, or timeout failures before a response is received. */
export class WhatsAppRequestError extends WhatsAppError {
  /** True when the failure was caused by the client-side timeout. */
  readonly isTimeout: boolean;

  constructor(message: string, options?: { cause?: unknown; isTimeout?: boolean }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'WhatsAppRequestError';
    this.isTimeout = options?.isTimeout ?? false;
  }
}

/** Thrown for boundary misuse detected before a request is sent. */
export class WhatsAppValidationError extends WhatsAppError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'WhatsAppValidationError';
  }
}

/**
 * Thrown for malformed or unparseable webhook payloads and for webhook
 * signature-verification failures. Its message NEVER contains the app secret,
 * verify token, or signature header.
 */
export class WhatsAppWebhookError extends WhatsAppError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'WhatsAppWebhookError';
  }
}

/** Graph error codes that always indicate an authentication/authorization problem. */
const AUTH_ERROR_CODES = new Set<number>([
  WhatsAppErrorCode.AUTH_EXCEPTION,
  WhatsAppErrorCode.ACCESS_TOKEN_EXPIRED,
]);

/** True when the status/code pair indicates an auth failure per Meta guidance. */
const isAuthError = (httpStatus: number, code: number): boolean => {
  if (httpStatus === 401 || httpStatus === 403) {
    return true;
  }
  // Code 0 is the sentinel used for responses with no parseable Graph code; it
  // must not shadow the rate-limit mapping for a plain HTTP 429.
  if (httpStatus === 429) {
    return false;
  }
  return AUTH_ERROR_CODES.has(code);
};

/** Graph error codes that indicate a rate-limit/throttling condition. */
const RATE_LIMIT_ERROR_CODES = new Set<number>([
  WhatsAppErrorCode.RATE_LIMIT_HIT,
  WhatsAppErrorCode.TOO_MANY_MESSAGES,
  WhatsAppErrorCode.ACCOUNT_LIMIT_REACHED,
]);

/** Graph error code for messaging outside the 24-hour re-engagement window. */
const RE_ENGAGEMENT_ERROR_CODE = WhatsAppErrorCode.RE_ENGAGEMENT_MESSAGE;

/** True when the status/code pair indicates a rate-limit/throttling failure. */
const isRateLimitError = (httpStatus: number, code: number): boolean =>
  httpStatus === 429 || RATE_LIMIT_ERROR_CODES.has(code);

/** True when the code indicates a re-engagement (24-hour window) failure. */
const isReEngagementError = (code: number): boolean => code === RE_ENGAGEMENT_ERROR_CODE;

/** Selects the typed error class for a status/code pair, in priority order. */
const selectApiError = (
  httpStatus: number,
  code: number,
  message: string,
  fields: WhatsAppApiErrorFields,
): WhatsAppApiError => {
  if (isAuthError(httpStatus, code)) {
    return new WhatsAppAuthenticationError(message, fields);
  }
  if (isRateLimitError(httpStatus, code)) {
    return new WhatsAppRateLimitError(message, fields);
  }
  if (isReEngagementError(code)) {
    return new WhatsAppReEngagementError(message, fields);
  }
  return new WhatsAppApiError(message, fields);
};

/**
 * Builds a {@link WhatsAppApiError} (or {@link WhatsAppAuthenticationError}) from a
 * non-2xx response. The envelope is used when parseable; otherwise `bodyText` and
 * the status drive a generic API error.
 */
export const errorFromResponse = (
  httpStatus: number,
  envelope: GraphErrorEnvelope | undefined,
  bodyText?: string,
): WhatsAppApiError => {
  if (envelope !== undefined) {
    const { error } = envelope;
    const fields: WhatsAppApiErrorFields = {
      httpStatus,
      code: error.code,
      raw: envelope,
      ...(error.error_subcode !== undefined ? { subcode: error.error_subcode } : {}),
      ...(error.type !== undefined ? { type: error.type } : {}),
      ...(error.error_data?.details !== undefined ? { details: error.error_data.details } : {}),
      ...(error.fbtrace_id !== undefined ? { fbtraceId: error.fbtrace_id } : {}),
    };
    return selectApiError(httpStatus, error.code, error.message, fields);
  }

  const message = `WhatsApp Cloud API request failed with HTTP ${httpStatus}.`;
  const fields: WhatsAppApiErrorFields = {
    httpStatus,
    code: 0,
    raw: bodyText ?? null,
  };
  return selectApiError(httpStatus, 0, message, fields);
};
