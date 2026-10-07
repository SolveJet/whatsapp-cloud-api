import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpClient } from '../src/http.js';
import {
  WhatsAppApiError,
  WhatsAppAuthenticationError,
  WhatsAppRateLimitError,
  WhatsAppReEngagementError,
  errorFromResponse,
} from '../src/errors.js';

const BASE_URL = 'https://graph.facebook.com/v23.0';

const makeClient = (overrides?: { maxRetries?: number; timeoutMs?: number }): HttpClient =>
  new HttpClient({
    accessToken: 'secret-token',
    baseUrl: BASE_URL,
    timeoutMs: overrides?.timeoutMs ?? 30000,
    maxRetries: overrides?.maxRetries ?? 2,
    // Resolve immediately so backoff never actually sleeps.
    delay: () => Promise.resolve(),
  });

const jsonResponse = (
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> },
): Response =>
  new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });

const errorEnvelope = (code: number, subcode?: number): Record<string, unknown> => ({
  error: {
    message: 'Something went wrong',
    type: 'OAuthException',
    code,
    ...(subcode !== undefined ? { error_subcode: subcode } : {}),
    error_data: { messaging_product: 'whatsapp', details: 'detail text' },
    fbtrace_id: 'trace-123',
  },
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('errorFromResponse class selection', () => {
  it('maps code 131047 to WhatsAppReEngagementError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(errorEnvelope(131047), { status: 400 }))),
    );

    try {
      await makeClient().request({ method: 'POST', path: 'x/messages', body: {} });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(WhatsAppReEngagementError);
      expect(error).toBeInstanceOf(WhatsAppApiError);
      expect((error as WhatsAppReEngagementError).code).toBe(131047);
    }
  });

  it('leaves an unmapped code (100) as a plain WhatsAppApiError with .code set', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(errorEnvelope(100), { status: 400 }))),
    );

    try {
      await makeClient().request({ method: 'POST', path: 'x/messages', body: {} });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(WhatsAppApiError);
      expect(error).not.toBeInstanceOf(WhatsAppRateLimitError);
      expect(error).not.toBeInstanceOf(WhatsAppReEngagementError);
      expect((error as WhatsAppApiError).code).toBe(100);
    }
  });
});

describe('WhatsAppRateLimitError mapping and retry', () => {
  it('maps code 130429 (HTTP 429) to WhatsAppRateLimitError, retries, then succeeds', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(errorEnvelope(130429), { status: 429, headers: { 'retry-after': '1' } }),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    // Real delay driven by fake timers so no real sleep occurs; honors Retry-After.
    const client = new HttpClient({
      accessToken: 'secret-token',
      baseUrl: BASE_URL,
      timeoutMs: 30000,
      maxRetries: 2,
    });

    const promise = client.request<{ ok: boolean }>({
      method: 'POST',
      path: 'x/messages',
      body: {},
    });
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('maps a plain HTTP 429 envelope with code 0 to WhatsAppRateLimitError (not auth)', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(errorEnvelope(0), { status: 429 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const client = makeClient();
    const promise = client.request<{ ok: boolean }>({
      method: 'POST',
      path: 'x/messages',
      body: {},
    });
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('surfaces a plain HTTP 429 (code-0 envelope) as WhatsAppRateLimitError after retries exhaust', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(errorEnvelope(0), { status: 429 }))),
    );

    try {
      await makeClient({ maxRetries: 0 }).request({ method: 'POST', path: 'x/messages', body: {} });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(WhatsAppRateLimitError);
      expect(error).not.toBeInstanceOf(WhatsAppAuthenticationError);
      expect((error as WhatsAppRateLimitError).httpStatus).toBe(429);
    }
  });

  it('maps a true no-envelope HTTP 429 to WhatsAppRateLimitError via errorFromResponse', () => {
    const error = errorFromResponse(429, undefined, 'Too Many Requests');
    expect(error).toBeInstanceOf(WhatsAppRateLimitError);
    expect(error).not.toBeInstanceOf(WhatsAppAuthenticationError);
    expect(error.httpStatus).toBe(429);
    expect(error.code).toBe(0);
  });

  it('still maps HTTP 401/403 and code 190 to WhatsAppAuthenticationError', () => {
    expect(errorFromResponse(401, undefined)).toBeInstanceOf(WhatsAppAuthenticationError);
    expect(errorFromResponse(403, undefined)).toBeInstanceOf(WhatsAppAuthenticationError);
    expect(
      errorFromResponse(400, {
        error: { message: 'Invalid token', type: 'OAuthException', code: 190 },
      }),
    ).toBeInstanceOf(WhatsAppAuthenticationError);
    // No-envelope non-429 responses still fall back to auth via the code-0 sentinel.
    expect(errorFromResponse(500, undefined)).toBeInstanceOf(WhatsAppAuthenticationError);
  });

  it('populates retryAfterMs on a WhatsAppRateLimitError when Retry-After is present', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(errorEnvelope(130429), { status: 429, headers: { 'retry-after': '2' } }),
        ),
      ),
    );

    try {
      // No retries so the first rate-limit error surfaces directly.
      await makeClient({ maxRetries: 0 }).request({ method: 'POST', path: 'x/messages', body: {} });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(WhatsAppRateLimitError);
      expect(error).toBeInstanceOf(WhatsAppApiError);
      expect((error as WhatsAppRateLimitError).httpStatus).toBe(429);
      expect((error as WhatsAppRateLimitError).retryAfterMs).toBe(2000);
    }
  });
});
