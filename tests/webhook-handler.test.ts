import { afterEach, describe, expect, it, vi } from 'vitest';
import { WhatsAppWebhookError } from '../src/errors.js';
import { createMemoryDedupe } from '../src/resources/webhook-dedupe.js';
import { createWebhookHandler } from '../src/resources/webhook-handler.js';
import type { WebhookErrorInfo } from '../src/resources/webhook-handler-core.js';
import type { WebhookEvent } from '../src/types/webhook-events.js';
import {
  buildWebhookPayload,
  createTestRequest,
  signWebhookBody,
  type CreateTestRequestOptions,
} from '../src/testing.js';

const SECRET = 'test-secret';

const newOnError = () => vi.fn<(error: unknown, info: WebhookErrorInfo) => void>();

const quiet = () => ({ onError: newOnError() });

const post = (payload: NonNullable<CreateTestRequestOptions['payload']>, secret: string = SECRET) =>
  createTestRequest({ payload, secret });

const postUnsigned = (payload: NonNullable<CreateTestRequestOptions['payload']>) =>
  createTestRequest({ payload });

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('events and context', () => {
  it.each([
    ['text', 'message'],
    ['status', 'status'],
    ['call', 'call'],
    ['template_status', 'template'],
    ['flow', 'flow'],
    ['account_update', 'account'],
    ['group', 'group'],
  ] as const)('dispatches %s deliveries as %s events with context', async (kind, name) => {
    const handler = createWebhookHandler({ appSecrets: SECRET, ...quiet() });
    const seen: WebhookEvent[] = [];
    handler.on(name, (event) => {
      seen.push(event);
    });
    const response = await handler.handleRequest(await post(buildWebhookPayload(kind)));
    expect(response.status).toBe(200);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.name).toBe(name);
    expect(seen[0]?.ctx.wabaId).toBe('102290129340398');
  });

  it('dispatches error and unknown events and attaches the contact', async () => {
    const handler = createWebhookHandler({ appSecrets: SECRET, ...quiet() });
    const names: string[] = [];
    let contactName: string | undefined;
    handler.on('error', () => {
      names.push('error');
    });
    handler.on('unknown', () => {
      names.push('unknown');
    });
    handler.on('message', (event) => {
      contactName = event.ctx.contact?.profile?.name;
    });
    const withError = buildWebhookPayload('text', {
      entry: [
        {
          id: '1',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                contacts: [{ wa_id: '16315551234', profile: { name: 'Ada' } }],
                messages: [
                  {
                    id: 'm1',
                    type: 'text',
                    from: '16315551234',
                    timestamp: '1',
                    text: { body: 'x' },
                  },
                ],
                errors: [{ code: 131000, title: 'oops' }],
              },
            },
            { field: 'history', value: { anything: true } },
          ],
        },
      ],
    });
    await handler.handleRequest(await post(withError));
    expect(names.sort()).toEqual(['error', 'unknown']);
    expect(contactName).toBe('Ada');
  });

  it('removes a handler with the returned unsubscribe function', async () => {
    const handler = createWebhookHandler({ appSecrets: SECRET });
    const fn = vi.fn();
    const off = handler.on('message', fn);
    off();
    await handler.handleRequest(await post(buildWebhookPayload('text')));
    expect(fn).not.toHaveBeenCalled();
  });

  it('applies handlers added during dispatch to the next delivery only', async () => {
    const handler = createWebhookHandler({ appSecrets: SECRET });
    const late = vi.fn();
    handler.on('message', () => {
      handler.on('message', late);
    });
    await handler.handleRequest(await post(buildWebhookPayload('text')));
    expect(late).not.toHaveBeenCalled();
    await handler.handleRequest(await post(buildWebhookPayload('text')));
    expect(late).toHaveBeenCalledTimes(1);
  });
});

describe('error isolation', () => {
  it('reports a throwing handler, keeps going, and still answers 200', async () => {
    const onError = newOnError();
    const handler = createWebhookHandler({ appSecrets: SECRET, onError });
    const second = vi.fn();
    handler.on('message', () => {
      throw new Error('boom');
    });
    handler.on('message', second);
    const response = await handler.handleRequest(await post(buildWebhookPayload('text')));
    expect(response.status).toBe(200);
    expect(second).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    const [error, info] = onError.mock.calls[0] as [Error, { event: WebhookEvent; ctx: unknown }];
    expect(error.message).toBe('boom');
    expect(info.event.name).toBe('message');
    expect(info.ctx).toBe(info.event.ctx);
  });

  it('survives an onError that throws', async () => {
    const handler = createWebhookHandler({
      appSecrets: SECRET,
      onError: () => {
        throw new Error('hook failed');
      },
    });
    handler.on('message', () => {
      throw new Error('boom');
    });
    const response = await handler.handleRequest(await post(buildWebhookPayload('text')));
    expect(response.status).toBe(200);
  });

  it('answers 500 for a failed handler only with ackMode after and retryOnHandlerError', async () => {
    const failing = (): never => {
      throw new Error('boom');
    };
    const retry = createWebhookHandler({
      appSecrets: SECRET,
      retryOnHandlerError: true,
      ...quiet(),
    });
    retry.on('message', failing);
    expect((await retry.handleRequest(await post(buildWebhookPayload('text')))).status).toBe(500);

    const before = createWebhookHandler({
      appSecrets: SECRET,
      retryOnHandlerError: true,
      ackMode: 'before',
      ...quiet(),
    });
    before.on('message', failing);
    expect((await before.handleRequest(await post(buildWebhookPayload('text')))).status).toBe(200);
  });

  it('answers 200 and calls onError for a signed body that is not JSON or the wrong envelope', async () => {
    const onError = newOnError();
    const handler = createWebhookHandler({ appSecrets: SECRET, onError });
    for (const body of ['not json', '{"object":"page","entry":[]}']) {
      const request = await createTestRequest({ body, secret: SECRET });
      expect((await handler.handleRequest(request)).status).toBe(200);
    }
    expect(onError).toHaveBeenCalledTimes(2);
    expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(WhatsAppWebhookError);
    expect(onError.mock.calls[0]?.[1]).toEqual({});
  });
});

describe('status matrix', () => {
  const handler = createWebhookHandler({ appSecrets: SECRET, maxBodyBytes: 1024, ...quiet() });

  it('answers 401 for a bad, missing or malformed signature', async () => {
    const payload = buildWebhookPayload('text');
    expect((await handler.handleRequest(await postUnsigned(payload))).status).toBe(401);
    const bad = await createTestRequest({ payload, signature: `sha256=${'0'.repeat(64)}` });
    expect((await handler.handleRequest(bad)).status).toBe(401);
    const malformed = await createTestRequest({ payload, signature: 'nope' });
    expect((await handler.handleRequest(malformed)).status).toBe(401);
  });

  it('answers 401 for a tampered body', async () => {
    const body = JSON.stringify(buildWebhookPayload('text'));
    const signature = await signWebhookBody(body, SECRET);
    const request = await createTestRequest({ body: `${body} `, signature });
    expect((await handler.handleRequest(request)).status).toBe(401);
  });

  it('verifies the signature over the original bytes', async () => {
    const body = `${JSON.stringify(buildWebhookPayload('text'))}  \n// ünï`;
    const bytes = new TextEncoder().encode(body);
    const signature = await signWebhookBody(bytes, SECRET);
    const result = await handler.handleDelivery(bytes, signature);
    // Signature is valid; the trailing text makes the JSON invalid, which is a 200 with onError.
    expect(result.httpStatus).toBe(200);
    expect(result.accepted).toBe(false);
    const good = JSON.stringify(buildWebhookPayload('text'), null, 4);
    const goodSignature = await signWebhookBody(good, SECRET);
    const roomy = createWebhookHandler({ appSecrets: SECRET });
    expect((await roomy.handleDelivery(good, goodSignature)).accepted).toBe(true);
  });

  it('answers 413 from content-length', async () => {
    const request = await createTestRequest({
      body: 'x'.repeat(2048),
      secret: SECRET,
      headers: { 'content-length': '2048' },
    });
    expect((await handler.handleRequest(request)).status).toBe(413);
  });

  it('answers 413 while streaming without content-length and stops reading', async () => {
    let pulls = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new Uint8Array(512));
        if (pulls > 100) {
          controller.close();
        }
      },
    });
    const request = new Request('https://example.com/webhook', {
      method: 'POST',
      body: stream,
      duplex: 'half',
    } as RequestInit);
    expect((await handler.handleRequest(request)).status).toBe(413);
    expect(pulls).toBeLessThan(10);
  });
  it('answers 413 even when cancelling the oversized stream fails', async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(2048));
      },
      cancel() {
        throw new Error('cancel failed');
      },
    });
    const request = new Request('https://example.com/webhook', {
      method: 'POST',
      body: stream,
      duplex: 'half',
    } as RequestInit);
    expect((await handler.handleRequest(request)).status).toBe(413);
  });
});

describe('GET handshake and methods', () => {
  const handler = createWebhookHandler({ verifyToken: 'tok' });
  const url = (query: string): string => `https://example.com/webhook?${query}`;

  it('answers 200 with the raw challenge', async () => {
    const response = await handler.handleRequest(
      new Request(url('hub.mode=subscribe&hub.verify_token=tok&hub.challenge=abc123')),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('abc123');
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
  });

  it('answers 403 for a wrong token, wrong mode or no configured token', async () => {
    expect(
      (await handler.handleRequest(new Request(url('hub.mode=subscribe&hub.verify_token=no'))))
        .status,
    ).toBe(403);
    expect(
      (await handler.handleRequest(new Request(url('hub.mode=other&hub.verify_token=tok')))).status,
    ).toBe(403);
    const bare = createWebhookHandler();
    expect(
      (await bare.handleRequest(new Request(url('hub.mode=subscribe&hub.verify_token=')))).status,
    ).toBe(403);
  });

  it('accepts a query map in handleVerification', () => {
    expect(
      handler.handleVerification({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'tok',
        'hub.challenge': 'c',
      }),
    ).toEqual({ statusCode: 200, body: 'c' });
  });

  it('answers 405 with an Allow header for other methods', async () => {
    const response = await handler.handleRequest(
      new Request(url(''), { method: 'PUT', body: 'x' }),
    );
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET, POST');
  });
});

describe('ackMode before', () => {
  it('answers first and runs handlers through waitUntil', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const done = vi.fn();
    const handler = createWebhookHandler({ appSecrets: SECRET, ackMode: 'before' });
    handler.on('message', async () => {
      await gate;
      done();
    });
    const pending: Promise<unknown>[] = [];
    const response = await handler.handleRequest(await post(buildWebhookPayload('text')), {
      waitUntil: (promise) => {
        pending.push(promise);
      },
    });
    expect(response.status).toBe(200);
    expect(done).not.toHaveBeenCalled();
    release();
    await Promise.all(pending);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('runs handlers detached when no waitUntil is given and reports their errors', async () => {
    const onError = newOnError();
    const handler = createWebhookHandler({ appSecrets: SECRET, ackMode: 'before', onError });
    handler.on('message', () => {
      throw new Error('late');
    });
    const response = await handler.handleRequest(await post(buildWebhookPayload('text')));
    expect(response.status).toBe(200);
    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1);
    });
  });

  it('uses the waitUntil option as the default', async () => {
    const waitUntil = vi.fn();
    const handler = createWebhookHandler({ appSecrets: SECRET, ackMode: 'before', waitUntil });
    await handler.handleRequest(await post(buildWebhookPayload('text')));
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });
});

describe('dedupe and stale events', () => {
  it('skips an event seen before, and forgets failed keys when retrying', async () => {
    const handler = createWebhookHandler({
      appSecrets: SECRET,
      dedupe: createMemoryDedupe(),
      retryOnHandlerError: true,
      ...quiet(),
    });
    let calls = 0;
    handler.on('message', () => {
      calls += 1;
      if (calls === 1) {
        throw new Error('first try fails');
      }
    });
    const payload = buildWebhookPayload('text');
    expect((await handler.handleRequest(await post(payload))).status).toBe(500);
    expect((await handler.handleRequest(await post(payload))).status).toBe(200);
    const third = await handler.handleDelivery(
      JSON.stringify(payload),
      await signWebhookBody(JSON.stringify(payload), SECRET),
    );
    expect(third.skippedDuplicates).toBe(1);
    expect(calls).toBe(2);
  });

  it('honours dedupeKey, including undefined to skip dedupe', async () => {
    const handler = createWebhookHandler({
      appSecrets: SECRET,
      dedupe: createMemoryDedupe(),
      dedupeKey: () => undefined,
    });
    const fn = vi.fn();
    handler.on('message', fn);
    const payload = buildWebhookPayload('text');
    await handler.handleRequest(await post(payload));
    await handler.handleRequest(await post(payload));
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('skips events older than maxEventAgeSeconds', async () => {
    const handler = createWebhookHandler({ appSecrets: SECRET, maxEventAgeSeconds: 60 });
    const fn = vi.fn();
    handler.on('message', fn);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const old = buildWebhookPayload('text');
    const body = JSON.stringify(old);
    const stale = await handler.handleDelivery(body, await signWebhookBody(body, SECRET));
    expect(stale.skippedStale).toBe(1);
    const fresh = JSON.stringify(
      buildWebhookPayload('text', {
        entry: [
          {
            id: '1',
            changes: [
              {
                field: 'messages',
                value: {
                  messages: [
                    {
                      id: 'm2',
                      type: 'text',
                      from: '1',
                      timestamp: String(nowSeconds),
                      text: { body: 'x' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }),
    );
    const result = await handler.handleDelivery(fresh, await signWebhookBody(fresh, SECRET));
    expect(result.delivered).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('concurrency', () => {
  it('never runs more events at once than the limit, and handlers of one event run in order', async () => {
    const handler = createWebhookHandler({ appSecrets: SECRET, concurrency: 2 });
    let inFlight = 0;
    let peak = 0;
    const order: string[] = [];
    handler.on('message', async (event) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      order.push(`a:${event.message.id}`);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
    });
    handler.on('message', (event) => {
      order.push(`b:${event.message.id}`);
    });
    const messages = Array.from({ length: 6 }, (_, index) => ({
      id: `m${index}`,
      type: 'text',
      from: '1',
      timestamp: '1',
      text: { body: 'x' },
    }));
    const payload = buildWebhookPayload('text', {
      entry: [{ id: '1', changes: [{ field: 'messages', value: { messages } }] }],
    });
    const result = await handler.handleRequest(await post(payload));
    expect(result.status).toBe(200);
    expect(peak).toBe(2);
    for (let index = 0; index < 6; index += 1) {
      expect(order.indexOf(`a:m${index}`)).toBeLessThan(order.indexOf(`b:m${index}`));
    }
  });

  it('rejects an invalid concurrency, ackMode or empty secrets', () => {
    expect(() => createWebhookHandler({ concurrency: 0 })).toThrow(WhatsAppWebhookError);
    expect(() => createWebhookHandler({ concurrency: 1.5 })).toThrow(WhatsAppWebhookError);
    expect(() => createWebhookHandler({ ackMode: 'never' as 'before' })).toThrow(
      WhatsAppWebhookError,
    );
    expect(() => createWebhookHandler({ appSecrets: [] })).toThrow(WhatsAppWebhookError);
    expect(() => createWebhookHandler({ appSecrets: '' })).toThrow(WhatsAppWebhookError);
  });
});

describe('secrets and tenants', () => {
  it('accepts the old and the new secret during rotation', async () => {
    const handler = createWebhookHandler({ appSecrets: ['old', 'new'] });
    expect(
      (await handler.handleRequest(await post(buildWebhookPayload('text'), 'old'))).status,
    ).toBe(200);
    expect(
      (await handler.handleRequest(await post(buildWebhookPayload('text'), 'new'))).status,
    ).toBe(200);
    expect(
      (await handler.handleRequest(await post(buildWebhookPayload('text'), 'other'))).status,
    ).toBe(401);
  });

  it('uses the tenant picked by resolveTenant', async () => {
    const handler = createWebhookHandler({
      resolveTenant: (request) => {
        const tenant = new URL(request.url).searchParams.get('tenant');
        return tenant === 'a'
          ? { appSecrets: 'secret-a', verifyToken: 'token-a' }
          : tenant === 'b'
            ? { appSecrets: 'secret-b', verifyToken: 'token-b' }
            : undefined;
      },
    });
    const seen: string[] = [];
    handler.on('message', () => {
      seen.push('m');
    });
    const make = (tenant: string, secret: string) =>
      createTestRequest({
        payload: buildWebhookPayload('text'),
        secret,
        url: `https://example.com/webhook?tenant=${tenant}`,
      });
    expect((await handler.handleRequest(await make('a', 'secret-a'))).status).toBe(200);
    expect((await handler.handleRequest(await make('a', 'secret-b'))).status).toBe(401);
    expect((await handler.handleRequest(await make('b', 'secret-b'))).status).toBe(200);
    expect((await handler.handleRequest(await make('c', 'secret-a'))).status).toBe(401);
    expect(seen).toHaveLength(2);
    const handshake = await handler.handleRequest(
      new Request(
        'https://example.com/webhook?tenant=b&hub.mode=subscribe&hub.verify_token=token-b&hub.challenge=z',
      ),
    );
    expect(await handshake.text()).toBe('z');
    const wrong = await handler.handleRequest(
      new Request(
        'https://example.com/webhook?tenant=b&hub.mode=subscribe&hub.verify_token=token-a&hub.challenge=z',
      ),
    );
    expect(wrong.status).toBe(403);
  });
});

describe('unsigned deliveries', () => {
  const importFresh = async () => {
    vi.resetModules();
    const handlerModule = await import('../src/resources/webhook-handler.js');
    const testing = await import('../src/testing.js');
    return { ...handlerModule, ...testing };
  };

  it('warns once when no secret is configured', async () => {
    const {
      createWebhookHandler: create,
      buildWebhookPayload: build,
      createTestRequest: make,
    } = await importFresh();
    const warn = vi.spyOn(process, 'emitWarning').mockImplementation(() => undefined);
    const handler = create();
    for (let index = 0; index < 2; index += 1) {
      const response = await handler.handleRequest(await make({ payload: build('text') }));
      expect(response.status).toBe(200);
    }
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('does not warn with allowUnsigned', async () => {
    const {
      createWebhookHandler: create,
      buildWebhookPayload: build,
      createTestRequest: make,
    } = await importFresh();
    const warn = vi.spyOn(process, 'emitWarning').mockImplementation(() => undefined);
    const handler = create({ allowUnsigned: true });
    await handler.handleRequest(await make({ payload: build('text') }));
    expect(warn).not.toHaveBeenCalled();
  });
});
