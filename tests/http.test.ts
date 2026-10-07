import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpClient } from '../src/http.js';
import {
  WhatsAppApiError,
  WhatsAppAuthenticationError,
  WhatsAppRequestError,
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

describe('HttpClient request wiring', () => {
  it('builds the URL, method, headers, and serialized body for a JSON POST', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const client = makeClient();
    const result = await client.request<{ ok: boolean }>({
      method: 'POST',
      path: 'phone-id/messages',
      body: { hello: 'world' },
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/phone-id/messages`);
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer secret-token');
    expect(headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ hello: 'world' }));
  });

  it('strips a leading slash on the path and omits content-type without a body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await makeClient().request({ method: 'GET', path: '/phone-id/messages' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/phone-id/messages`);
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
    expect(init.body).toBeUndefined();
  });
});

describe('HttpClient error mapping', () => {
  it('maps a 400 to WhatsAppApiError with code/subcode/fbtraceId populated', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(errorEnvelope(100, 2018001), { status: 400 }))),
    );

    const client = makeClient();
    try {
      await client.request({ method: 'POST', path: 'x/messages', body: {} });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(WhatsAppApiError);
      const apiError = error as WhatsAppApiError;
      expect(apiError.httpStatus).toBe(400);
      expect(apiError.code).toBe(100);
      expect(apiError.subcode).toBe(2018001);
      expect(apiError.fbtraceId).toBe('trace-123');
    }
  });

  it('maps a 401 to WhatsAppAuthenticationError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(errorEnvelope(190), { status: 401 }))),
    );

    await expect(
      makeClient().request({ method: 'POST', path: 'x/messages', body: {} }),
    ).rejects.toBeInstanceOf(WhatsAppAuthenticationError);
  });

  it('does not retry a non-retryable 4xx (fetch called once)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(errorEnvelope(100), { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      makeClient().request({ method: 'POST', path: 'x/messages', body: {} }),
    ).rejects.toBeInstanceOf(WhatsAppApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('HttpClient retry policy', () => {
  it('retries a 429 with Retry-After then succeeds', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(errorEnvelope(130429), { status: 429, headers: { 'retry-after': '1' } }),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    // Real delay is used here but driven by fake timers so no real sleep occurs.
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

  it('retries a 500 up to maxRetries then throws', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(errorEnvelope(1), { status: 500 })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      makeClient({ maxRetries: 2 }).request({ method: 'POST', path: 'x/messages', body: {} }),
    ).rejects.toBeInstanceOf(WhatsAppApiError);
    // 1 initial attempt + 2 retries.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('HttpClient transport failures', () => {
  it('surfaces a network error as WhatsAppRequestError (not a timeout)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));

    try {
      await makeClient({ maxRetries: 0 }).request({ method: 'GET', path: 'x' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(WhatsAppRequestError);
      expect((error as WhatsAppRequestError).isTimeout).toBe(false);
    }
  });

  it('surfaces a timeout as WhatsAppRequestError with isTimeout true', async () => {
    // Simulate fetch rejecting because the timeout controller aborted it.
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      const signal = init.signal as AbortSignal;
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    vi.useFakeTimers();
    const client = new HttpClient({
      accessToken: 'secret-token',
      baseUrl: BASE_URL,
      timeoutMs: 50,
      maxRetries: 0,
      delay: () => Promise.resolve(),
    });

    const promise = client.request({ method: 'GET', path: 'x' });
    const assertion = expect(promise).rejects.toSatisfy(
      (error: unknown) => error instanceof WhatsAppRequestError && error.isTimeout === true,
    );
    await vi.advanceTimersByTimeAsync(60);
    await assertion;
  });
});
