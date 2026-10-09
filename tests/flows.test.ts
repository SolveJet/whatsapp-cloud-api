import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WhatsAppClient, WhatsAppValidationError } from '../src/index.js';

const BASE_URL = 'https://graph.facebook.com/v23.0';
const WABA_ID = '9999999999';
const OTHER_WABA_ID = '8888888888';
const FLOW_ID = 'flow-123';

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

const parseBody = (init: RequestInit): Record<string, unknown> =>
  JSON.parse(init.body as string) as Record<string, unknown>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('FlowsResource.create', () => {
  it('POSTs {WABA}/flows and maps camelCase to snake_case', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: FLOW_ID }));
    const result = await makeClient().flows.create({
      name: 'My Flow',
      categories: ['SIGN_UP', 'OTHER'],
      flowJson: '{"version":"7.0"}',
      publish: true,
      cloneFlowId: 'src-flow',
      endpointUri: 'https://example.com/flow',
    });

    expect(result).toEqual({ id: FLOW_ID });
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${WABA_ID}/flows`);
    expect(init.method).toBe('POST');
    expect(parseBody(init)).toEqual({
      name: 'My Flow',
      categories: ['SIGN_UP', 'OTHER'],
      flow_json: '{"version":"7.0"}',
      publish: true,
      clone_flow_id: 'src-flow',
      endpoint_uri: 'https://example.com/flow',
    });
  });

  it('omits optional fields when not provided', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: FLOW_ID }));
    await makeClient().flows.create({ name: 'Minimal', categories: ['OTHER'] });
    expect(parseBody(lastCall().init)).toEqual({ name: 'Minimal', categories: ['OTHER'] });
  });

  it('honors a per-call businessAccountId override', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: FLOW_ID }));
    await makeClient().flows.create({ name: 'F', categories: ['OTHER'] }, OTHER_WABA_ID);
    expect(lastCall().url).toBe(`${BASE_URL}/${OTHER_WABA_ID}/flows`);
  });

  it('rejects an empty name before any fetch', async () => {
    await expect(
      makeClient().flows.create({ name: '', categories: ['OTHER'] }),
    ).rejects.toBeInstanceOf(WhatsAppValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects empty categories before any fetch', async () => {
    await expect(makeClient().flows.create({ name: 'F', categories: [] })).rejects.toBeInstanceOf(
      WhatsAppValidationError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects when no businessAccountId is configured or provided', async () => {
    await expect(
      makeClientNoId().flows.create({ name: 'F', categories: ['OTHER'] }),
    ).rejects.toBeInstanceOf(WhatsAppValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('FlowsResource.list', () => {
  it('GETs {WABA}/flows without a query when fields are omitted', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ id: FLOW_ID }] }));
    const result = await makeClient().flows.list();
    expect(result).toEqual({ data: [{ id: FLOW_ID }] });
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${WABA_ID}/flows`);
    expect(init.method).toBe('GET');
  });

  it('appends a fields query', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }));
    await makeClient().flows.list({ fields: ['name', 'status'] });
    expect(lastCall().url).toBe(`${BASE_URL}/${WABA_ID}/flows?fields=name,status`);
  });

  it('honors a per-call businessAccountId override', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }));
    await makeClient().flows.list({ businessAccountId: OTHER_WABA_ID });
    expect(lastCall().url).toBe(`${BASE_URL}/${OTHER_WABA_ID}/flows`);
  });
});

describe('FlowsResource.get', () => {
  it('GETs the Flow without a query when fields are omitted', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: FLOW_ID, name: 'F', status: 'DRAFT' }));
    const result = await makeClient().flows.get(FLOW_ID);
    expect(result.id).toBe(FLOW_ID);
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${FLOW_ID}`);
    expect(init.method).toBe('GET');
  });

  it('appends a fields query', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: FLOW_ID }));
    await makeClient().flows.get(FLOW_ID, ['name', 'validation_errors']);
    expect(lastCall().url).toBe(`${BASE_URL}/${FLOW_ID}?fields=name,validation_errors`);
  });

  it('rejects an empty flowId before any fetch', async () => {
    await expect(makeClient().flows.get('')).rejects.toBeInstanceOf(WhatsAppValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('FlowsResource.update', () => {
  it('POSTs the Flow mapping camelCase to snake_case', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    const result = await makeClient().flows.update(FLOW_ID, {
      name: 'Renamed',
      categories: ['SURVEY'],
      endpointUri: 'https://example.com/e',
      applicationId: 'app-1',
    });
    expect(result).toEqual({ success: true });
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${FLOW_ID}`);
    expect(init.method).toBe('POST');
    expect(parseBody(init)).toEqual({
      name: 'Renamed',
      categories: ['SURVEY'],
      endpoint_uri: 'https://example.com/e',
      application_id: 'app-1',
    });
  });

  it('normalizes a missing success to false', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    const result = await makeClient().flows.update(FLOW_ID, { name: 'X' });
    expect(result).toEqual({ success: false });
  });

  it('rejects an empty update payload before any fetch', async () => {
    await expect(makeClient().flows.update(FLOW_ID, {})).rejects.toBeInstanceOf(
      WhatsAppValidationError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an empty flowId before any fetch', async () => {
    await expect(makeClient().flows.update('', { name: 'X' })).rejects.toBeInstanceOf(
      WhatsAppValidationError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('FlowsResource.updateJson', () => {
  it('POSTs multipart FormData from a JSON string with the default name', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    const result = await makeClient().flows.updateJson(FLOW_ID, '{"version":"7.0"}');

    expect(result).toEqual({ success: true });
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${FLOW_ID}/assets`);
    expect(init.method).toBe('POST');

    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();

    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.get('asset_type')).toBe('FLOW_JSON');
    expect(form.get('name')).toBe('flow.json');
    const filePart = form.get('file');
    expect(filePart).toBeInstanceOf(Blob);
    expect((filePart as Blob).type).toBe('application/json');
    expect(await (filePart as Blob).text()).toBe('{"version":"7.0"}');
  });

  it('accepts raw bytes and a custom name', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    const bytes = new TextEncoder().encode('{"a":1}');
    await makeClient().flows.updateJson(FLOW_ID, bytes, { name: 'custom.json' });

    const form = lastCall().init.body as FormData;
    expect(form.get('name')).toBe('custom.json');
    const filePart = form.get('file');
    expect(filePart).toBeInstanceOf(Blob);
    expect((filePart as Blob).type).toBe('application/json');
    expect(await (filePart as Blob).text()).toBe('{"a":1}');
  });

  it('passes a Blob through unchanged', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    const blob = new Blob(['{"b":2}'], { type: 'application/json' });
    await makeClient().flows.updateJson(FLOW_ID, blob);
    const filePart = (lastCall().init.body as FormData).get('file');
    expect(filePart).toBeInstanceOf(Blob);
    expect(await (filePart as Blob).text()).toBe('{"b":2}');
  });

  it('rejects an empty flowId before any fetch', async () => {
    await expect(makeClient().flows.updateJson('', '{}')).rejects.toBeInstanceOf(
      WhatsAppValidationError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('FlowsResource lifecycle', () => {
  it('publish POSTs /publish', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    const result = await makeClient().flows.publish(FLOW_ID);
    expect(result).toEqual({ success: true });
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${FLOW_ID}/publish`);
    expect(init.method).toBe('POST');
  });

  it('deprecate POSTs /deprecate', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    await makeClient().flows.deprecate(FLOW_ID);
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${FLOW_ID}/deprecate`);
    expect(init.method).toBe('POST');
  });

  it('delete DELETEs the Flow', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    const result = await makeClient().flows.delete(FLOW_ID);
    expect(result).toEqual({ success: true });
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${FLOW_ID}`);
    expect(init.method).toBe('DELETE');
  });

  it('publish/deprecate/delete reject an empty flowId before any fetch', async () => {
    const client = makeClient();
    await expect(client.flows.publish('')).rejects.toBeInstanceOf(WhatsAppValidationError);
    await expect(client.flows.deprecate('')).rejects.toBeInstanceOf(WhatsAppValidationError);
    await expect(client.flows.delete('')).rejects.toBeInstanceOf(WhatsAppValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('FlowsResource.listAssets', () => {
  it('GETs {FLOW}/assets', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: [
          { name: 'flow.json', asset_type: 'FLOW_JSON', download_url: 'https://example.com/a' },
        ],
      }),
    );
    const result = await makeClient().flows.listAssets(FLOW_ID);
    expect(result.data[0]?.asset_type).toBe('FLOW_JSON');
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${FLOW_ID}/assets`);
    expect(init.method).toBe('GET');
  });

  it('rejects an empty flowId before any fetch', async () => {
    await expect(makeClient().flows.listAssets('')).rejects.toBeInstanceOf(WhatsAppValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('FlowsResource.getPreview', () => {
  it('requests fields=preview.invalidate(false) by default', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: FLOW_ID }));
    await makeClient().flows.getPreview(FLOW_ID);
    expect(lastCall().url).toBe(`${BASE_URL}/${FLOW_ID}?fields=preview.invalidate(false)`);
  });

  it('requests fields=preview.invalidate(true) when invalidate is set', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        id: FLOW_ID,
        preview: { preview_url: 'https://example.com/p', expires_at: '2030-01-01' },
      }),
    );
    const result = await makeClient().flows.getPreview(FLOW_ID, { invalidate: true });
    expect(result.preview?.preview_url).toBe('https://example.com/p');
    expect(lastCall().url).toBe(`${BASE_URL}/${FLOW_ID}?fields=preview.invalidate(true)`);
  });

  it('rejects an empty flowId before any fetch', async () => {
    await expect(makeClient().flows.getPreview('')).rejects.toBeInstanceOf(WhatsAppValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('FlowsResource wiring', () => {
  it('reuses the same lazily-created resource', () => {
    const client = makeClient();
    expect(client.flows).toBe(client.flows);
  });
});
