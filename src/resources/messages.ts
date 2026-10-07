/**
 * Typed outbound Messages API for the WhatsApp Cloud API.
 *
 * Built on the resource-agnostic request function and error hierarchy from the
 * HTTP core. Each sender assembles the common message envelope and POSTs it to
 * `${phoneNumberId}/messages`, returning the parsed {@link SendMessageResponse}.
 */

import { WhatsAppValidationError } from '../errors.js';
import type { RequestOptions } from '../types/common.js';
import type {
  CaptionedMedia,
  Contact,
  DocumentMedia,
  InteractiveButtonsPayload,
  InteractiveListPayload,
  InteractiveReplyButton,
  InteractiveTextHeader,
  LocationPayload,
  MediaSource,
  ReactionPayload,
  SendMessageResponse,
  TemplatePayload,
  TextMessageOptions,
} from '../types/messages.js';

/** Bound request function supplied by {@link WhatsAppClient}. */
export type RequestFn = <T>(options: RequestOptions) => Promise<T>;

/** Accessor returning the client's default phone number ID, if configured. */
export type PhoneNumberIdAccessor = () => string | undefined;

/** Maximum number of reply buttons allowed in an interactive button message. */
const MAX_REPLY_BUTTONS = 3;

/** True when a {@link MediaSource} carries either an `id` or a `link`. */
const hasMediaSource = (media: MediaSource): boolean =>
  ('id' in media && media.id !== '') || ('link' in media && media.link !== '');

/**
 * Reads the first WhatsApp message ID (WAMID) from a send response, if present.
 * The raw response remains the canonical return value of each sender.
 */
export const getFirstMessageId = (response: SendMessageResponse): string | undefined =>
  response.messages[0]?.id;

/** Outbound Messages API exposed as `client.messages`. */
export class MessagesResource {
  private readonly request: RequestFn;
  private readonly getDefaultPhoneNumberId: PhoneNumberIdAccessor;

  constructor(request: RequestFn, getDefaultPhoneNumberId: PhoneNumberIdAccessor) {
    this.request = request;
    this.getDefaultPhoneNumberId = getDefaultPhoneNumberId;
  }

  /** Sends a text message, optionally enabling link previews. */
  sendText(to: string, text: string, opts?: TextMessageOptions): Promise<SendMessageResponse> {
    return this.send(to, 'text', {
      body: text,
      ...(opts?.previewUrl !== undefined ? { preview_url: opts.previewUrl } : {}),
    });
  }

  /** Sends an image message from an uploaded media id or a public link. */
  sendImage(to: string, image: CaptionedMedia): Promise<SendMessageResponse> {
    this.assertMedia(image, 'image');
    return this.send(to, 'image', image);
  }

  /** Sends a video message from an uploaded media id or a public link. */
  sendVideo(to: string, video: CaptionedMedia): Promise<SendMessageResponse> {
    this.assertMedia(video, 'video');
    return this.send(to, 'video', video);
  }

  /** Sends an audio message from an uploaded media id or a public link. */
  sendAudio(to: string, audio: MediaSource): Promise<SendMessageResponse> {
    this.assertMedia(audio, 'audio');
    return this.send(to, 'audio', audio);
  }

  /** Sends a document message, with optional caption and display filename. */
  sendDocument(to: string, document: DocumentMedia): Promise<SendMessageResponse> {
    this.assertMedia(document, 'document');
    return this.send(to, 'document', document);
  }

  /** Sends a sticker message from an uploaded media id or a public link. */
  sendSticker(to: string, sticker: MediaSource): Promise<SendMessageResponse> {
    this.assertMedia(sticker, 'sticker');
    return this.send(to, 'sticker', sticker);
  }

  /** Sends a location message. */
  sendLocation(to: string, location: LocationPayload): Promise<SendMessageResponse> {
    return this.send(to, 'location', {
      latitude: location.latitude,
      longitude: location.longitude,
      ...(location.name !== undefined ? { name: location.name } : {}),
      ...(location.address !== undefined ? { address: location.address } : {}),
    });
  }

  /** Sends one or more contact cards. */
  sendContacts(to: string, contacts: Contact[]): Promise<SendMessageResponse> {
    return this.send(to, 'contacts', contacts);
  }

  /** Sends a pre-approved message template. */
  sendTemplate(to: string, template: TemplatePayload): Promise<SendMessageResponse> {
    return this.send(to, 'template', {
      name: template.name,
      language: template.language,
      ...(template.components !== undefined ? { components: template.components } : {}),
    });
  }

  /**
   * Sends an interactive message with up to three reply buttons.
   *
   * Throws {@link WhatsAppValidationError} when more than three buttons are given.
   */
  sendInteractiveButtons(
    to: string,
    payload: InteractiveButtonsPayload,
  ): Promise<SendMessageResponse> {
    if (payload.buttons.length > MAX_REPLY_BUTTONS) {
      throw new WhatsAppValidationError(
        `Interactive button messages support at most ${MAX_REPLY_BUTTONS} buttons.`,
      );
    }
    const buttons: InteractiveReplyButton[] = payload.buttons.map((button) => ({
      type: 'reply',
      reply: { id: button.id, title: button.title },
    }));
    return this.send(to, 'interactive', {
      type: 'button',
      ...(payload.header !== undefined ? { header: this.textHeader(payload.header) } : {}),
      body: { text: payload.body },
      ...(payload.footer !== undefined ? { footer: { text: payload.footer } } : {}),
      action: { buttons },
    });
  }

  /** Sends an interactive list message with grouped selectable rows. */
  sendInteractiveList(to: string, payload: InteractiveListPayload): Promise<SendMessageResponse> {
    return this.send(to, 'interactive', {
      type: 'list',
      ...(payload.header !== undefined ? { header: this.textHeader(payload.header) } : {}),
      body: { text: payload.body },
      ...(payload.footer !== undefined ? { footer: { text: payload.footer } } : {}),
      action: {
        button: payload.button,
        sections: payload.sections.map((section) => ({
          ...(section.title !== undefined ? { title: section.title } : {}),
          rows: section.rows.map((row) => ({
            id: row.id,
            title: row.title,
            ...(row.description !== undefined ? { description: row.description } : {}),
          })),
        })),
      },
    });
  }

  /**
   * Reacts to a previously received message with an emoji.
   *
   * Passing an empty `emoji` removes a previously applied reaction.
   */
  sendReaction(to: string, reaction: ReactionPayload): Promise<SendMessageResponse> {
    return this.send(to, 'reaction', {
      message_id: reaction.messageId,
      emoji: reaction.emoji,
    });
  }

  /** Marks a received message as read. */
  markAsRead(messageId: string, phoneNumberId?: string): Promise<SendMessageResponse> {
    const id = this.resolvePhoneNumberId(phoneNumberId);
    return this.request<SendMessageResponse>({
      method: 'POST',
      path: `${id}/messages`,
      body: {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      },
    });
  }

  /** Builds the common message envelope and POSTs it to the messages endpoint. */
  private send(
    to: string,
    type: string,
    payload: unknown,
    phoneNumberId?: string,
  ): Promise<SendMessageResponse> {
    if (to === '') {
      throw new WhatsAppValidationError('A non-empty "to" recipient is required.');
    }
    const id = this.resolvePhoneNumberId(phoneNumberId);
    return this.request<SendMessageResponse>({
      method: 'POST',
      path: `${id}/messages`,
      body: {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type,
        [type]: payload,
      },
    });
  }

  /** Resolves a per-call override or the configured default phone number id. */
  private resolvePhoneNumberId(override?: string): string {
    const id = override ?? this.getDefaultPhoneNumberId();
    if (id === undefined || id === '') {
      throw new WhatsAppValidationError(
        'A phoneNumberId is required: pass one or configure it on the client.',
      );
    }
    return id;
  }

  /** Guards that a media payload carries either an id or a link. */
  private assertMedia(media: MediaSource, kind: string): void {
    if (!hasMediaSource(media)) {
      throw new WhatsAppValidationError(
        `A ${kind} message requires either a media "id" or a "link".`,
      );
    }
  }

  /** Builds a text header object for interactive messages. */
  private textHeader(text: string): InteractiveTextHeader {
    return { type: 'text', text };
  }
}
