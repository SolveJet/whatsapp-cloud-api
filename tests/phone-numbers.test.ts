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

const bodyOf = (init: RequestInit): Record<string, unknown> =>
  JSON.parse(init.body as string) as Record<string, unknown>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('PhoneNumbersResource.get', () => {
  it('GETs the phone number without a query when fields are omitted', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: PHONE_ID }));
    const result = await makeClient().phoneNumbers.get();
    expect(result).toEqual({ id: PHONE_ID });
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${PHONE_ID}`);
    expect(init.method).toBe('GET');
  });

  it('appends a comma-separated fields query', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: PHONE_ID }));
    await makeClient().phoneNumbers.get(undefined, ['display_phone_number', 'quality_rating']);
    expect(lastCall().url).toBe(
      `${BASE_URL}/${PHONE_ID}?fields=display_phone_number,quality_rating`,
    );
  });

  it('honors a per-call phoneNumberId override', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: OTHER_PHONE_ID }));
    await makeClient().phoneNumbers.get(OTHER_PHONE_ID);
    expect(lastCall().url).toBe(`${BASE_URL}/${OTHER_PHONE_ID}`);
  });

  it('rejects when no id is configured or provided', async () => {
    await expect(makeClientNoId().phoneNumbers.get()).rejects.toBeInstanceOf(
      WhatsAppValidationError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('PhoneNumbersResource.requestVerificationCode', () => {
  it('POSTs code_method and language', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    const result = await makeClient().phoneNumbers.requestVerificationCode({
      codeMethod: 'SMS',
      language: 'en_US',
    });
    expect(result).toEqual({ success: true });
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${PHONE_ID}/request_code`);
    expect(init.method).toBe('POST');
    expect(bodyOf(init)).toEqual({ code_method: 'SMS', language: 'en_US' });
  });

  it('rejects an invalid code method', async () => {
    await expect(
      makeClient().phoneNumbers.requestVerificationCode({
        codeMethod: 'EMAIL' as unknown as 'SMS',
        language: 'en_US',
      }),
    ).rejects.toBeInstanceOf(WhatsAppValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an empty language', async () => {
    await expect(
      makeClient().phoneNumbers.requestVerificationCode({ codeMethod: 'VOICE', language: '' }),
    ).rejects.toBeInstanceOf(WhatsAppValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('PhoneNumbersResource.verifyCode', () => {
  it('POSTs the numeric code', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    await makeClient().phoneNumbers.verifyCode('123456');
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${PHONE_ID}/verify_code`);
    expect(bodyOf(init)).toEqual({ code: '123456' });
  });

  it('rejects a non-numeric or empty code', async () => {
    await expect(makeClient().phoneNumbers.verifyCode('ab12')).rejects.toBeInstanceOf(
      WhatsAppValidationError,
    );
    await expect(makeClient().phoneNumbers.verifyCode('')).rejects.toBeInstanceOf(
      WhatsAppValidationError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('PhoneNumbersResource.register', () => {
  it('POSTs messaging_product and pin', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    await makeClient().phoneNumbers.register({ pin: '123456' });
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${PHONE_ID}/register`);
    expect(bodyOf(init)).toEqual({ messaging_product: 'whatsapp', pin: '123456' });
  });

  it('includes data_localization_region when provided', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    await makeClient().phoneNumbers.register({ pin: '123456', dataLocalizationRegion: 'DE' });
    expect(bodyOf(lastCall().init)).toEqual({
      messaging_product: 'whatsapp',
      pin: '123456',
      data_localization_region: 'DE',
    });
  });

  it('rejects a non-six-digit pin', async () => {
    await expect(makeClient().phoneNumbers.register({ pin: '12345' })).rejects.toBeInstanceOf(
      WhatsAppValidationError,
    );
    await expect(makeClient().phoneNumbers.register({ pin: 'abcdef' })).rejects.toBeInstanceOf(
      WhatsAppValidationError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('PhoneNumbersResource.deregister', () => {
  it('POSTs to /deregister with no body', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    await makeClient().phoneNumbers.deregister();
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${PHONE_ID}/deregister`);
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
  });
});

describe('PhoneNumbersResource.setTwoStepPin', () => {
  it('POSTs the pin to the phone number node', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    await makeClient().phoneNumbers.setTwoStepPin('654321');
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${PHONE_ID}`);
    expect(init.method).toBe('POST');
    expect(bodyOf(init)).toEqual({ pin: '654321' });
  });

  it('rejects an invalid pin', async () => {
    await expect(makeClient().phoneNumbers.setTwoStepPin('1')).rejects.toBeInstanceOf(
      WhatsAppValidationError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('PhoneNumbersResource.getBusinessProfile', () => {
  it('GETs the profile with default fields and returns the first element', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ about: 'Hello', email: 'a@b.com' }] }));
    const result = await makeClient().phoneNumbers.getBusinessProfile();
    expect(result).toEqual({ about: 'Hello', email: 'a@b.com' });
    expect(lastCall().url).toBe(
      `${BASE_URL}/${PHONE_ID}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`,
    );
  });

  it('uses explicit fields when provided', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ about: 'Hi' }] }));
    await makeClient().phoneNumbers.getBusinessProfile(undefined, ['about']);
    expect(lastCall().url).toBe(`${BASE_URL}/${PHONE_ID}/whatsapp_business_profile?fields=about`);
  });

  it('returns undefined for an empty data array', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }));
    const result = await makeClient().phoneNumbers.getBusinessProfile();
    expect(result).toBeUndefined();
  });
});

describe('PhoneNumbersResource.updateBusinessProfile', () => {
  it('maps profilePictureHandle and includes messaging_product', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    await makeClient().phoneNumbers.updateBusinessProfile({
      about: 'We sell things',
      profilePictureHandle: 'handle-123',
      websites: ['https://a.com'],
      vertical: 'RETAIL',
    });
    const { url, init } = lastCall();
    expect(url).toBe(`${BASE_URL}/${PHONE_ID}/whatsapp_business_profile`);
    expect(bodyOf(init)).toEqual({
      messaging_product: 'whatsapp',
      about: 'We sell things',
      websites: ['https://a.com'],
      vertical: 'RETAIL',
      profile_picture_handle: 'handle-123',
    });
  });

  it('rejects an over-limit about', async () => {
    await expect(
      makeClient().phoneNumbers.updateBusinessProfile({ about: 'x'.repeat(140) }),
    ).rejects.toBeInstanceOf(WhatsAppValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an empty about', async () => {
    await expect(
      makeClient().phoneNumbers.updateBusinessProfile({ about: '' }),
    ).rejects.toBeInstanceOf(WhatsAppValidationError);
  });

  it('rejects over-limit address/description/email', async () => {
    await expect(
      makeClient().phoneNumbers.updateBusinessProfile({ address: 'x'.repeat(257) }),
    ).rejects.toBeInstanceOf(WhatsAppValidationError);
    await expect(
      makeClient().phoneNumbers.updateBusinessProfile({ description: 'x'.repeat(513) }),
    ).rejects.toBeInstanceOf(WhatsAppValidationError);
    await expect(
      makeClient().phoneNumbers.updateBusinessProfile({ email: 'x'.repeat(129) }),
    ).rejects.toBeInstanceOf(WhatsAppValidationError);
  });

  it('rejects more than two websites', async () => {
    await expect(
      makeClient().phoneNumbers.updateBusinessProfile({
        websites: ['https://a.com', 'https://b.com', 'https://c.com'],
      }),
    ).rejects.toBeInstanceOf(WhatsAppValidationError);
  });
});

describe('PhoneNumbersResource wiring', () => {
  it('reuses the same lazily-created resource', () => {
    const client = makeClient();
    expect(client.phoneNumbers).toBe(client.phoneNumbers);
  });
});
