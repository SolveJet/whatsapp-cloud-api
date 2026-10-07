/**
 * Resource-agnostic HTTP core for the WhatsApp Cloud API client.
 *
 * Built exclusively on Node 20+ global `fetch`, `AbortController`, and
 * `AbortSignal`. Handles timeouts, retries with jittered exponential backoff,
 * and conversion of transport/HTTP failures into the typed error hierarchy.
 * This layer knows nothing about messages or any specific resource.
 */

import {
  WhatsAppApiError,
  WhatsAppRequestError,
  WhatsAppValidationError,
  errorFromResponse,
} from './errors.js';
import type { GraphErrorEnvelope, RequestOptions } from './types/common.js';

/** Configuration for an {@link HttpClient} instance. */
export interface HttpClientConfig {
  /** Access token used for the `Authorization: Bearer` header. */
  accessToken: string;
  /** Fully resolved, versioned base URL, e.g. `https://graph.facebook.com/v23.0`. */
  baseUrl: string;
  /** Per-attempt timeout in milliseconds. */
  timeoutMs: number;
  /** Maximum number of retries (total attempts = maxRetries + 1). */
  maxRetries: number;
  /** Injectable delay used for backoff; overridable so tests can fake timers. */
  delay?: (ms: number) => Promise<void>;
}

/** Default sleep implementation backing retry backoff. */
const defaultDelay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** Base backoff in milliseconds before jitter. */
const BASE_BACKOFF_MS = 300;
/** Exponential growth factor applied per attempt. */
const BACKOFF_FACTOR = 2;

/** True when an HTTP status is eligible for a retry (429 or any 5xx). */
const isRetryableStatus = (status: number): boolean => status === 429 || status >= 500;

/** Parses a `Retry-After` header (delta-seconds or HTTP-date) into milliseconds. */
const parseRetryAfter = (headerValue: string | null): number | undefined => {
  if (headerValue === null) {
    return undefined;
  }
  const seconds = Number(headerValue);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }
  const dateMs = Date.parse(headerValue);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }
  return undefined;
};

/** Attempts to parse response text as a Graph error envelope. */
const parseEnvelope = (text: string): GraphErrorEnvelope | undefined => {
  try {
    const parsed: unknown = JSON.parse(text);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'error' in parsed &&
      typeof (parsed as { error: unknown }).error === 'object' &&
      (parsed as { error: unknown }).error !== null
    ) {
      return parsed as GraphErrorEnvelope;
    }
  } catch {
    return undefined;
  }
  return undefined;
};

/** Minimal HTTP client that executes typed requests against the Graph API. */
export class HttpClient {
  private readonly accessToken: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly delay: (ms: number) => Promise<void>;

  constructor(config: HttpClientConfig) {
    this.accessToken = config.accessToken;
    this.baseUrl = config.baseUrl;
    this.timeoutMs = config.timeoutMs;
    this.maxRetries = config.maxRetries;
    this.delay = config.delay ?? defaultDelay;
  }

  /** Executes a request, applying timeout and the retry policy, and returns parsed JSON. */
  async request<T>({ method, path, body, signal }: RequestOptions): Promise<T> {
    const url = `${this.baseUrl}/${path.replace(/^\/+/, '')}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
    };
    let serializedBody: string | undefined;
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      serializedBody = JSON.stringify(body);
    }

    let attempt = 0;
    for (;;) {
      try {
        return await this.attempt<T>(url, method, headers, serializedBody, signal);
      } catch (error) {
        const retryable = this.isRetryable(error);
        const retryAfterMs = this.retryAfterFromError(error);
        if (!retryable || attempt >= this.maxRetries) {
          throw error;
        }
        const waitMs = retryAfterMs ?? this.backoffMs(attempt);
        await this.delay(waitMs);
        attempt += 1;
      }
    }
  }

  /** Performs a single HTTP attempt, converting failures into typed errors. */
  private async attempt<T>(
    url: string,
    method: string,
    headers: Record<string, string>,
    body: string | undefined,
    callerSignal: AbortSignal | undefined,
  ): Promise<T> {
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => {
      timeoutController.abort();
    }, this.timeoutMs);

    const onCallerAbort = (): void => {
      timeoutController.abort();
    };
    if (callerSignal !== undefined) {
      if (callerSignal.aborted) {
        timeoutController.abort();
      } else {
        callerSignal.addEventListener('abort', onCallerAbort, { once: true });
      }
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        ...(body !== undefined ? { body } : {}),
        signal: timeoutController.signal,
      });
    } catch (cause) {
      // The timeout controller aborted but the caller did not: this is a timeout.
      const isTimeout = timeoutController.signal.aborted && callerSignal?.aborted !== true;
      const message = isTimeout
        ? `WhatsApp Cloud API request timed out after ${this.timeoutMs}ms.`
        : 'WhatsApp Cloud API request failed before a response was received.';
      throw new WhatsAppRequestError(message, { cause, isTimeout });
    } finally {
      clearTimeout(timeoutId);
      if (callerSignal !== undefined) {
        callerSignal.removeEventListener('abort', onCallerAbort);
      }
    }

    const text = await response.text();

    if (response.ok) {
      if (text.length === 0) {
        return undefined as T;
      }
      try {
        return JSON.parse(text) as T;
      } catch (cause) {
        throw new WhatsAppRequestError('Failed to parse WhatsApp Cloud API response as JSON.', {
          cause,
        });
      }
    }

    const envelope = parseEnvelope(text);
    const apiError = errorFromResponse(response.status, envelope, text);
    const retryAfterMs = parseRetryAfter(response.headers.get('retry-after'));
    if (retryAfterMs !== undefined) {
      retryAfterByError.set(apiError, retryAfterMs);
    }
    throw apiError;
  }

  /** Decides whether an error from an attempt should be retried. */
  private isRetryable(error: unknown): boolean {
    if (error instanceof WhatsAppValidationError) {
      return false;
    }
    if (error instanceof WhatsAppRequestError) {
      return true;
    }
    if (error instanceof WhatsAppApiError) {
      return isRetryableStatus(error.httpStatus);
    }
    return false;
  }

  /** Extracts a server-provided Retry-After delay (ms) associated with an error. */
  private retryAfterFromError(error: unknown): number | undefined {
    if (error instanceof WhatsAppApiError) {
      return retryAfterByError.get(error);
    }
    return undefined;
  }

  /** Computes exponential backoff with full jitter for the given attempt. */
  private backoffMs(attempt: number): number {
    const ceiling = BASE_BACKOFF_MS * BACKOFF_FACTOR ** attempt;
    return Math.random() * ceiling;
  }
}

/** Associates a parsed API error with a server Retry-After hint (ms). */
const retryAfterByError = new WeakMap<WhatsAppApiError, number>();
