import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WhatsAppClient,
  WhatsAppValidationError,
  type CreateTemplatePayload,
  type MessageTemplateComponent,
  type TemplateComponent,
} from '../src/index.js';

const BASE_URL = 'https://graph.facebook.com/v23.0';
const WABA_ID = '9999999999';
const OTHER_WABA_ID = '8888888888';
const TEMPLATE_ID = '1234567890';

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

const parseBody = (): Record<string, unknown> =>
  JSON.parse(lastCall().init.body as string) as Record<string, unknown>;

const validBodyComponent = (): MessageTemplateComponent => ({
  type: 'BODY',
  text: 'Hello {{1}}',
});

const validCreatePayload = (overrides?: Partial<CreateTemplatePayload>): CreateTemplatePayload => ({
  name: 'order_confirmation',
  language: 'en_US',
  category: 'UTILITY',
  components: [validBodyComponent()],
  ...overrides,
});

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('TemplatesResource.list', () => {
  it('GETs /message_templates without a query when no options are given', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }));
    const result = await makeClient().templates.list();
    expect(result).toEqual({ data: [] });
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${WABA_ID}/message_templates`);
    expect(init.method).toBe('GET');
  });

  it('appends a comma-joined fields query', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }));
    await makeClient().templates.list({ fields: ['name', 'status'] });
    expect(lastCall().url).toBe(`${BASE_URL}/${WABA_ID}/message_templates?fields=name,status`);
  });

  it('builds and URL-encodes a multi-param query', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }));
    await makeClient().templates.list({
      limit: 10,
      status: 'APPROVED',
      name: 'order confirmation+',
      category: 'UTILITY',
      language: 'en_US',
      after: 'cursor/after',
      before: 'cursor/before',
    });
    expect(lastCall().url).toBe(
      `${BASE_URL}/${WABA_ID}/message_templates?limit=10&name=order%20confirmation%2B` +
        `&status=APPROVED&category=UTILITY&language=en_US&after=cursor%2Fafter&before=cursor%2Fbefore`,
    );
  });

  it('honors a per-call businessAccountId override', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }));
    await makeClient().templates.list({ businessAccountId: OTHER_WABA_ID });
    expect(lastCall().url).toBe(`${BASE_URL}/${OTHER_WABA_ID}/message_templates`);
  });

  it('rejects when no id is configured or provided', async () => {
    await expect(makeClientNoId().templates.list()).rejects.toBeInstanceOf(WhatsAppValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('TemplatesResource.get', () => {
  it('GETs the template by id without a query', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: TEMPLATE_ID, name: 'order' }));
    const result = await makeClient().templates.get(TEMPLATE_ID);
    expect(result).toEqual({ id: TEMPLATE_ID, name: 'order' });
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${TEMPLATE_ID}`);
    expect(init.method).toBe('GET');
  });

  it('appends a fields query', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: TEMPLATE_ID }));
    await makeClient().templates.get(TEMPLATE_ID, ['name', 'status']);
    expect(lastCall().url).toBe(`${BASE_URL}/${TEMPLATE_ID}?fields=name,status`);
  });

  it('rejects an empty template id', async () => {
    await expect(makeClient().templates.get('')).rejects.toBeInstanceOf(WhatsAppValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('TemplatesResource.create', () => {
  it('POSTs a correctly mapped minimal body', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ id: TEMPLATE_ID, status: 'PENDING', category: 'UTILITY' }),
    );
    const result = await makeClient().templates.create(validCreatePayload());
    expect(result).toEqual({ id: TEMPLATE_ID, status: 'PENDING', category: 'UTILITY' });
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${WABA_ID}/message_templates`);
    expect(init.method).toBe('POST');
    const body = parseBody();
    expect(body).toEqual({
      name: 'order_confirmation',
      language: 'en_US',
      category: 'UTILITY',
      components: [{ type: 'BODY', text: 'Hello {{1}}' }],
    });
    expect(body).not.toHaveProperty('parameter_format');
    expect(body).not.toHaveProperty('message_send_ttl_seconds');
  });

  it('maps optional camelCase fields to snake_case when provided', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ id: TEMPLATE_ID, status: 'PENDING', category: 'UTILITY' }),
    );
    await makeClient().templates.create(
      validCreatePayload({ parameterFormat: 'NAMED', messageSendTtlSeconds: 3600 }),
    );
    const body = parseBody();
    expect(body.parameter_format).toBe('NAMED');
    expect(body.message_send_ttl_seconds).toBe(3600);
  });

  it('honors a per-call businessAccountId override', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ id: TEMPLATE_ID, status: 'PENDING', category: 'UTILITY' }),
    );
    await makeClient().templates.create(validCreatePayload(), OTHER_WABA_ID);
    expect(lastCall().url).toBe(`${BASE_URL}/${OTHER_WABA_ID}/message_templates`);
  });

  it('rejects when no id is configured or provided', async () => {
    await expect(makeClientNoId().templates.create(validCreatePayload())).rejects.toBeInstanceOf(
      WhatsAppValidationError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  const invalidCases: Array<{ label: string; payload: CreateTemplatePayload }> = [
    { label: 'empty name', payload: validCreatePayload({ name: '' }) },
    { label: 'invalid name chars', payload: validCreatePayload({ name: 'My-Template' }) },
    { label: 'name over 512 chars', payload: validCreatePayload({ name: 'a'.repeat(513) }) },
    { label: 'empty language', payload: validCreatePayload({ language: '' }) },
    {
      label: 'invalid category',
      payload: validCreatePayload({ category: 'PROMOTIONAL' as CreateTemplatePayload['category'] }),
    },
    { label: 'empty components', payload: validCreatePayload({ components: [] }) },
    {
      label: 'zero BODY',
      payload: validCreatePayload({ components: [{ type: 'FOOTER', text: 'Bye' }] }),
    },
    {
      label: 'two BODY',
      payload: validCreatePayload({ components: [validBodyComponent(), validBodyComponent()] }),
    },
    {
      label: 'two HEADER',
      payload: validCreatePayload({
        components: [
          { type: 'HEADER', format: 'TEXT', text: 'A' },
          { type: 'HEADER', format: 'TEXT', text: 'B' },
          validBodyComponent(),
        ],
      }),
    },
    {
      label: 'two FOOTER',
      payload: validCreatePayload({
        components: [
          validBodyComponent(),
          { type: 'FOOTER', text: 'A' },
          { type: 'FOOTER', text: 'B' },
        ],
      }),
    },
    {
      label: 'BODY text over 1024',
      payload: validCreatePayload({ components: [{ type: 'BODY', text: 'a'.repeat(1025) }] }),
    },
    {
      label: 'HEADER text over 60',
      payload: validCreatePayload({
        components: [
          { type: 'HEADER', format: 'TEXT', text: 'a'.repeat(61) },
          validBodyComponent(),
        ],
      }),
    },
    {
      label: 'FOOTER text over 60',
      payload: validCreatePayload({
        components: [validBodyComponent(), { type: 'FOOTER', text: 'a'.repeat(61) }],
      }),
    },
    {
      label: 'BUTTONS over 10',
      payload: validCreatePayload({
        components: [
          validBodyComponent(),
          {
            type: 'BUTTONS',
            buttons: Array.from({ length: 11 }, (_, i) => ({
              type: 'QUICK_REPLY',
              text: `B${i}`,
            })),
          },
        ],
      }),
    },
  ];

  for (const { label, payload } of invalidCases) {
    it(`rejects: ${label}`, async () => {
      await expect(makeClient().templates.create(payload)).rejects.toBeInstanceOf(
        WhatsAppValidationError,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });
  }
});

describe('TemplatesResource.edit', () => {
  it('POSTs the mapped editable fields to the template id', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    const result = await makeClient().templates.edit(TEMPLATE_ID, {
      category: 'MARKETING',
      components: [validBodyComponent()],
      messageSendTtlSeconds: 600,
    });
    expect(result).toEqual({ success: true });
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${TEMPLATE_ID}`);
    expect(init.method).toBe('POST');
    expect(parseBody()).toEqual({
      category: 'MARKETING',
      components: [{ type: 'BODY', text: 'Hello {{1}}' }],
      message_send_ttl_seconds: 600,
    });
  });

  it('rejects an empty template id', async () => {
    await expect(makeClient().templates.edit('', { category: 'MARKETING' })).rejects.toBeInstanceOf(
      WhatsAppValidationError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an empty edit payload', async () => {
    await expect(makeClient().templates.edit(TEMPLATE_ID, {})).rejects.toBeInstanceOf(
      WhatsAppValidationError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('TemplatesResource.delete', () => {
  it('DELETEs by name only', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    const result = await makeClient().templates.delete({ name: 'order_confirmation' });
    expect(result).toEqual({ success: true });
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${WABA_ID}/message_templates?name=order_confirmation`);
    expect(init.method).toBe('DELETE');
  });

  it('DELETEs a single version with hsm_id and URL-encodes the name', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    await makeClient().templates.delete({ name: 'a b', templateId: TEMPLATE_ID });
    expect(lastCall().url).toBe(
      `${BASE_URL}/${WABA_ID}/message_templates?name=a%20b&hsm_id=${TEMPLATE_ID}`,
    );
  });

  it('rejects an empty name', async () => {
    await expect(makeClient().templates.delete({ name: '' })).rejects.toBeInstanceOf(
      WhatsAppValidationError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects when no id is configured or provided', async () => {
    await expect(makeClientNoId().templates.delete({ name: 'x' })).rejects.toBeInstanceOf(
      WhatsAppValidationError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('TemplatesResource wiring', () => {
  it('reuses the same lazily-created resource', () => {
    const client = makeClient();
    expect(client.templates).toBe(client.templates);
  });

  it('exports both send-side and management component types', () => {
    const sendSide: TemplateComponent = { type: 'body', parameters: [{ type: 'text', text: 'x' }] };
    const management: MessageTemplateComponent = { type: 'BODY', text: 'Hello' };
    expect(sendSide.type).toBe('body');
    expect(management.type).toBe('BODY');
  });
});
