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
  CtaUrlPayload,
  DocumentMedia,
  FlowPayload,
  InteractiveButtonsPayload,
  InteractiveHeader,
  InteractiveListPayload,
  InteractiveMediaHeader,
  InteractiveReplyButton,
  InteractiveTextHeader,
  LocationPayload,
  LocationRequestPayload,
  MediaSource,
  ProductListPayload,
  ProductPayload,
  ReactionPayload,
  SendMessageResponse,
  SendOptions,
  TemplatePayload,
  TextMessageOptions,
} from '../types/messages.js';

/** Bound request function supplied by {@link WhatsAppClient}. */
export type RequestFn = <T>(options: RequestOptions) => Promise<T>;

/** Accessor returning the client's default phone number ID, if configured. */
export type PhoneNumberIdAccessor = () => string | undefined;

/** Maximum number of reply buttons allowed in an interactive button message. */
const MAX_REPLY_BUTTONS = 3;

/** Documented client-side limits for the Messages API (UTF-16 unit counts). */
const LIMITS = {
  textBody: 4096,
  interactiveBody: 1024,
  footer: 60,
  textHeader: 60,
  buttonTitle: 20,
  buttonId: 256,
  listButton: 20,
  listSections: 10,
  listRows: 10,
  listRowTitle: 24,
  listRowDescription: 72,
  reactionEmoji: 8,
  flowCta: 20,
  productListItems: 30,
} as const;

/** True when a {@link MediaSource} carries either an `id` or a `link`. */
const hasMediaSource = (media: MediaSource): boolean =>
  ('id' in media && media.id !== '') || ('link' in media && media.link !== '');

/** True when a string contains a UTF-16 surrogate pair (e.g. an emoji). */
const containsSurrogatePair = (value: string): boolean =>
  /[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(value);

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
  sendText(
    to: string,
    text: string,
    opts?: TextMessageOptions,
    options?: SendOptions,
  ): Promise<SendMessageResponse> {
    this.assertTextBody(text);
    return this.send(
      to,
      'text',
      {
        body: text,
        ...(opts?.previewUrl !== undefined ? { preview_url: opts.previewUrl } : {}),
      },
      undefined,
      options,
    );
  }

  /** Sends an image message from an uploaded media id or a public link. */
  sendImage(
    to: string,
    image: CaptionedMedia,
    options?: SendOptions,
  ): Promise<SendMessageResponse> {
    this.assertMedia(image, 'image');
    return this.send(to, 'image', image, undefined, options);
  }

  /** Sends a video message from an uploaded media id or a public link. */
  sendVideo(
    to: string,
    video: CaptionedMedia,
    options?: SendOptions,
  ): Promise<SendMessageResponse> {
    this.assertMedia(video, 'video');
    return this.send(to, 'video', video, undefined, options);
  }

  /** Sends an audio message from an uploaded media id or a public link. */
  sendAudio(to: string, audio: MediaSource, options?: SendOptions): Promise<SendMessageResponse> {
    this.assertMedia(audio, 'audio');
    return this.send(to, 'audio', audio, undefined, options);
  }

  /** Sends a document message, with optional caption and display filename. */
  sendDocument(
    to: string,
    document: DocumentMedia,
    options?: SendOptions,
  ): Promise<SendMessageResponse> {
    this.assertMedia(document, 'document');
    return this.send(to, 'document', document, undefined, options);
  }

  /** Sends a sticker message from an uploaded media id or a public link. */
  sendSticker(
    to: string,
    sticker: MediaSource,
    options?: SendOptions,
  ): Promise<SendMessageResponse> {
    this.assertMedia(sticker, 'sticker');
    return this.send(to, 'sticker', sticker, undefined, options);
  }

  /** Sends a location message. */
  sendLocation(
    to: string,
    location: LocationPayload,
    options?: SendOptions,
  ): Promise<SendMessageResponse> {
    return this.send(
      to,
      'location',
      {
        latitude: location.latitude,
        longitude: location.longitude,
        ...(location.name !== undefined ? { name: location.name } : {}),
        ...(location.address !== undefined ? { address: location.address } : {}),
      },
      undefined,
      options,
    );
  }

  /** Sends one or more contact cards. */
  sendContacts(
    to: string,
    contacts: Contact[],
    options?: SendOptions,
  ): Promise<SendMessageResponse> {
    return this.send(to, 'contacts', contacts, undefined, options);
  }

  /** Sends a pre-approved message template. */
  sendTemplate(
    to: string,
    template: TemplatePayload,
    options?: SendOptions,
  ): Promise<SendMessageResponse> {
    return this.send(
      to,
      'template',
      {
        name: template.name,
        language: template.language,
        ...(template.components !== undefined ? { components: template.components } : {}),
      },
      undefined,
      options,
    );
  }

  /**
   * Sends an interactive message with up to three reply buttons.
   *
   * Throws {@link WhatsAppValidationError} when more than three buttons are given.
   */
  sendInteractiveButtons(
    to: string,
    payload: InteractiveButtonsPayload,
    options?: SendOptions,
  ): Promise<SendMessageResponse> {
    this.assertInteractiveText(payload);
    this.assertButtons(payload.buttons);
    const header = payload.header !== undefined ? this.buildHeader(payload.header) : undefined;
    const buttons: InteractiveReplyButton[] = payload.buttons.map((button) => ({
      type: 'reply',
      reply: { id: button.id, title: button.title },
    }));
    return this.send(
      to,
      'interactive',
      {
        type: 'button',
        ...(header !== undefined ? { header } : {}),
        body: { text: payload.body },
        ...(payload.footer !== undefined ? { footer: { text: payload.footer } } : {}),
        action: { buttons },
      },
      undefined,
      options,
    );
  }

  /** Sends an interactive list message with grouped selectable rows. */
  sendInteractiveList(
    to: string,
    payload: InteractiveListPayload,
    options?: SendOptions,
  ): Promise<SendMessageResponse> {
    this.assertInteractiveText(payload);
    this.assertListLimits(payload);
    const header = payload.header !== undefined ? this.buildHeader(payload.header) : undefined;
    return this.send(
      to,
      'interactive',
      {
        type: 'list',
        ...(header !== undefined ? { header } : {}),
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
      },
      undefined,
      options,
    );
  }

  /**
   * Sends an interactive call-to-action URL message, rendering a tappable
   * button that opens the given URL.
   */
  sendInteractiveCtaUrl(
    to: string,
    payload: CtaUrlPayload,
    options?: SendOptions,
  ): Promise<SendMessageResponse> {
    this.assertInteractiveText(payload);
    const header = payload.header !== undefined ? this.buildHeader(payload.header) : undefined;
    return this.send(
      to,
      'interactive',
      {
        type: 'cta_url',
        ...(header !== undefined ? { header } : {}),
        body: { text: payload.body },
        ...(payload.footer !== undefined ? { footer: { text: payload.footer } } : {}),
        action: {
          name: 'cta_url',
          parameters: { display_text: payload.displayText, url: payload.url },
        },
      },
      undefined,
      options,
    );
  }

  /** Sends an interactive flow message that opens a WhatsApp Flow. */
  sendInteractiveFlow(
    to: string,
    payload: FlowPayload,
    options?: SendOptions,
  ): Promise<SendMessageResponse> {
    this.assertInteractiveText(payload);
    this.assertFlowCta(payload.flowCta);
    const header = payload.header !== undefined ? this.buildHeader(payload.header) : undefined;
    return this.send(
      to,
      'interactive',
      {
        type: 'flow',
        ...(header !== undefined ? { header } : {}),
        body: { text: payload.body },
        ...(payload.footer !== undefined ? { footer: { text: payload.footer } } : {}),
        action: {
          name: 'flow',
          parameters: {
            flow_message_version: '3',
            ...(payload.flowToken !== undefined ? { flow_token: payload.flowToken } : {}),
            ...(payload.flowId !== undefined ? { flow_id: payload.flowId } : {}),
            ...(payload.flowName !== undefined ? { flow_name: payload.flowName } : {}),
            ...(payload.flowAction !== undefined ? { flow_action: payload.flowAction } : {}),
            ...(payload.flowActionPayload !== undefined
              ? { flow_action_payload: payload.flowActionPayload }
              : {}),
            ...(payload.mode !== undefined ? { mode: payload.mode } : {}),
            flow_cta: payload.flowCta,
          },
        },
      },
      undefined,
      options,
    );
  }

  /** Sends an interactive location-request message prompting the user to share. */
  sendLocationRequest(
    to: string,
    payload: LocationRequestPayload,
    options?: SendOptions,
  ): Promise<SendMessageResponse> {
    this.assertInteractiveText({ body: payload.body });
    return this.send(
      to,
      'interactive',
      {
        type: 'location_request_message',
        body: { text: payload.body },
        action: { name: 'send_location' },
      },
      undefined,
      options,
    );
  }

  /** Sends a single-product interactive message from a catalog. */
  sendProduct(
    to: string,
    payload: ProductPayload,
    options?: SendOptions,
  ): Promise<SendMessageResponse> {
    if (payload.body !== undefined) {
      this.assertInteractiveText({
        body: payload.body,
        ...(payload.footer !== undefined ? { footer: payload.footer } : {}),
      });
    } else if (payload.footer !== undefined) {
      this.assertInteractiveText({ body: '', footer: payload.footer });
    }
    return this.send(
      to,
      'interactive',
      {
        type: 'product',
        ...(payload.body !== undefined ? { body: { text: payload.body } } : {}),
        ...(payload.footer !== undefined ? { footer: { text: payload.footer } } : {}),
        action: {
          catalog_id: payload.catalogId,
          product_retailer_id: payload.productRetailerId,
        },
      },
      undefined,
      options,
    );
  }

  /** Sends a multi-product interactive message from a catalog. */
  sendProductList(
    to: string,
    payload: ProductListPayload,
    options?: SendOptions,
  ): Promise<SendMessageResponse> {
    this.assertInteractiveText(payload);
    this.assertProductListLimits(payload);
    return this.send(
      to,
      'interactive',
      {
        type: 'product_list',
        header: { type: 'text', text: payload.headerText },
        body: { text: payload.body },
        ...(payload.footer !== undefined ? { footer: { text: payload.footer } } : {}),
        action: {
          catalog_id: payload.catalogId,
          sections: payload.sections.map((section) => ({
            ...(section.title !== undefined ? { title: section.title } : {}),
            product_items: section.productItems.map((item) => ({
              product_retailer_id: item.productRetailerId,
            })),
          })),
        },
      },
      undefined,
      options,
    );
  }

  /**
   * Reacts to a previously received message with an emoji.
   *
   * Passing an empty `emoji` removes a previously applied reaction.
   */
  sendReaction(
    to: string,
    reaction: ReactionPayload,
    options?: SendOptions,
  ): Promise<SendMessageResponse> {
    this.assertReactionEmoji(reaction.emoji);
    return this.send(
      to,
      'reaction',
      {
        message_id: reaction.messageId,
        emoji: reaction.emoji,
      },
      undefined,
      options,
    );
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
    options?: SendOptions,
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
        ...(options?.replyToMessageId !== undefined
          ? { context: { message_id: options.replyToMessageId } }
          : {}),
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

  /**
   * Builds an interactive header. A string becomes a text header; a text header
   * object passes through after validation; a media header validates its
   * referenced {@link MediaSource} and emits `{ type, [type]: media }`.
   */
  private buildHeader(header: InteractiveHeader): InteractiveTextHeader | InteractiveMediaHeader {
    if (typeof header === 'string') {
      this.assertLength(header, LIMITS.textHeader, 'Interactive header text');
      return { type: 'text', text: header };
    }
    if (header.type === 'text') {
      this.assertLength(header.text, LIMITS.textHeader, 'Interactive header text');
      return { type: 'text', text: header.text };
    }
    const media = header[header.type];
    if (media === undefined || !hasMediaSource(media)) {
      throw new WhatsAppValidationError(
        `An interactive "${header.type}" header requires a media "id" or "link" in its "${header.type}" field.`,
      );
    }
    return { type: header.type, [header.type]: media };
  }

  /** Throws when a string exceeds `max` UTF-16 units. Never truncates. */
  private assertLength(value: string, max: number, field: string): void {
    if (value.length > max) {
      throw new WhatsAppValidationError(
        `${field} must be at most ${max} characters (received ${value.length}).`,
      );
    }
  }

  /** Validates a text message body against the documented 4096-char limit. */
  private assertTextBody(body: string): void {
    this.assertLength(body, LIMITS.textBody, 'Text body');
  }

  /** Validates the shared body/footer limits for interactive messages. */
  private assertInteractiveText(payload: { body: string; footer?: string }): void {
    this.assertLength(payload.body, LIMITS.interactiveBody, 'Interactive body');
    if (payload.footer !== undefined) {
      this.assertLength(payload.footer, LIMITS.footer, 'Interactive footer');
    }
  }

  /** Validates reply-button count, per-button title/id limits, and id uniqueness. */
  private assertButtons(buttons: { id: string; title: string }[]): void {
    if (buttons.length > MAX_REPLY_BUTTONS) {
      throw new WhatsAppValidationError(
        `Interactive button messages support at most ${MAX_REPLY_BUTTONS} buttons.`,
      );
    }
    const seen = new Set<string>();
    for (const button of buttons) {
      if (button.title === '') {
        throw new WhatsAppValidationError('Each reply button requires a non-empty title.');
      }
      this.assertLength(button.title, LIMITS.buttonTitle, 'Reply button title');
      if (button.id === '') {
        throw new WhatsAppValidationError('Each reply button requires a non-empty id.');
      }
      this.assertLength(button.id, LIMITS.buttonId, 'Reply button id');
      if (seen.has(button.id)) {
        throw new WhatsAppValidationError(
          `Reply button ids must be unique (duplicate "${button.id}").`,
        );
      }
      seen.add(button.id);
    }
  }

  /** Validates the button label, section count, and row limits of a list. */
  private assertListLimits(payload: InteractiveListPayload): void {
    if (payload.button === '') {
      throw new WhatsAppValidationError('An interactive list requires a non-empty button label.');
    }
    this.assertLength(payload.button, LIMITS.listButton, 'Interactive list button label');
    if (payload.sections.length > LIMITS.listSections) {
      throw new WhatsAppValidationError(
        `An interactive list supports at most ${LIMITS.listSections} sections (received ${payload.sections.length}).`,
      );
    }
    let totalRows = 0;
    for (const section of payload.sections) {
      totalRows += section.rows.length;
      for (const row of section.rows) {
        this.assertLength(row.title, LIMITS.listRowTitle, 'Interactive list row title');
        if (row.description !== undefined) {
          this.assertLength(
            row.description,
            LIMITS.listRowDescription,
            'Interactive list row description',
          );
        }
      }
    }
    if (totalRows < 1) {
      throw new WhatsAppValidationError('An interactive list requires at least one row.');
    }
    if (totalRows > LIMITS.listRows) {
      throw new WhatsAppValidationError(
        `An interactive list supports at most ${LIMITS.listRows} rows in total (received ${totalRows}).`,
      );
    }
  }

  /** Validates a reaction emoji: empty is allowed; longer than 8 units is rejected. */
  private assertReactionEmoji(emoji: string): void {
    if (emoji.length > LIMITS.reactionEmoji) {
      throw new WhatsAppValidationError('Reaction emoji must be a single emoji.');
    }
  }

  /** Validates a flow CTA label: at most 20 chars and free of emoji. */
  private assertFlowCta(flowCta: string): void {
    this.assertLength(flowCta, LIMITS.flowCta, 'Flow CTA');
    if (containsSurrogatePair(flowCta)) {
      throw new WhatsAppValidationError('Flow CTA must not contain emoji.');
    }
  }

  /** Validates that a product list carries between 1 and 30 product items. */
  private assertProductListLimits(payload: ProductListPayload): void {
    if (payload.headerText === '') {
      throw new WhatsAppValidationError('A product list requires a non-empty header text.');
    }
    const totalItems = payload.sections.reduce(
      (sum, section) => sum + section.productItems.length,
      0,
    );
    if (totalItems < 1) {
      throw new WhatsAppValidationError('A product list requires at least one product item.');
    }
    if (totalItems > LIMITS.productListItems) {
      throw new WhatsAppValidationError(
        `A product list supports at most ${LIMITS.productListItems} product items (received ${totalItems}).`,
      );
    }
  }
}
