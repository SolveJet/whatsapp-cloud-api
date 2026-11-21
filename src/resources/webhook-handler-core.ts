/**
 * Event-driven webhook handler shared by every entry point. The signature
 * check is injected, so this module has no Node-only imports and works on any
 * runtime that provides `Request`, `Response` and `TextEncoder`.
 */
import { WhatsAppWebhookError } from '../errors.js';
import type {
  WebhookContext,
  WebhookEvent,
  WebhookEventMap,
  WebhookEventName,
} from '../types/webhook-events.js';
import type { WebhookRawBody, WebhookVerificationResult } from '../types/webhooks.js';
import type { WebhookDedupe } from './webhook-dedupe.js';
import { isNonEmptyString, resolveMaxBodyBytes, warnUnsignedOnce } from './webhook-core.js';
import { parseWebhookEvents } from './webhook-events.js';

/** Checks a signature header against the raw body for any of the secrets. */
export type WebhookSignatureVerifier = (
  rawBody: WebhookRawBody,
  signatureHeader: string | undefined,
  secrets: readonly string[],
) => Promise<boolean>;

/** Per-tenant settings that override the handler-wide options. */
export interface WebhookTenant {
  /** App Secret, or several to accept during rotation. */
  appSecrets?: string | readonly string[];
  /** Verify token for the GET handshake. */
  verifyToken?: string;
}

/** Where a failed event came from, passed to `onError`. Empty for envelope errors. */
export interface WebhookErrorInfo {
  /** The event being handled when the error happened. */
  event?: WebhookEvent;
  /** The context of that event. */
  ctx?: WebhookContext;
}

/** A function registered with {@link WebhookHandlerApi.on}. */
export type WebhookHandlerFn<N extends WebhookEventName> = (
  event: WebhookEventMap[N],
) => void | Promise<void>;

/** Outcome of one delivery. */
export interface WebhookDeliveryResult {
  /** `true` once the signature and the envelope are valid. */
  accepted: boolean;
  /** The HTTP status to answer with. */
  httpStatus: 200 | 401 | 413 | 500;
  /** Events passed to their handlers without error. */
  delivered: number;
  /** Events skipped because the dedupe store had seen them. */
  skippedDuplicates: number;
  /** Events skipped because they were older than `maxEventAgeSeconds`. */
  skippedStale: number;
  /** Events where at least one handler threw. */
  failed: number;
}

/** Options accepted by `handleDelivery` and `handleRequest`. */
export interface WebhookRequestOptions {
  /** Keeps a serverless invocation alive for background work (`ackMode: 'before'`). */
  waitUntil?: (promise: Promise<unknown>) => void;
  /** Overrides the secrets and verify token for this call. */
  tenant?: WebhookTenant;
}

/** Options for `createWebhookHandler`. */
export interface CreateWebhookHandlerOptions extends WebhookTenant {
  /**
   * Picks the tenant for a request, for apps that serve several WhatsApp apps.
   * Used by `handleRequest`. Returning `undefined` rejects the request (401 on
   * POST, 403 on GET).
   */
  resolveTenant?: (
    request: Request,
  ) => WebhookTenant | undefined | Promise<WebhookTenant | undefined>;
  /** Accept unsigned deliveries without the one-time warning. Only matters when no secret is set. */
  allowUnsigned?: boolean;
  /** Largest accepted body in bytes. Defaults to 3 MiB; `false` disables the check. */
  maxBodyBytes?: number | false;
  /** Skip message and status events older than this many seconds. */
  maxEventAgeSeconds?: number;
  /** Store used to skip events delivered more than once. */
  dedupe?: WebhookDedupe;
  /** Builds the dedupe key. Return `undefined` to skip dedupe for that event. */
  dedupeKey?: (event: WebhookEvent) => string | undefined;
  /**
   * `'after'` (default) runs the handlers before answering. `'before'` answers
   * once the delivery is verified and parsed, and runs the handlers in the background.
   */
  ackMode?: 'before' | 'after';
  /** Default `waitUntil` for `ackMode: 'before'`. */
  waitUntil?: (promise: Promise<unknown>) => void;
  /** With `ackMode: 'after'`, answer 500 when a handler throws so Meta redelivers. */
  retryOnHandlerError?: boolean;
  /** Events handled at the same time within one delivery. Defaults to 8. */
  concurrency?: number;
  /** Receives handler errors and invalid envelopes. Defaults to `console.error`. */
  onError?: (error: unknown, info: WebhookErrorInfo) => void;
}

/** The object returned by `createWebhookHandler`. */
export interface WebhookHandlerApi {
  /** Registers a handler for an event name. Returns a function that removes it. */
  on<N extends WebhookEventName>(name: N, handler: WebhookHandlerFn<N>): () => void;
  /** Answers the GET handshake from a query map or `URLSearchParams`. */
  handleVerification(
    query: Record<string, string | undefined> | URLSearchParams,
    options?: { tenant?: WebhookTenant },
  ): WebhookVerificationResult;
  /** Verifies, parses and dispatches one raw delivery body. */
  handleDelivery(
    rawBody: WebhookRawBody,
    signatureHeader: string | undefined,
    options?: WebhookRequestOptions,
  ): Promise<WebhookDeliveryResult>;
  /** Handles a fetch-style `Request` (GET handshake or POST delivery) and returns a `Response`. */
  handleRequest(
    request: Request,
    options?: Omit<WebhookRequestOptions, 'tenant'>,
  ): Promise<Response>;
}

const DEFAULT_CONCURRENCY = 8;

type Handler = (event: WebhookEvent) => void | Promise<void>;

const normalizeSecrets = (value: unknown, name: string): readonly string[] => {
  const list: unknown[] = Array.isArray(value) ? (value as unknown[]) : [value];
  if (list.length === 0 || !list.every(isNonEmptyString)) {
    throw new WhatsAppWebhookError(
      `Webhook handler "${name}" must be a non-empty string or a non-empty array of non-empty strings.`,
    );
  }
  return list as string[];
};

/** Secrets of a tenant given at call time; unusable values yield an empty list (fail closed). */
const lenientSecrets = (value: unknown): readonly string[] => {
  const list: unknown[] = Array.isArray(value) ? (value as unknown[]) : [value];
  return list.filter(isNonEmptyString);
};

const encoder = new TextEncoder();

/** Compares two strings in time that depends only on their length, not on where they differ. */
const tokenEquals = (a: string, b: string): boolean => {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return diff === 0;
};

const defaultDedupeKey = (event: WebhookEvent): string | undefined => {
  if (event.name === 'message') {
    return `message:${event.message.id}`;
  }
  if (event.name === 'status') {
    return `status:${event.status.id}:${event.status.status}`;
  }
  return undefined;
};

const eventTimestamp = (event: WebhookEvent): string | number | undefined => {
  if (event.name === 'message') {
    return event.message.timestamp;
  }
  if (event.name === 'status') {
    return event.status.timestamp;
  }
  return event.ctx.time;
};

const textResponse = (
  status: number,
  body: string,
  headers: Record<string, string> = {},
): Response =>
  new Response(body, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', ...headers },
  });

/** Reads a request body, giving up once it exceeds `limit`. Returns `undefined` when too large. */
const readBody = async (
  request: Request,
  limit: number | false,
): Promise<Uint8Array | undefined> => {
  if (request.body === null) {
    return new Uint8Array(0);
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (limit !== false && total > limit) {
      await reader.cancel().catch(() => undefined);
      return undefined;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
};

const runPool = async <T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> => {
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      if (item !== undefined) {
        await worker(item);
      }
    }
  });
  await Promise.all(lanes);
};

/**
 * Builds a webhook handler around an injected signature verifier.
 *
 * @throws {@link WhatsAppWebhookError} for empty secrets, a `concurrency` that is not a
 *   positive integer, an unknown `ackMode`, or an invalid `maxBodyBytes`.
 */
export const createWebhookHandlerCore = (
  verify: WebhookSignatureVerifier,
  options: CreateWebhookHandlerOptions = {},
): WebhookHandlerApi => {
  const defaultSecrets =
    options.appSecrets === undefined
      ? undefined
      : normalizeSecrets(options.appSecrets, 'appSecrets');
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
    throw new WhatsAppWebhookError('Webhook handler "concurrency" must be a positive integer.');
  }
  const ackMode = options.ackMode ?? 'after';
  if (ackMode !== 'before' && ackMode !== 'after') {
    throw new WhatsAppWebhookError('Webhook handler "ackMode" must be "before" or "after".');
  }
  const maxAge = options.maxEventAgeSeconds;
  if (
    maxAge !== undefined &&
    (typeof maxAge !== 'number' || !Number.isFinite(maxAge) || maxAge < 0)
  ) {
    throw new WhatsAppWebhookError(
      'Webhook handler "maxEventAgeSeconds" must be a non-negative number.',
    );
  }
  const maxBodyBytes = resolveMaxBodyBytes(options.maxBodyBytes);
  const retryOnHandlerError = options.retryOnHandlerError === true;
  const dedupe = options.dedupe;
  const dedupeKey = options.dedupeKey ?? defaultDedupeKey;
  const handlers = new Map<WebhookEventName, Set<Handler>>();

  const report = (error: unknown, info: WebhookErrorInfo): void => {
    try {
      if (options.onError !== undefined) {
        options.onError(error, info);
      } else {
        console.error(error);
      }
    } catch {
      // A failing error hook must not break the delivery.
    }
  };

  const secretsFor = (tenant: WebhookTenant | undefined): readonly string[] | undefined => {
    if (tenant?.appSecrets !== undefined) {
      return lenientSecrets(tenant.appSecrets);
    }
    return defaultSecrets;
  };

  const dispatch = async (
    events: readonly WebhookEvent[],
    snapshot: ReadonlyMap<WebhookEventName, readonly Handler[]>,
  ): Promise<WebhookDeliveryResult> => {
    const result: WebhookDeliveryResult = {
      accepted: true,
      httpStatus: 200,
      delivered: 0,
      skippedDuplicates: 0,
      skippedStale: 0,
      failed: 0,
    };
    const nowSeconds = Date.now() / 1000;
    await runPool(events, concurrency, async (event) => {
      if (maxAge !== undefined) {
        const raw = eventTimestamp(event);
        const seconds = typeof raw === 'number' ? raw : raw === undefined ? NaN : Number(raw);
        if (Number.isFinite(seconds) && nowSeconds - seconds > maxAge) {
          result.skippedStale += 1;
          return;
        }
      }
      let key: string | undefined;
      if (dedupe !== undefined) {
        try {
          key = dedupeKey(event);
          if (key !== undefined && (await dedupe.seen(key))) {
            result.skippedDuplicates += 1;
            return;
          }
        } catch (error) {
          report(error, { event, ctx: event.ctx });
        }
      }
      let failed = false;
      for (const handler of snapshot.get(event.name) ?? []) {
        try {
          await handler(event);
        } catch (error) {
          failed = true;
          report(error, { event, ctx: event.ctx });
        }
      }
      if (!failed) {
        result.delivered += 1;
        return;
      }
      result.failed += 1;
      if (retryOnHandlerError && dedupe?.forget !== undefined && key !== undefined) {
        try {
          await dedupe.forget(key);
        } catch (error) {
          report(error, { event, ctx: event.ctx });
        }
      }
    });
    if (ackMode === 'after' && retryOnHandlerError && result.failed > 0) {
      result.httpStatus = 500;
    }
    return result;
  };

  const rejected = (httpStatus: 401 | 413): WebhookDeliveryResult => ({
    accepted: false,
    httpStatus,
    delivered: 0,
    skippedDuplicates: 0,
    skippedStale: 0,
    failed: 0,
  });

  const api: WebhookHandlerApi = {
    on<N extends WebhookEventName>(name: N, handler: WebhookHandlerFn<N>): () => void {
      const wrapped: Handler = (event) =>
        event.name === name ? handler(event as WebhookEventMap[N]) : undefined;
      let set = handlers.get(name);
      if (set === undefined) {
        set = new Set();
        handlers.set(name, set);
      }
      set.add(wrapped);
      return () => {
        handlers.get(name)?.delete(wrapped);
      };
    },

    handleVerification(query, requestOptions = {}) {
      const get = (key: string): string | undefined =>
        query instanceof URLSearchParams ? (query.get(key) ?? undefined) : query[key];
      const expected = requestOptions.tenant?.verifyToken ?? options.verifyToken;
      const token = get('hub.verify_token');
      if (
        get('hub.mode') === 'subscribe' &&
        isNonEmptyString(expected) &&
        typeof token === 'string' &&
        tokenEquals(token, expected)
      ) {
        return { statusCode: 200, body: get('hub.challenge') ?? '' };
      }
      return { statusCode: 403, body: 'Forbidden' };
    },

    async handleDelivery(rawBody, signatureHeader, requestOptions = {}) {
      const secrets = secretsFor(requestOptions.tenant);
      if (secrets !== undefined) {
        let valid: boolean;
        try {
          valid = secrets.length > 0 && (await verify(rawBody, signatureHeader, secrets));
        } catch {
          valid = false;
        }
        if (!valid) {
          return rejected(401);
        }
      } else if (options.allowUnsigned !== true) {
        warnUnsignedOnce();
      }

      let events: WebhookEvent[];
      try {
        events = parseWebhookEvents(rawBody, { maxBodyBytes });
      } catch (error) {
        report(error, {});
        return { ...rejected(401), httpStatus: 200 };
      }

      const snapshot = new Map<WebhookEventName, readonly Handler[]>();
      for (const [name, set] of handlers) {
        snapshot.set(name, [...set]);
      }

      if (ackMode === 'before') {
        const background = dispatch(events, snapshot).catch((error: unknown) => {
          report(error, {});
        });
        const waitUntil = requestOptions.waitUntil ?? options.waitUntil;
        if (waitUntil !== undefined) {
          waitUntil(background);
        }
        return { ...rejected(401), accepted: true, httpStatus: 200 };
      }
      return dispatch(events, snapshot);
    },

    async handleRequest(request, requestOptions = {}) {
      if (request.method === 'GET') {
        let tenant: WebhookTenant | undefined;
        if (options.resolveTenant !== undefined) {
          tenant = await options.resolveTenant(request);
          if (tenant === undefined) {
            return textResponse(403, 'Forbidden');
          }
        }
        const result = api.handleVerification(new URL(request.url).searchParams, {
          ...(tenant !== undefined ? { tenant } : {}),
        });
        return textResponse(result.statusCode, result.body);
      }
      if (request.method !== 'POST') {
        return textResponse(405, 'Method Not Allowed', { allow: 'GET, POST' });
      }

      let tenant: WebhookTenant | undefined;
      if (options.resolveTenant !== undefined) {
        tenant = await options.resolveTenant(request);
        if (tenant === undefined) {
          return textResponse(401, 'Unauthorized');
        }
      }
      if (maxBodyBytes !== false) {
        const declared = Number(request.headers.get('content-length'));
        if (Number.isFinite(declared) && declared > maxBodyBytes) {
          return textResponse(413, 'Payload Too Large');
        }
      }
      let body: Uint8Array | undefined;
      try {
        body = await readBody(request, maxBodyBytes);
      } catch {
        return textResponse(400, 'Bad Request');
      }
      if (body === undefined) {
        return textResponse(413, 'Payload Too Large');
      }
      const result = await api.handleDelivery(
        body,
        request.headers.get('x-hub-signature-256') ?? undefined,
        {
          ...(requestOptions.waitUntil !== undefined
            ? { waitUntil: requestOptions.waitUntil }
            : {}),
          ...(tenant !== undefined ? { tenant } : {}),
        },
      );
      switch (result.httpStatus) {
        case 401:
          return textResponse(401, 'Unauthorized');
        case 413:
          return textResponse(413, 'Payload Too Large');
        case 500:
          return textResponse(500, 'Internal Server Error');
        default:
          return textResponse(200, 'OK');
      }
    },
  };
  return api;
};
