import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WhatsAppClient, WhatsAppValidationError } from '../src/index.js';

const BASE_URL = 'https://graph.facebook.com/v23.0';
const PHONE_ID = '1111111111';
const OTHER_PHONE_ID = '2222222222';
const CALL_ID = 'wacid.ABCDEF';

let fetchMock: ReturnType<typeof vi.fn>;

const makeClient = (): WhatsAppClient =>
  new WhatsAppClient({ accessToken: 'secret-token', phoneNumberId: PHONE_ID });

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

const parsedBody = (): Record<string, unknown> =>
  JSON.parse(lastCall().init.body as string) as Record<string, unknown>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('CallsResource.getSettings', () => {
  it('GETs /settings without a query when fields are omitted', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ calling: { status: 'ENABLED' } }));
    const result = await makeClient().calls.getSettings();
    expect(result).toEqual({ calling: { status: 'ENABLED' } });
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${PHONE_ID}/settings`);
    expect(init.method).toBe('GET');
  });

  it('appends a fields query', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ calling: {} }));
    await makeClient().calls.getSettings(undefined, ['calling']);
    expect(lastCall().url).toBe(`${BASE_URL}/${PHONE_ID}/settings?fields=calling`);
  });

  it('honors a per-call phoneNumberId override', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ calling: {} }));
    await makeClient().calls.getSettings(OTHER_PHONE_ID);
    expect(lastCall().url).toBe(`${BASE_URL}/${OTHER_PHONE_ID}/settings`);
  });

  it('rejects when no id is configured or provided', async () => {
    await expect(makeClientNoId().calls.getSettings()).rejects.toBeInstanceOf(
      WhatsAppValidationError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('CallsResource.updateSettings', () => {
  it('POSTs { calling } mapping camelCase to snake_case and passing callHours/sip through', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    const callHours = { mon: '09:00-17:00' };
    const sip = { servers: ['sip.example.com'] };
    const result = await makeClient().calls.updateSettings({
      calling: {
        status: 'ENABLED',
        callIconVisibility: 'DEFAULT',
        callbackPermissionStatus: 'DISABLED',
        callHours,
        sip,
      },
    });
    expect(result).toEqual({ success: true });
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${PHONE_ID}/settings`);
    expect(init.method).toBe('POST');
    expect(parsedBody()).toEqual({
      calling: {
        status: 'ENABLED',
        call_icon_visibility: 'DEFAULT',
        callback_permission_status: 'DISABLED',
        call_hours: callHours,
        sip,
      },
    });
  });

  it('omits undefined fields', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    await makeClient().calls.updateSettings({ calling: { status: 'DISABLED' } });
    expect(parsedBody()).toEqual({ calling: { status: 'DISABLED' } });
  });

  it('honors a per-call phoneNumberId override', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    await makeClient().calls.updateSettings({ calling: { status: 'ENABLED' } }, OTHER_PHONE_ID);
    expect(lastCall().url).toBe(`${BASE_URL}/${OTHER_PHONE_ID}/settings`);
  });
});

describe('CallsResource.initiate', () => {
  it('POSTs /calls with action connect and a session when an sdp offer is supplied', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ messaging_product: 'whatsapp', calls: [{ id: CALL_ID }] }),
    );
    const result = await makeClient().calls.initiate({
      to: '15551234567',
      sdp: { sdpType: 'offer', sdp: 'v=0...' },
    });
    expect(result).toEqual({ messaging_product: 'whatsapp', calls: [{ id: CALL_ID }] });
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${PHONE_ID}/calls`);
    expect(init.method).toBe('POST');
    expect(parsedBody()).toEqual({
      messaging_product: 'whatsapp',
      to: '15551234567',
      action: 'connect',
      session: { sdp_type: 'offer', sdp: 'v=0...' },
    });
  });

  it('POSTs without a session key when no sdp is supplied', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ messaging_product: 'whatsapp', calls: [{ id: CALL_ID }] }),
    );
    await makeClient().calls.initiate({ to: '15551234567' });
    const body = parsedBody();
    expect(body).toEqual({
      messaging_product: 'whatsapp',
      to: '15551234567',
      action: 'connect',
    });
    expect(body).not.toHaveProperty('session');
  });

  it('honors a per-call phoneNumberId override', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ messaging_product: 'whatsapp', calls: [] }));
    await makeClient().calls.initiate({ to: '15551234567' }, OTHER_PHONE_ID);
    expect(lastCall().url).toBe(`${BASE_URL}/${OTHER_PHONE_ID}/calls`);
  });

  it('throws on an empty "to" before any fetch call', async () => {
    await expect(makeClient().calls.initiate({ to: '' })).rejects.toBeInstanceOf(
      WhatsAppValidationError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects when no id is configured or provided', async () => {
    await expect(makeClientNoId().calls.initiate({ to: '15551234567' })).rejects.toBeInstanceOf(
      WhatsAppValidationError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('CallsResource.preAccept / accept', () => {
  it('preAccept POSTs action pre_accept with a session', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    await makeClient().calls.preAccept(CALL_ID, { sdpType: 'answer', sdp: 'v=0...' });
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${PHONE_ID}/calls`);
    expect(init.method).toBe('POST');
    expect(parsedBody()).toEqual({
      messaging_product: 'whatsapp',
      call_id: CALL_ID,
      action: 'pre_accept',
      session: { sdp_type: 'answer', sdp: 'v=0...' },
    });
  });

  it('accept POSTs action accept with a session', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    await makeClient().calls.accept(CALL_ID, { sdpType: 'answer', sdp: 'v=0...' });
    expect(parsedBody()).toEqual({
      messaging_product: 'whatsapp',
      call_id: CALL_ID,
      action: 'accept',
      session: { sdp_type: 'answer', sdp: 'v=0...' },
    });
  });

  it('preAccept throws on an empty call id before any fetch call', async () => {
    await expect(
      makeClient().calls.preAccept('', { sdpType: 'answer', sdp: 'x' }),
    ).rejects.toBeInstanceOf(WhatsAppValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accept throws on an empty call id before any fetch call', async () => {
    await expect(
      makeClient().calls.accept('', { sdpType: 'answer', sdp: 'x' }),
    ).rejects.toBeInstanceOf(WhatsAppValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('CallsResource.reject / terminate', () => {
  it('reject POSTs action reject with no session', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    await makeClient().calls.reject(CALL_ID);
    const body = parsedBody();
    expect(body).toEqual({
      messaging_product: 'whatsapp',
      call_id: CALL_ID,
      action: 'reject',
    });
    expect(body).not.toHaveProperty('session');
  });

  it('terminate POSTs action terminate with no session', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    await makeClient().calls.terminate(CALL_ID);
    const body = parsedBody();
    expect(body).toEqual({
      messaging_product: 'whatsapp',
      call_id: CALL_ID,
      action: 'terminate',
    });
    expect(body).not.toHaveProperty('session');
  });

  it('reject throws on an empty call id before any fetch call', async () => {
    await expect(makeClient().calls.reject('')).rejects.toBeInstanceOf(WhatsAppValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('terminate throws on an empty call id before any fetch call', async () => {
    await expect(makeClient().calls.terminate('')).rejects.toBeInstanceOf(WhatsAppValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('honors a per-call phoneNumberId override', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    await makeClient().calls.terminate(CALL_ID, OTHER_PHONE_ID);
    expect(lastCall().url).toBe(`${BASE_URL}/${OTHER_PHONE_ID}/calls`);
  });
});

describe('CallsResource wiring', () => {
  it('reuses the same lazily-created resource', () => {
    const client = makeClient();
    expect(client.calls).toBe(client.calls);
  });
});
