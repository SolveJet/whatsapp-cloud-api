import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WhatsAppClient, WhatsAppValidationError } from '../src/index.js';
import type { SendMessageResponse } from '../src/index.js';
import { getFirstMessageId } from '../src/resources/messages.js';

const BASE_URL = 'https://graph.facebook.com/v23.0';
const PHONE_ID = '1111111111';

const SUCCESS: SendMessageResponse = {
  messaging_product: 'whatsapp',
  contacts: [{ input: '15551234567', wa_id: '15551234567' }],
  messages: [{ id: 'wamid.ABC123' }],
};

let fetchMock: ReturnType<typeof vi.fn>;

const makeClient = (): WhatsAppClient =>
  new WhatsAppClient({ accessToken: 'secret-token', phoneNumberId: PHONE_ID });

const lastRequest = (): { url: string; init: RequestInit; body: Record<string, unknown> } => {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { url, init, body: JSON.parse(init.body as string) as Record<string, unknown> };
};

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(SUCCESS), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('MessagesResource transport', () => {
  it('POSTs to {phoneNumberId}/messages with auth and content-type headers', async () => {
    const response = await makeClient().messages.sendText('15551234567', 'Hello');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const { url, init } = lastRequest();
    expect(url).toBe(`${BASE_URL}/${PHONE_ID}/messages`);
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer secret-token');
    expect(headers['Content-Type']).toBe('application/json');
    expect(response).toEqual(SUCCESS);
    expect(getFirstMessageId(response)).toBe('wamid.ABC123');
  });

  it('is lazily instantiated and reused across accesses', () => {
    const client = makeClient();
    expect(client.messages).toBe(client.messages);
  });

  it('honors a per-call phoneNumberId override', async () => {
    const client = new WhatsAppClient({ accessToken: 'secret-token' });
    await client.messages.markAsRead('wamid.X', '2222222222');
    expect(lastRequest().url).toBe(`${BASE_URL}/2222222222/messages`);
  });
});

describe('MessagesResource body shapes', () => {
  it('sendText builds the text envelope with preview_url', async () => {
    await makeClient().messages.sendText('15551234567', 'Hi', { previewUrl: true });
    expect(lastRequest().body).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '15551234567',
      type: 'text',
      text: { body: 'Hi', preview_url: true },
    });
  });

  it('sendImage includes the caption and media link', async () => {
    await makeClient().messages.sendImage('15551234567', {
      link: 'https://example.test/a.jpg',
      caption: 'nice',
    });
    expect(lastRequest().body).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '15551234567',
      type: 'image',
      image: { link: 'https://example.test/a.jpg', caption: 'nice' },
    });
  });

  it('sendDocument supports id, caption, and filename', async () => {
    await makeClient().messages.sendDocument('15551234567', {
      id: 'media-1',
      caption: 'report',
      filename: 'report.pdf',
    });
    expect(lastRequest().body).toMatchObject({
      type: 'document',
      document: { id: 'media-1', caption: 'report', filename: 'report.pdf' },
    });
  });

  it('sendLocation builds the location object', async () => {
    await makeClient().messages.sendLocation('15551234567', {
      latitude: 1.5,
      longitude: 2.5,
      name: 'HQ',
    });
    expect(lastRequest().body).toMatchObject({
      type: 'location',
      location: { latitude: 1.5, longitude: 2.5, name: 'HQ' },
    });
  });

  it('sendContacts passes the contacts array', async () => {
    await makeClient().messages.sendContacts('15551234567', [
      { name: { formatted_name: 'Ada Lovelace', first_name: 'Ada' } },
    ]);
    expect(lastRequest().body).toMatchObject({
      type: 'contacts',
      contacts: [{ name: { formatted_name: 'Ada Lovelace', first_name: 'Ada' } }],
    });
  });

  it('sendTemplate builds the template object', async () => {
    await makeClient().messages.sendTemplate('15551234567', {
      name: 'hello_world',
      language: { code: 'en_US' },
    });
    expect(lastRequest().body).toMatchObject({
      type: 'template',
      template: { name: 'hello_world', language: { code: 'en_US' } },
    });
  });

  it('sendInteractiveButtons maps reply buttons', async () => {
    await makeClient().messages.sendInteractiveButtons('15551234567', {
      body: 'Pick one',
      buttons: [
        { id: 'yes', title: 'Yes' },
        { id: 'no', title: 'No' },
      ],
      footer: 'footer',
    });
    expect(lastRequest().body).toMatchObject({
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: 'Pick one' },
        footer: { text: 'footer' },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'yes', title: 'Yes' } },
            { type: 'reply', reply: { id: 'no', title: 'No' } },
          ],
        },
      },
    });
  });

  it('sendInteractiveList builds sections and the button label', async () => {
    await makeClient().messages.sendInteractiveList('15551234567', {
      body: 'Choose',
      button: 'Open',
      sections: [{ title: 'Fruit', rows: [{ id: 'a', title: 'Apple' }] }],
    });
    expect(lastRequest().body).toMatchObject({
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: 'Choose' },
        action: {
          button: 'Open',
          sections: [{ title: 'Fruit', rows: [{ id: 'a', title: 'Apple' }] }],
        },
      },
    });
  });

  it('sendReaction builds the reaction object', async () => {
    await makeClient().messages.sendReaction('15551234567', {
      messageId: 'wamid.X',
      emoji: '👍',
    });
    expect(lastRequest().body).toMatchObject({
      type: 'reaction',
      reaction: { message_id: 'wamid.X', emoji: '👍' },
    });
  });

  it('sendReaction with an empty emoji removes the reaction', async () => {
    await makeClient().messages.sendReaction('15551234567', { messageId: 'wamid.X', emoji: '' });
    expect(lastRequest().body).toMatchObject({
      type: 'reaction',
      reaction: { message_id: 'wamid.X', emoji: '' },
    });
  });

  it('markAsRead posts the read status body', async () => {
    await makeClient().messages.markAsRead('wamid.X');
    expect(lastRequest().body).toEqual({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: 'wamid.X',
    });
  });
});

describe('MessagesResource validation', () => {
  it('throws WhatsAppValidationError for an empty "to"', () => {
    expect(() => makeClient().messages.sendText('', 'Hi')).toThrow(WhatsAppValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws WhatsAppValidationError for more than three interactive buttons', () => {
    expect(() =>
      makeClient().messages.sendInteractiveButtons('15551234567', {
        body: 'Too many',
        buttons: [
          { id: '1', title: 'a' },
          { id: '2', title: 'b' },
          { id: '3', title: 'c' },
          { id: '4', title: 'd' },
        ],
      }),
    ).toThrow(WhatsAppValidationError);
  });

  it('throws WhatsAppValidationError when media has neither id nor link', () => {
    expect(() => makeClient().messages.sendImage('15551234567', { link: '' })).toThrow(
      WhatsAppValidationError,
    );
  });

  it('throws WhatsAppValidationError when no phoneNumberId is configured or passed', () => {
    const client = new WhatsAppClient({ accessToken: 'secret-token' });
    expect(() => client.messages.sendText('15551234567', 'Hi')).toThrow(WhatsAppValidationError);
  });
});
