import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WhatsAppApiError,
  WhatsAppAuthenticationError,
  WhatsAppClient,
  WhatsAppValidationError,
} from '../src/index.js';
import type { MediaInfoResponse } from '../src/types/media.js';

const BASE_URL = 'https://graph.facebook.com/v23.0';
const PHONE_ID = '1111111111';
const MEDIA_ID = 'media-123';
const DOWNLOAD_URL = 'https://lookaside.fbsbx.com/whatsapp_business/attachments/abc?token=xyz';

let fetchMock: ReturnType<typeof vi.fn>;

const makeClient = (): WhatsAppClient =>
  new WhatsAppClient({ accessToken: 'secret-token', phoneNumberId: PHONE_ID });

const jsonResponse = (
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> },
): Response =>
  new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });

const binaryResponse = (bytes: Uint8Array, init?: { status?: number }): Response =>
  new Response(bytes, {
    status: init?.status ?? 200,
    headers: { 'content-type': 'application/octet-stream' },
  });

const errorEnvelope = (code: number): Record<string, unknown> => ({
  error: {
    message: 'Something went wrong',
    type: 'OAuthException',
    code,
    fbtrace_id: 'trace-123',
  },
});

const callAt = (index: number): { url: string; init: RequestInit } => {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit];
  return { url, init };
};

const lastCall = (): { url: string; init: RequestInit } => {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { url, init };
};

const MEDIA_INFO: MediaInfoResponse = {
  id: MEDIA_ID,
  url: DOWNLOAD_URL,
  mime_type: 'image/jpeg',
  sha256: 'deadbeef',
  file_size: 1024,
  messaging_product: 'whatsapp',
};

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('MediaResource.upload', () => {
  it('POSTs multipart FormData to {phoneNumberId}/media and returns the id', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: MEDIA_ID }));

    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
    const result = await makeClient().media.upload(blob);

    expect(result).toEqual({ id: MEDIA_ID });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${PHONE_ID}/media`);
    expect(init.method).toBe('POST');

    // Authorization is set; Content-Type is NOT manually application/json.
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer secret-token');
    expect(headers['Content-Type']).toBeUndefined();

    // The body is a FormData carrying messaging_product=whatsapp and a file part.
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.get('messaging_product')).toBe('whatsapp');
    expect(form.get('type')).toBe('image/jpeg');
    const filePart = form.get('file');
    expect(filePart).toBeInstanceOf(Blob);
    expect((filePart as Blob).type).toBe('image/jpeg');
  });

  it('accepts raw bytes with an explicit type and filename', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: MEDIA_ID }));

    const bytes = new Uint8Array([4, 5, 6, 7]);
    const result = await makeClient().media.upload({
      file: bytes,
      type: 'application/pdf',
      filename: 'doc.pdf',
    });

    expect(result).toEqual({ id: MEDIA_ID });
    const form = lastCall().init.body as FormData;
    expect(form.get('type')).toBe('application/pdf');
    const filePart = form.get('file');
    expect(filePart).toBeInstanceOf(Blob);
    expect((filePart as Blob).type).toBe('application/pdf');
    expect((filePart as File).name).toBe('doc.pdf');
    expect(await (filePart as Blob).arrayBuffer()).toEqual(bytes.buffer);
  });

  it('throws WhatsAppValidationError when the content type cannot be inferred', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    await expect(makeClient().media.upload({ file: bytes })).rejects.toBeInstanceOf(
      WhatsAppValidationError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('honors a per-call phoneNumberId override', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: MEDIA_ID }));
    const blob = new Blob([new Uint8Array([1])], { type: 'image/png' });
    await makeClient().media.upload(blob, { phoneNumberId: '2222222222' });
    expect(lastCall().url).toBe(`${BASE_URL}/2222222222/media`);
  });

  it('requires a configured or passed phoneNumberId', async () => {
    const client = new WhatsAppClient({ accessToken: 'secret-token' });
    const blob = new Blob([new Uint8Array([1])], { type: 'image/png' });
    await expect(client.media.upload(blob)).rejects.toBeInstanceOf(WhatsAppValidationError);
  });

  it('is lazily instantiated and reused across accesses', () => {
    const client = makeClient();
    expect(client.media).toBe(client.media);
  });
});

describe('MediaResource.getUrl', () => {
  it('maps the snake_case response to a camelCase MediaInfo', async () => {
    fetchMock.mockResolvedValue(jsonResponse(MEDIA_INFO));

    const info = await makeClient().media.getUrl(MEDIA_ID);

    expect(info).toEqual({
      id: MEDIA_ID,
      url: DOWNLOAD_URL,
      mimeType: 'image/jpeg',
      sha256: 'deadbeef',
      fileSize: 1024,
      messagingProduct: 'whatsapp',
    });

    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${MEDIA_ID}?phone_number_id=${PHONE_ID}`);
    expect(init.method).toBe('GET');
  });
});

describe('MediaResource.download', () => {
  it('calls getUrl then downloads bytes from the absolute url with auth + user-agent', async () => {
    const payload = new Uint8Array([10, 20, 30, 40]);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(MEDIA_INFO))
      .mockResolvedValueOnce(binaryResponse(payload));

    const result = await makeClient().media.download(MEDIA_ID);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.data).toBeInstanceOf(Uint8Array);
    expect(Array.from(result.data)).toEqual([10, 20, 30, 40]);
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.sha256).toBe('deadbeef');

    // First call resolves the metadata; second hits the absolute CDN URL.
    expect(callAt(0).url).toBe(`${BASE_URL}/${MEDIA_ID}?phone_number_id=${PHONE_ID}`);
    const second = callAt(1);
    expect(second.url).toBe(DOWNLOAD_URL);
    expect(second.init.method).toBe('GET');
    const headers = second.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer secret-token');
    expect(headers['User-Agent']).toBe('@solvejet/whatsapp-cloud-api');
  });

  it('downloadByUrl returns raw bytes as a Uint8Array', async () => {
    const payload = new Uint8Array([1, 1, 2, 3, 5]);
    fetchMock.mockResolvedValue(binaryResponse(payload));

    const bytes = await makeClient().media.downloadByUrl(DOWNLOAD_URL);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(bytes)).toEqual([1, 1, 2, 3, 5]);
  });
});

describe('MediaResource.delete', () => {
  it('DELETEs /{mediaId} and returns { success: true }', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));

    const result = await makeClient().media.delete(MEDIA_ID);

    expect(result).toEqual({ success: true });
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${MEDIA_ID}?phone_number_id=${PHONE_ID}`);
    expect(init.method).toBe('DELETE');
  });
});

describe('MediaResource error paths', () => {
  it('maps a 4xx Graph envelope on upload to a typed error (no retry on multipart)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(errorEnvelope(100), { status: 400 }));

    const blob = new Blob([new Uint8Array([1])], { type: 'image/png' });
    await expect(makeClient().media.upload(blob)).rejects.toBeInstanceOf(WhatsAppApiError);
    // Multipart uploads are not replayed even though 4xx is non-retryable here.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws on a 401 download and returns no partial binary', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(MEDIA_INFO))
      .mockResolvedValueOnce(jsonResponse(errorEnvelope(190), { status: 401 }));

    await expect(makeClient().media.download(MEDIA_ID)).rejects.toBeInstanceOf(
      WhatsAppAuthenticationError,
    );
  });

  it('throws on a 404 download', async () => {
    fetchMock.mockResolvedValue(jsonResponse(errorEnvelope(100), { status: 404 }));

    await expect(makeClient().media.downloadByUrl(DOWNLOAD_URL)).rejects.toBeInstanceOf(
      WhatsAppApiError,
    );
  });
});

describe('existing JSON path remains unaffected', () => {
  it('sendText still POSTs JSON with application/json', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        messaging_product: 'whatsapp',
        contacts: [{ input: '15551234567', wa_id: '15551234567' }],
        messages: [{ id: 'wamid.ABC' }],
      }),
    );

    await makeClient().messages.sendText('15551234567', 'Hello');
    const { init } = lastCall();
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(typeof init.body).toBe('string');
  });
});
