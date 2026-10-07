/**
 * Typed error hierarchy for the WhatsApp Cloud API client.
 *
 * All errors extend {@link WhatsAppError}. Access tokens are NEVER included in
 * any error message or field.
 */

import type { GraphErrorEnvelope } from './types/common.js';

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

/** Graph error codes that always indicate an authentication/authorization problem. */
const AUTH_ERROR_CODES = new Set<number>([0, 190]);

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
const RATE_LIMIT_ERROR_CODES = new Set<number>([130429, 131056, 133016]);

/** Graph error code for messaging outside the 24-hour re-engagement window. */
const RE_ENGAGEMENT_ERROR_CODE = 131047;

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
