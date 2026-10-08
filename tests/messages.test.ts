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

describe('MessagesResource reply context', () => {
  it('injects root-level context on sendText', async () => {
    await makeClient().messages.sendText('15551234567', 'Hi', undefined, {
      replyToMessageId: 'wamid.PARENT',
    });
    const { body } = lastRequest();
    expect(body.context).toEqual({ message_id: 'wamid.PARENT' });
    // context is a sibling of type, not nested in the type payload.
    expect((body.text as Record<string, unknown>).context).toBeUndefined();
    expect(body.type).toBe('text');
  });

  it('injects root-level context on sendImage', async () => {
    await makeClient().messages.sendImage(
      '15551234567',
      { link: 'https://example.test/a.jpg' },
      { replyToMessageId: 'wamid.PARENT' },
    );
    const { body } = lastRequest();
    expect(body.context).toEqual({ message_id: 'wamid.PARENT' });
    expect((body.image as Record<string, unknown>).context).toBeUndefined();
  });

  it('injects root-level context on sendReaction', async () => {
    await makeClient().messages.sendReaction(
      '15551234567',
      { messageId: 'wamid.X', emoji: '👍' },
      { replyToMessageId: 'wamid.PARENT' },
    );
    const { body } = lastRequest();
    expect(body.context).toEqual({ message_id: 'wamid.PARENT' });
    expect((body.reaction as Record<string, unknown>).context).toBeUndefined();
  });

  it('injects root-level context on sendInteractiveButtons', async () => {
    await makeClient().messages.sendInteractiveButtons(
      '15551234567',
      { body: 'Pick', buttons: [{ id: 'yes', title: 'Yes' }] },
      { replyToMessageId: 'wamid.PARENT' },
    );
    const { body } = lastRequest();
    expect(body.context).toEqual({ message_id: 'wamid.PARENT' });
    expect((body.interactive as Record<string, unknown>).context).toBeUndefined();
    expect(body.type).toBe('interactive');
  });

  it('omits context when no reply id is given', async () => {
    await makeClient().messages.sendText('15551234567', 'Hi');
    expect(lastRequest().body.context).toBeUndefined();
  });
});

describe('MessagesResource interactive headers', () => {
  it('accepts an image header object on sendInteractiveButtons', async () => {
    await makeClient().messages.sendInteractiveButtons('15551234567', {
      body: 'Pick',
      buttons: [{ id: 'yes', title: 'Yes' }],
      header: { type: 'image', image: { link: 'https://example.test/h.jpg' } },
    });
    expect(lastRequest().body).toMatchObject({
      interactive: {
        header: { type: 'image', image: { link: 'https://example.test/h.jpg' } },
      },
    });
  });

  it('treats a string header as a text header', async () => {
    await makeClient().messages.sendInteractiveButtons('15551234567', {
      body: 'Pick',
      buttons: [{ id: 'yes', title: 'Yes' }],
      header: 'Heading',
    });
    expect(lastRequest().body).toMatchObject({
      interactive: { header: { type: 'text', text: 'Heading' } },
    });
  });

  it('accepts a structured text header object', async () => {
    await makeClient().messages.sendInteractiveList('15551234567', {
      body: 'Choose',
      button: 'Open',
      sections: [{ rows: [{ id: 'a', title: 'Apple' }] }],
      header: { type: 'text', text: 'Heading' },
    });
    expect(lastRequest().body).toMatchObject({
      interactive: { header: { type: 'text', text: 'Heading' } },
    });
  });

  it('throws when a media header lacks an id or link', () => {
    expect(() =>
      makeClient().messages.sendInteractiveButtons('15551234567', {
        body: 'Pick',
        buttons: [{ id: 'yes', title: 'Yes' }],
        header: { type: 'image' },
      }),
    ).toThrow(WhatsAppValidationError);
  });
});

describe('MessagesResource limit validation', () => {
  const client = () => makeClient().messages;

  it('text body 4096 passes and 4097 throws', async () => {
    await client().sendText('15551234567', 'a'.repeat(4096));
    expect(() => client().sendText('15551234567', 'a'.repeat(4097))).toThrow(
      WhatsAppValidationError,
    );
  });

  it('button title 20 passes and 21 throws', async () => {
    await client().sendInteractiveButtons('15551234567', {
      body: 'b',
      buttons: [{ id: 'x', title: 'a'.repeat(20) }],
    });
    expect(() =>
      client().sendInteractiveButtons('15551234567', {
        body: 'b',
        buttons: [{ id: 'x', title: 'a'.repeat(21) }],
      }),
    ).toThrow(WhatsAppValidationError);
  });

  it('button id 256 passes and 257 throws', async () => {
    await client().sendInteractiveButtons('15551234567', {
      body: 'b',
      buttons: [{ id: 'a'.repeat(256), title: 'ok' }],
    });
    expect(() =>
      client().sendInteractiveButtons('15551234567', {
        body: 'b',
        buttons: [{ id: 'a'.repeat(257), title: 'ok' }],
      }),
    ).toThrow(WhatsAppValidationError);
  });

  it('duplicate button ids throw', () => {
    expect(() =>
      client().sendInteractiveButtons('15551234567', {
        body: 'b',
        buttons: [
          { id: 'dup', title: 'a' },
          { id: 'dup', title: 'b' },
        ],
      }),
    ).toThrow(WhatsAppValidationError);
  });

  it('list sections 10 passes and 11 throws', async () => {
    const section = { rows: [{ id: 'r', title: 'row' }] };
    await client().sendInteractiveList('15551234567', {
      body: 'b',
      button: 'Open',
      sections: Array.from({ length: 10 }, () => ({ rows: [] })).map((_, i) =>
        i === 0 ? section : { rows: [] },
      ),
    });
    expect(() =>
      client().sendInteractiveList('15551234567', {
        body: 'b',
        button: 'Open',
        sections: Array.from({ length: 11 }, () => ({ rows: [] })).map((_, i) =>
          i === 0 ? section : { rows: [] },
        ),
      }),
    ).toThrow(WhatsAppValidationError);
  });

  it('list total rows 10 passes and 11 throws', async () => {
    const rows10 = Array.from({ length: 10 }, (_, i) => ({ id: `r${i}`, title: 't' }));
    await client().sendInteractiveList('15551234567', {
      body: 'b',
      button: 'Open',
      sections: [{ rows: rows10 }],
    });
    const rows11 = Array.from({ length: 11 }, (_, i) => ({ id: `r${i}`, title: 't' }));
    expect(() =>
      client().sendInteractiveList('15551234567', {
        body: 'b',
        button: 'Open',
        sections: [{ rows: rows11 }],
      }),
    ).toThrow(WhatsAppValidationError);
  });

  it('list row title 24 passes and 25 throws', async () => {
    await client().sendInteractiveList('15551234567', {
      body: 'b',
      button: 'Open',
      sections: [{ rows: [{ id: 'r', title: 'a'.repeat(24) }] }],
    });
    expect(() =>
      client().sendInteractiveList('15551234567', {
        body: 'b',
        button: 'Open',
        sections: [{ rows: [{ id: 'r', title: 'a'.repeat(25) }] }],
      }),
    ).toThrow(WhatsAppValidationError);
  });

  it('list row description 72 passes and 73 throws', async () => {
    await client().sendInteractiveList('15551234567', {
      body: 'b',
      button: 'Open',
      sections: [{ rows: [{ id: 'r', title: 't', description: 'a'.repeat(72) }] }],
    });
    expect(() =>
      client().sendInteractiveList('15551234567', {
        body: 'b',
        button: 'Open',
        sections: [{ rows: [{ id: 'r', title: 't', description: 'a'.repeat(73) }] }],
      }),
    ).toThrow(WhatsAppValidationError);
  });

  it('list button label 20 passes and 21 throws', async () => {
    await client().sendInteractiveList('15551234567', {
      body: 'b',
      button: 'a'.repeat(20),
      sections: [{ rows: [{ id: 'r', title: 't' }] }],
    });
    expect(() =>
      client().sendInteractiveList('15551234567', {
        body: 'b',
        button: 'a'.repeat(21),
        sections: [{ rows: [{ id: 'r', title: 't' }] }],
      }),
    ).toThrow(WhatsAppValidationError);
  });

  it('zero-row list throws', () => {
    expect(() =>
      client().sendInteractiveList('15551234567', {
        body: 'b',
        button: 'Open',
        sections: [{ rows: [] }],
      }),
    ).toThrow(WhatsAppValidationError);
  });

  it('interactive body 1024 passes and 1025 throws', async () => {
    await client().sendInteractiveButtons('15551234567', {
      body: 'a'.repeat(1024),
      buttons: [{ id: 'x', title: 'ok' }],
    });
    expect(() =>
      client().sendInteractiveButtons('15551234567', {
        body: 'a'.repeat(1025),
        buttons: [{ id: 'x', title: 'ok' }],
      }),
    ).toThrow(WhatsAppValidationError);
  });

  it('interactive footer 60 passes and 61 throws', async () => {
    await client().sendInteractiveButtons('15551234567', {
      body: 'b',
      footer: 'a'.repeat(60),
      buttons: [{ id: 'x', title: 'ok' }],
    });
    expect(() =>
      client().sendInteractiveButtons('15551234567', {
        body: 'b',
        footer: 'a'.repeat(61),
        buttons: [{ id: 'x', title: 'ok' }],
      }),
    ).toThrow(WhatsAppValidationError);
  });

  it('text header 60 passes and 61 throws', async () => {
    await client().sendInteractiveButtons('15551234567', {
      body: 'b',
      header: 'a'.repeat(60),
      buttons: [{ id: 'x', title: 'ok' }],
    });
    expect(() =>
      client().sendInteractiveButtons('15551234567', {
        body: 'b',
        header: 'a'.repeat(61),
        buttons: [{ id: 'x', title: 'ok' }],
      }),
    ).toThrow(WhatsAppValidationError);
  });

  it('reaction emoji empty is allowed and over-long is rejected', async () => {
    await client().sendReaction('15551234567', { messageId: 'wamid.X', emoji: '' });
    expect(() =>
      client().sendReaction('15551234567', { messageId: 'wamid.X', emoji: 'a'.repeat(9) }),
    ).toThrow(WhatsAppValidationError);
  });
});

describe('MessagesResource full contact', () => {
  it('sends a fully-populated contact', async () => {
    await makeClient().messages.sendContacts('15551234567', [
      {
        name: {
          formatted_name: 'Ada Lovelace',
          first_name: 'Ada',
          last_name: 'Lovelace',
          middle_name: 'Byron',
          prefix: 'Ms',
          suffix: 'PhD',
        },
        phones: [{ phone: '+15551234567', type: 'WORK', wa_id: '15551234567' }],
        emails: [{ email: 'ada@example.test', type: 'WORK' }],
        addresses: [
          {
            street: '1 Analytical Way',
            city: 'London',
            state: 'LDN',
            zip: 'EC1',
            country: 'United Kingdom',
            country_code: 'GB',
            type: 'WORK',
          },
        ],
        org: { company: 'Analytical Engine', department: 'Research', title: 'Mathematician' },
        urls: [{ url: 'https://example.test', type: 'WORK' }],
        birthday: '1815-12-10',
      },
    ]);
    expect(lastRequest().body).toMatchObject({
      type: 'contacts',
      contacts: [
        {
          name: {
            formatted_name: 'Ada Lovelace',
            middle_name: 'Byron',
            prefix: 'Ms',
            suffix: 'PhD',
          },
          addresses: [{ street: '1 Analytical Way', country_code: 'GB' }],
          org: { company: 'Analytical Engine' },
          urls: [{ url: 'https://example.test' }],
          birthday: '1815-12-10',
        },
      ],
    });
  });
});

describe('MessagesResource new interactive senders', () => {
  it('sendInteractiveCtaUrl builds the cta_url envelope', async () => {
    await makeClient().messages.sendInteractiveCtaUrl('15551234567', {
      body: 'Visit us',
      displayText: 'Open',
      url: 'https://example.test',
      footer: 'footer',
    });
    expect(lastRequest().body).toMatchObject({
      type: 'interactive',
      interactive: {
        type: 'cta_url',
        body: { text: 'Visit us' },
        footer: { text: 'footer' },
        action: {
          name: 'cta_url',
          parameters: { display_text: 'Open', url: 'https://example.test' },
        },
      },
    });
  });

  it('sendInteractiveFlow builds the flow envelope with flow_message_version 3', async () => {
    await makeClient().messages.sendInteractiveFlow('15551234567', {
      body: 'Start',
      flowCta: 'Begin',
      flowId: 'flow-1',
      flowAction: 'navigate',
      flowActionPayload: { screen: 'WELCOME' },
    });
    expect(lastRequest().body).toMatchObject({
      type: 'interactive',
      interactive: {
        type: 'flow',
        body: { text: 'Start' },
        action: {
          name: 'flow',
          parameters: {
            flow_message_version: '3',
            flow_id: 'flow-1',
            flow_action: 'navigate',
            flow_action_payload: { screen: 'WELCOME' },
            flow_cta: 'Begin',
          },
        },
      },
    });
  });

  it('sendInteractiveFlow rejects a flowCta over 20 chars', () => {
    expect(() =>
      makeClient().messages.sendInteractiveFlow('15551234567', {
        body: 'Start',
        flowCta: 'a'.repeat(21),
      }),
    ).toThrow(WhatsAppValidationError);
  });

  it('sendLocationRequest builds the location_request envelope', async () => {
    await makeClient().messages.sendLocationRequest('15551234567', { body: 'Share location' });
    expect(lastRequest().body).toMatchObject({
      type: 'interactive',
      interactive: {
        type: 'location_request_message',
        body: { text: 'Share location' },
        action: { name: 'send_location' },
      },
    });
  });

  it('sendProduct builds the product envelope', async () => {
    await makeClient().messages.sendProduct('15551234567', {
      catalogId: 'cat-1',
      productRetailerId: 'prod-1',
      body: 'Check this out',
    });
    expect(lastRequest().body).toMatchObject({
      type: 'interactive',
      interactive: {
        type: 'product',
        body: { text: 'Check this out' },
        action: { catalog_id: 'cat-1', product_retailer_id: 'prod-1' },
      },
    });
  });

  it('sendProductList builds the product_list envelope', async () => {
    await makeClient().messages.sendProductList('15551234567', {
      catalogId: 'cat-1',
      headerText: 'Our products',
      body: 'Browse',
      sections: [{ title: 'Featured', productItems: [{ productRetailerId: 'p1' }] }],
      footer: 'footer',
    });
    expect(lastRequest().body).toMatchObject({
      type: 'interactive',
      interactive: {
        type: 'product_list',
        header: { type: 'text', text: 'Our products' },
        body: { text: 'Browse' },
        footer: { text: 'footer' },
        action: {
          catalog_id: 'cat-1',
          sections: [{ title: 'Featured', product_items: [{ product_retailer_id: 'p1' }] }],
        },
      },
    });
  });

  it('sendProductList rejects more than 30 product items', () => {
    const productItems = Array.from({ length: 31 }, (_, i) => ({ productRetailerId: `p${i}` }));
    expect(() =>
      makeClient().messages.sendProductList('15551234567', {
        catalogId: 'cat-1',
        headerText: 'Our products',
        body: 'Browse',
        sections: [{ productItems }],
      }),
    ).toThrow(WhatsAppValidationError);
  });
});

describe('MessagesResource typing indicator', () => {
  it('sendTypingIndicator posts the read status body with a text typing_indicator', async () => {
    await makeClient().messages.sendTypingIndicator('wamid.X');
    expect(lastRequest().body).toEqual({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: 'wamid.X',
      typing_indicator: { type: 'text' },
    });
  });

  it('honors a per-call phoneNumberId override', async () => {
    const client = new WhatsAppClient({ accessToken: 'secret-token' });
    await client.messages.sendTypingIndicator('wamid.X', '3333333333');
    expect(lastRequest().url).toBe(`${BASE_URL}/3333333333/messages`);
  });
});

describe('MessagesResource address message', () => {
  it('sendAddressMessage builds the address_message envelope with JSON-encoded parameters', async () => {
    await makeClient().messages.sendAddressMessage('15551234567', {
      body: 'Where should we deliver?',
      country: 'IN',
      values: { name: 'Ada', phoneNumber: '15551234567', inPinCode: '560001' },
      footer: 'Thanks',
    });
    const { body } = lastRequest();
    expect(body).toMatchObject({
      type: 'interactive',
      interactive: {
        type: 'address_message',
        body: { text: 'Where should we deliver?' },
        footer: { text: 'Thanks' },
        action: { name: 'address_message' },
      },
    });
    const interactive = body.interactive as Record<string, unknown>;
    const action = interactive.action as Record<string, unknown>;
    expect(typeof action.parameters).toBe('string');
    expect(JSON.parse(action.parameters as string)).toEqual({
      country: 'IN',
      values: { name: 'Ada', phone_number: '15551234567', in_pin_code: '560001' },
    });
  });

  it('maps saved addresses and validation errors into snake_case parameters', async () => {
    await makeClient().messages.sendAddressMessage('15551234567', {
      body: 'Confirm address',
      country: 'SG',
      savedAddresses: [{ id: 'home', value: { city: 'Singapore', sgPostCode: '049712' } }],
      validationErrors: { sg_post_code: 'Invalid post code' },
    });
    const action = (lastRequest().body.interactive as Record<string, unknown>).action as Record<
      string,
      unknown
    >;
    expect(JSON.parse(action.parameters as string)).toEqual({
      country: 'SG',
      saved_addresses: [{ id: 'home', value: { city: 'Singapore', sg_post_code: '049712' } }],
      validation_errors: { sg_post_code: 'Invalid post code' },
    });
  });

  it('rejects a missing or unsupported country', () => {
    expect(() =>
      makeClient().messages.sendAddressMessage('15551234567', {
        body: 'Where?',
        country: '' as unknown as 'IN',
      }),
    ).toThrow(WhatsAppValidationError);
    expect(() =>
      makeClient().messages.sendAddressMessage('15551234567', {
        body: 'Where?',
        country: 'US' as unknown as 'IN',
      }),
    ).toThrow(WhatsAppValidationError);
  });

  it('rejects an in_pin_code longer than 6 characters', () => {
    expect(() =>
      makeClient().messages.sendAddressMessage('15551234567', {
        body: 'Where?',
        country: 'IN',
        values: { inPinCode: '1234567' },
      }),
    ).toThrow(WhatsAppValidationError);
  });

  it('rejects an sg_post_code longer than 6 characters', () => {
    expect(() =>
      makeClient().messages.sendAddressMessage('15551234567', {
        body: 'Where?',
        country: 'SG',
        values: { sgPostCode: '1234567' },
      }),
    ).toThrow(WhatsAppValidationError);
  });

  it('validates body and footer length limits', () => {
    expect(() =>
      makeClient().messages.sendAddressMessage('15551234567', {
        body: 'a'.repeat(1025),
        country: 'IN',
      }),
    ).toThrow(WhatsAppValidationError);
    expect(() =>
      makeClient().messages.sendAddressMessage('15551234567', {
        body: 'Where?',
        country: 'IN',
        footer: 'a'.repeat(61),
      }),
    ).toThrow(WhatsAppValidationError);
  });
});
