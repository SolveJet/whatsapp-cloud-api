/**
 * Request and response types for the WhatsApp Cloud API Messages endpoint.
 *
 * These model the structured payloads POSTed to `${phoneNumberId}/messages`
 * and the shared response envelope. They are intentionally a typed, documented
 * subset of the full Graph API surface; omissions are noted in JSDoc.
 */

/** Response returned by the Cloud API for a successful send. */
export interface SendMessageResponse {
  /** Always `whatsapp` for Cloud API responses. */
  messaging_product: 'whatsapp';
  /** The contacts the message was addressed to, echoing the input identifier. */
  contacts: { input: string; wa_id: string }[];
  /** The accepted messages, each carrying its WhatsApp message ID (WAMID). */
  messages: { id: string; message_status?: string }[];
}

/** Options for {@link MessagesResource.sendText}. */
export interface TextMessageOptions {
  /** Enable link preview rendering for URLs found in the body. */
  previewUrl?: boolean;
}

/**
 * Reference to a media asset, either a previously uploaded media `id` or a
 * publicly reachable `link`. Exactly one of the two is expected.
 */
export type MediaSource = { id: string } | { link: string };

/** Media payload for image and video messages (supports an optional caption). */
export type CaptionedMedia = MediaSource & { caption?: string };

/**
 * Media payload for document messages. Supports an optional caption and a
 * display `filename`.
 */
export type DocumentMedia = MediaSource & { caption?: string; filename?: string };

/** Location payload for {@link MessagesResource.sendLocation}. */
export interface LocationPayload {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

/**
 * Structured name for a contact card.
 *
 * `formatted_name` is required by the API; the component name parts are a
 * documented subset — `middle_name`, `suffix`, and `prefix` are omitted here.
 */
export interface ContactName {
  formatted_name: string;
  first_name?: string;
  last_name?: string;
}

/** A single phone entry on a contact card. */
export interface ContactPhone {
  phone?: string;
  type?: string;
  wa_id?: string;
}

/** A single email entry on a contact card. */
export interface ContactEmail {
  email?: string;
  type?: string;
}

/**
 * A contact card. This is a documented subset of the full contacts object;
 * `addresses`, `org`, `urls`, and `birthday` are intentionally omitted.
 */
export interface Contact {
  name: ContactName;
  phones?: ContactPhone[];
  emails?: ContactEmail[];
}

/** A single parameter inside a template component. */
export interface TemplateParameter {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'video' | 'document' | 'payload';
  text?: string;
  payload?: string;
  image?: MediaSource;
  video?: MediaSource;
  document?: DocumentMedia;
  currency?: { fallback_value: string; code: string; amount_1000: number };
  date_time?: { fallback_value: string };
}

/** A header/body/button component of a template message. */
export interface TemplateComponent {
  type: 'header' | 'body' | 'button';
  /** Required for button components, e.g. `quick_reply` or `url`. */
  sub_type?: string;
  /** Positional index of a button component, as a string per the API. */
  index?: string;
  parameters?: TemplateParameter[];
}

/** Template payload for {@link MessagesResource.sendTemplate}. */
export interface TemplatePayload {
  name: string;
  language: { code: string };
  components?: TemplateComponent[];
}

/** A single reply button in an interactive button message. */
export interface InteractiveReplyButton {
  type: 'reply';
  reply: { id: string; title: string };
}

/** Header for an interactive message. Only the text header is modeled here. */
export interface InteractiveTextHeader {
  type: 'text';
  text: string;
}

/** Options for {@link MessagesResource.sendInteractiveButtons}. */
export interface InteractiveButtonsPayload {
  /** Body text shown above the buttons. */
  body: string;
  /** Up to three reply buttons. */
  buttons: { id: string; title: string }[];
  /** Optional text header. */
  header?: string;
  /** Optional footer text. */
  footer?: string;
}

/** A single selectable row within an interactive list section. */
export interface InteractiveListRow {
  id: string;
  title: string;
  description?: string;
}

/** A grouping of rows within an interactive list. */
export interface InteractiveListSection {
  title?: string;
  rows: InteractiveListRow[];
}

/** Options for {@link MessagesResource.sendInteractiveList}. */
export interface InteractiveListPayload {
  /** Body text shown above the list. */
  body: string;
  /** Label for the button that opens the list. */
  button: string;
  /** Grouped selectable rows. */
  sections: InteractiveListSection[];
  /** Optional text header. */
  header?: string;
  /** Optional footer text. */
  footer?: string;
}

/** Options for {@link MessagesResource.sendReaction}. */
export interface ReactionPayload {
  /** The WAMID of the message being reacted to. */
  messageId: string;
  /** The emoji to apply. An empty string removes a previously set reaction. */
  emoji: string;
}
