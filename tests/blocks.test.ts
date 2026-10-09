import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WhatsAppClient, WhatsAppValidationError } from '../src/index.js';

const BASE_URL = 'https://graph.facebook.com/v23.0';
const PHONE_ID = '1111111111';
const OTHER_PHONE_ID = '2222222222';

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

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('BlocksResource.block', () => {
  it('POSTs /block_users with the correct body shape', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        messaging_product: 'whatsapp',
        block_users: { added_users: [{ input: '15551234567', wa_id: '15551234567' }] },
      }),
    );
    const response = await makeClient().blocks.block(['15551234567', '15559876543']);
    expect(response.block_users.added_users?.[0]?.wa_id).toBe('15551234567');
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${PHONE_ID}/block_users`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      messaging_product: 'whatsapp',
      block_users: [{ user: '15551234567' }, { user: '15559876543' }],
    });
  });

  it('honors a per-call phoneNumberId override', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ messaging_product: 'whatsapp', block_users: {} }));
    await makeClient().blocks.block(['15551234567'], OTHER_PHONE_ID);
    expect(lastCall().url).toBe(`${BASE_URL}/${OTHER_PHONE_ID}/block_users`);
  });

  it('rejects an empty array before any fetch', async () => {
    await expect(makeClient().blocks.block([])).rejects.toBeInstanceOf(WhatsAppValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a 1001-entry array before any fetch', async () => {
    const users = Array.from({ length: 1001 }, (_, i) => String(i));
    await expect(makeClient().blocks.block(users)).rejects.toBeInstanceOf(WhatsAppValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects when no id is configured or provided', async () => {
    await expect(makeClientNoId().blocks.block(['15551234567'])).rejects.toBeInstanceOf(
      WhatsAppValidationError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('BlocksResource.unblock', () => {
  it('DELETEs /block_users with the same body shape', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        messaging_product: 'whatsapp',
        block_users: { removed_users: [{ input: '15551234567', wa_id: '15551234567' }] },
      }),
    );
    const response = await makeClient().blocks.unblock(['15551234567']);
    expect(response.block_users.removed_users?.[0]?.wa_id).toBe('15551234567');
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${PHONE_ID}/block_users`);
    expect(init.method).toBe('DELETE');
    expect(JSON.parse(init.body as string)).toEqual({
      messaging_product: 'whatsapp',
      block_users: [{ user: '15551234567' }],
    });
  });

  it('honors a per-call phoneNumberId override', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ messaging_product: 'whatsapp', block_users: {} }));
    await makeClient().blocks.unblock(['15551234567'], OTHER_PHONE_ID);
    expect(lastCall().url).toBe(`${BASE_URL}/${OTHER_PHONE_ID}/block_users`);
  });

  it('rejects an empty array before any fetch', async () => {
    await expect(makeClient().blocks.unblock([])).rejects.toBeInstanceOf(WhatsAppValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a 1001-entry array before any fetch', async () => {
    const users = Array.from({ length: 1001 }, (_, i) => String(i));
    await expect(makeClient().blocks.unblock(users)).rejects.toBeInstanceOf(
      WhatsAppValidationError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects when no id is configured or provided', async () => {
    await expect(makeClientNoId().blocks.unblock(['15551234567'])).rejects.toBeInstanceOf(
      WhatsAppValidationError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('BlocksResource.list', () => {
  it('GETs /block_users without a query when options are omitted', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }));
    await makeClient().blocks.list();
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${PHONE_ID}/block_users`);
    expect(init.method).toBe('GET');
  });

  it('builds a limit/after/before query', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }));
    await makeClient().blocks.list({ limit: 50, after: 'cursor-a', before: 'cursor-b' });
    expect(lastCall().url).toBe(
      `${BASE_URL}/${PHONE_ID}/block_users?limit=50&after=cursor-a&before=cursor-b`,
    );
  });

  it('honors a per-call phoneNumberId override', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }));
    await makeClient().blocks.list({ phoneNumberId: OTHER_PHONE_ID });
    expect(lastCall().url).toBe(`${BASE_URL}/${OTHER_PHONE_ID}/block_users`);
  });

  it('rejects when no id is configured or provided', async () => {
    await expect(makeClientNoId().blocks.list()).rejects.toBeInstanceOf(WhatsAppValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('BlocksResource wiring', () => {
  it('reuses the same lazily-created resource', () => {
    const client = makeClient();
    expect(client.blocks).toBe(client.blocks);
  });
});
