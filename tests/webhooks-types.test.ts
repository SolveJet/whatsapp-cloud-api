import { describe, expect, expectTypeOf, it } from 'vitest';
import { extractMessages, extractStatuses } from '../src/index.js';
import type {
  IncomingMediaObject,
  IncomingMessage,
  MessageStatus,
  WebhookContact,
  WebhookEntry,
  WebhookMessageContext,
  WebhookMessageError,
  WebhookPayload,
} from '../src/index.js';

const metadata = { display_phone_number: '15550783881', phone_number_id: '106540352242922' };

const payloadOf = (value: Record<string, unknown>): WebhookPayload =>
  ({
    object: 'whatsapp_business_account',
    entry: [{ id: '1', time: 1750030073, changes: [{ field: 'messages', value }] }],
  }) as unknown as WebhookPayload;

describe('message status types', () => {
  it('includes the played status and the optional status fields', () => {
    expectTypeOf<'played'>().toExtend<MessageStatus['status']>();
    expectTypeOf<MessageStatus['recipient_type']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<MessageStatus['recipient_participant_id']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<MessageStatus['recipient_identity_key_hash']>().toEqualTypeOf<
      string | undefined
    >();
    expectTypeOf<MessageStatus['biz_opaque_callback_data']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<NonNullable<MessageStatus['pricing']>['type']>().toEqualTypeOf<
      string | undefined
    >();
    expectTypeOf<NonNullable<MessageStatus['pricing']>['subtype']>().toEqualTypeOf<
      string | undefined
    >();
  });

  it('keeps required fields required', () => {
    expectTypeOf<MessageStatus['id']>().toEqualTypeOf<string>();
    expectTypeOf<MessageStatus['recipient_id']>().toEqualTypeOf<string>();
    expectTypeOf<WebhookMessageError['code']>().toEqualTypeOf<number>();
  });

  it('extracts a played status with group and pricing details', () => {
    const [status] = extractStatuses(
      payloadOf({
        messaging_product: 'whatsapp',
        metadata,
        statuses: [
          {
            id: 'wamid.1',
            status: 'played',
            timestamp: '1750030073',
            recipient_id: '120363000000000000@g.us',
            recipient_type: 'group',
            recipient_participant_id: '16505551234',
            recipient_identity_key_hash: 'DF2lS5v2W6x=',
            biz_opaque_callback_data: 'order-42',
            pricing: {
              billable: false,
              pricing_model: 'PMP',
              type: 'free_customer_service',
              category: 'service',
              subtype: 'free_tier',
            },
            errors: [{ code: 131049, title: 't', href: '/documentation/errors' }],
          },
        ],
      }),
    );
    expect(status?.status).toBe('played');
    expect(status?.biz_opaque_callback_data).toBe('order-42');
    expect(status?.pricing?.type).toBe('free_customer_service');
    expect(status?.pricing?.subtype).toBe('free_tier');
    expect(status?.recipient_type).toBe('group');
    expect(status?.errors?.[0]?.href).toBe('/documentation/errors');
  });

  it('narrows exhaustively over the status union including played', () => {
    const describeStatus = (status: MessageStatus['status']): string => {
      switch (status) {
        case 'sent':
        case 'delivered':
        case 'read':
        case 'played':
        case 'failed':
        case 'deleted':
        case 'warning':
          return status;
        default: {
          const unreachable: never = status;
          return unreachable;
        }
      }
    };
    expect(describeStatus('played')).toBe('played');
  });
});

describe('envelope and contact types', () => {
  it('has optional entry time, webhook error href and contact identity_key_hash', () => {
    expectTypeOf<WebhookEntry['time']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<WebhookMessageError['href']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<WebhookContact['identity_key_hash']>().toEqualTypeOf<string | undefined>();
  });
});

describe('incoming message types', () => {
  it('has optional context.forwarded, frequently_forwarded and referred_product', () => {
    expectTypeOf<WebhookMessageContext['forwarded']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<WebhookMessageContext['frequently_forwarded']>().toEqualTypeOf<
      boolean | undefined
    >();
    expectTypeOf<NonNullable<WebhookMessageContext['referred_product']>>().toEqualTypeOf<{
      catalog_id: string;
      product_retailer_id: string;
    }>();
  });

  it('has optional media url, sticker animated and location url', () => {
    expectTypeOf<IncomingMediaObject['url']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<IncomingMediaObject['animated']>().toEqualTypeOf<boolean | undefined>();
    const location = {} as Extract<IncomingMessage, { type: 'location' }>['location'];
    expectTypeOf(location.url).toEqualTypeOf<string | undefined>();
  });

  it('has an optional Click to WhatsApp referral and errors on every message', () => {
    type Referral = NonNullable<IncomingMessage['referral']>;
    expectTypeOf<Referral['source_url']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Referral['source_id']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Referral['source_type']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Referral['body']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Referral['headline']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Referral['media_type']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Referral['image_url']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Referral['video_url']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Referral['thumbnail_url']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<Referral['ctwa_clid']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<NonNullable<Referral['welcome_message']>['text']>().toEqualTypeOf<
      string | undefined
    >();
    expectTypeOf<IncomingMessage['errors']>().toEqualTypeOf<WebhookMessageError[] | undefined>();
  });

  it('keeps reaction.emoji typed as string for existing readers', () => {
    const reaction = {} as Extract<IncomingMessage, { type: 'reaction' }>['reaction'];
    expectTypeOf(reaction.emoji).toEqualTypeOf<string>();
  });

  it('extracts a Click to WhatsApp message with context and media details', () => {
    const messages = extractMessages(
      payloadOf({
        messaging_product: 'whatsapp',
        metadata,
        messages: [
          {
            from: '16505551234',
            id: 'wamid.1',
            timestamp: '1750275992',
            type: 'text',
            text: { body: 'Can I get more info?' },
            context: {
              from: '15550783881',
              id: 'wamid.0',
              forwarded: true,
              referred_product: {
                catalog_id: '194836987003835',
                product_retailer_id: 'di9ozbzfi4',
              },
            },
            referral: {
              source_url: 'https://fb.me/3cr4Wqqkv',
              source_id: '120226305854810726',
              source_type: 'ad',
              body: 'Summer Succulents are here!',
              headline: 'Chat with us',
              media_type: 'image',
              image_url: 'https://scontent.xx.fbcdn.net/v/t45.1...',
              ctwa_clid: 'Aff-n8',
              welcome_message: { text: 'Hi there!' },
            },
          },
          {
            from: '16505551234',
            id: 'wamid.2',
            timestamp: '1750275993',
            type: 'unsupported',
            errors: [{ code: 131051, title: 'Message type unknown' }],
          },
          {
            from: '16505551234',
            id: 'wamid.3',
            timestamp: '1750275994',
            type: 'sticker',
            sticker: { id: 's1', url: 'https://lookaside.fbsbx.com/x', animated: true },
          },
        ],
      }),
    );
    const [text, unsupported, sticker] = messages;
    expect(text?.referral?.ctwa_clid).toBe('Aff-n8');
    expect(text?.referral?.welcome_message?.text).toBe('Hi there!');
    expect(text?.context?.forwarded).toBe(true);
    expect(text?.context?.referred_product?.catalog_id).toBe('194836987003835');
    expect(unsupported?.errors?.[0]?.code).toBe(131051);
    if (sticker?.type === 'sticker') {
      expect(sticker.sticker.animated).toBe(true);
      expect(sticker.sticker.url).toBe('https://lookaside.fbsbx.com/x');
    } else {
      expect.unreachable();
    }
  });
});
