import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WhatsAppClient, WhatsAppValidationError } from '../src/index.js';

const BASE_URL = 'https://graph.facebook.com/v23.0';
const WABA_ID = '9999999999';
const OTHER_WABA_ID = '8888888888';

let fetchMock: ReturnType<typeof vi.fn>;

const makeClient = (): WhatsAppClient =>
  new WhatsAppClient({ accessToken: 'secret-token', businessAccountId: WABA_ID });

const makeClientNoId = (): WhatsAppClient => new WhatsAppClient({ accessToken: 'secret-token' });

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const lastCall = (): { url: string; init: RequestInit } => {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { url, init };
};

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('WabaResource.get', () => {
  it('GETs the WABA without a query when fields are omitted', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: WABA_ID, name: 'Acme' }));
    const result = await makeClient().waba.get();
    expect(result).toEqual({ id: WABA_ID, name: 'Acme' });
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${WABA_ID}`);
    expect(init.method).toBe('GET');
  });

  it('appends a fields query', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: WABA_ID }));
    await makeClient().waba.get(undefined, ['name', 'currency']);
    expect(lastCall().url).toBe(`${BASE_URL}/${WABA_ID}?fields=name,currency`);
  });

  it('honors a per-call businessAccountId override', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: OTHER_WABA_ID }));
    await makeClient().waba.get(OTHER_WABA_ID);
    expect(lastCall().url).toBe(`${BASE_URL}/${OTHER_WABA_ID}`);
  });

  it('rejects when no id is configured or provided', async () => {
    await expect(makeClientNoId().waba.get()).rejects.toBeInstanceOf(WhatsAppValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('WabaResource.listPhoneNumbers', () => {
  it('returns data and paging', async () => {
    const payload = {
      data: [{ id: '1', display_phone_number: '+1 555' }],
      paging: { cursors: { before: 'b', after: 'a' } },
    };
    fetchMock.mockResolvedValue(jsonResponse(payload));
    const result = await makeClient().waba.listPhoneNumbers();
    expect(result).toEqual(payload);
    expect(lastCall().url).toBe(`${BASE_URL}/${WABA_ID}/phone_numbers`);
  });

  it('builds a fields query from options.fields', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }));
    await makeClient().waba.listPhoneNumbers(undefined, {
      fields: ['display_phone_number', 'quality_rating'],
    });
    expect(lastCall().url).toBe(
      `${BASE_URL}/${WABA_ID}/phone_numbers?fields=display_phone_number,quality_rating`,
    );
  });
});

describe('WabaResource subscribed apps', () => {
  it('listSubscribedApps GETs /subscribed_apps', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ data: [{ whatsapp_business_api_data: { id: 'app-1', name: 'App' } }] }),
    );
    const result = await makeClient().waba.listSubscribedApps();
    expect(result.data[0]?.whatsapp_business_api_data?.id).toBe('app-1');
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${WABA_ID}/subscribed_apps`);
    expect(init.method).toBe('GET');
  });

  it('subscribeApp POSTs /subscribed_apps with no body', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    const result = await makeClient().waba.subscribeApp();
    expect(result).toEqual({ success: true });
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${WABA_ID}/subscribed_apps`);
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
  });

  it('unsubscribeApp DELETEs /subscribed_apps', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    await makeClient().waba.unsubscribeApp();
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${WABA_ID}/subscribed_apps`);
    expect(init.method).toBe('DELETE');
  });

  it('honors a businessAccountId override', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    await makeClient().waba.subscribeApp(OTHER_WABA_ID);
    expect(lastCall().url).toBe(`${BASE_URL}/${OTHER_WABA_ID}/subscribed_apps`);
  });
});

describe('WabaResource wiring', () => {
  it('reuses the same lazily-created resource', () => {
    const client = makeClient();
    expect(client.waba).toBe(client.waba);
  });
});
