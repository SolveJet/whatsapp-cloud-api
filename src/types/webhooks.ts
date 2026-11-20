/**
 * Types for inbound WhatsApp Cloud API webhook payloads.
 *
 * These model the JSON envelope Meta POSTs to a configured webhook endpoint for
 * incoming messages and message status updates. They are a typed, documented
 * subset of the full webhook surface; the {@link IncomingMessage} union keeps an
 * {@link UnknownIncomingMessage} fallback so unrecognized message types still
 * parse without throwing.
 *
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components
 */

/** Metadata describing the business phone number that received the event. */
export interface WebhookMetadata {
  /** Display phone number of the business, in international format. */
  display_phone_number: string;
  /** Phone number ID used as the sender identifier in the Cloud API. */
  phone_number_id: string;
}

/**
 * A contact profile echoed alongside incoming messages and message statuses.
 *
 * Meta may omit `wa_id` when the user has enabled WhatsApp usernames and no
 * phone number can be shared; it is still typed `string` here so existing code
 * keeps compiling, so check it at runtime. `user_id` (the business-scoped user
 * ID, BSUID) is the stable identifier.
 *
 * @see https://developers.facebook.com/documentation/business-messaging/whatsapp/business-scoped-user-ids
 */
export interface WebhookContact {
  /** The WhatsApp ID (wa_id) of the contact. May be absent for username users. */
  wa_id: string;
  /** The contact's business-scoped user ID (BSUID), e.g. `US.13491208655302741918`. */
  user_id?: string;
  /** The contact's parent BSUID, only present when parent BSUIDs are enabled. */
  parent_user_id?: string;
  /** The contact's profile, when provided. */
  profile?: {
    name?: string;
    /** The user's WhatsApp username, only present when the user enabled usernames. */
    username?: string;
  };
}

/** Reply context linking a message to a previous one. */
export interface WebhookMessageContext {
  /** The wa_id of the sender of the referenced message, when present. */
  from?: string;
  /** The WAMID of the referenced message, when present. */
  id?: string;
}

/** Fields present on every inbound message variant. */
interface IncomingMessageBase {
  /**
   * The wa_id of the sender. Meta may omit it when the sender has enabled
   * usernames and no phone number can be shared; use `from_user_id` then.
   */
  from: string;
  /** The sender's business-scoped user ID (BSUID). */
  from_user_id?: string;
  /** The sender's parent BSUID, only present when parent BSUIDs are enabled. */
  from_parent_user_id?: string;
  /** The group ID, when the message was sent in a group. */
  group_id?: string;
  /** The WhatsApp message ID (WAMID) of this message. */
  id: string;
  /** Unix epoch seconds (as a string) when the message was sent. */
  timestamp: string;
  /** Reply context when this message references a previous message. */
  context?: WebhookMessageContext;
}

/** A text message. */
export interface TextIncomingMessage extends IncomingMessageBase {
  type: 'text';
  text: { body: string };
}

/** Media payload shared by image, video, audio, document, and sticker messages. */
export interface IncomingMediaObject {
  /** Media ID used to download the asset via the media endpoint. */
  id: string;
  /** MIME type of the media, e.g. `image/jpeg`. */
  mime_type?: string;
  /** SHA-256 hash of the media file. */
  sha256?: string;
  /** Optional caption (image, video, document). */
  caption?: string;
  /** Original filename (document). */
  filename?: string;
  /** Whether an audio message is a voice note (audio). */
  voice?: boolean;
}

/** An image message. */
export interface ImageIncomingMessage extends IncomingMessageBase {
  type: 'image';
  image: IncomingMediaObject;
}

/** A video message. */
export interface VideoIncomingMessage extends IncomingMessageBase {
  type: 'video';
  video: IncomingMediaObject;
}

/** An audio (or voice note) message. */
export interface AudioIncomingMessage extends IncomingMessageBase {
  type: 'audio';
  audio: IncomingMediaObject;
}

/** A document message. */
export interface DocumentIncomingMessage extends IncomingMessageBase {
  type: 'document';
  document: IncomingMediaObject;
}

/** A sticker message. */
export interface StickerIncomingMessage extends IncomingMessageBase {
  type: 'sticker';
  sticker: IncomingMediaObject;
}

/** A shared-location message. */
export interface LocationIncomingMessage extends IncomingMessageBase {
  type: 'location';
  location: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
}

/** A single contact card entry on an incoming contacts message. */
export interface IncomingContactCard {
  name?: { formatted_name?: string; first_name?: string; last_name?: string };
  phones?: { phone?: string; wa_id?: string; type?: string }[];
  emails?: { email?: string; type?: string }[];
}

/** A contacts (shared contact cards) message. */
export interface ContactsIncomingMessage extends IncomingMessageBase {
  type: 'contacts';
  contacts: IncomingContactCard[];
}

/**
 * A Native Flow Message reply, used for interactive submissions such as address
 * messages. `response_json` is the RAW JSON string of the submitted field
 * values; it is intentionally left unparsed so a malformed payload never throws
 * during webhook parsing (callers can `JSON.parse` it).
 */
export interface InteractiveNfmReply {
  /** The flow name, e.g. `address_message`. */
  name: string;
  /** The submitted field values as a raw JSON string (not auto-parsed). */
  response_json: string;
  /** Optional human-readable summary of the reply. */
  body?: string;
}

/** The selection payload of an interactive reply. */
export interface InteractiveIncomingMessage extends IncomingMessageBase {
  type: 'interactive';
  interactive: {
    /** The kind of interactive reply received. */
    type: 'button_reply' | 'list_reply' | 'nfm_reply';
    /** Present when `type` is `button_reply`. */
    button_reply?: { id: string; title: string };
    /** Present when `type` is `list_reply`. */
    list_reply?: { id: string; title: string; description?: string };
    /** Present when `type` is `nfm_reply` (e.g. an address-message submission). */
    nfm_reply?: InteractiveNfmReply;
  };
}

/** A quick-reply button tap from a template message. */
export interface ButtonIncomingMessage extends IncomingMessageBase {
  type: 'button';
  button: {
    /** Visible text of the tapped button. */
    text: string;
    /** Developer-defined payload bound to the button. */
    payload: string;
  };
}

/** A reaction (emoji) applied to a previous message. */
export interface ReactionIncomingMessage extends IncomingMessageBase {
  type: 'reaction';
  reaction: {
    /** WAMID of the message being reacted to. */
    message_id: string;
    /** The emoji applied; an empty string indicates a removed reaction. */
    emoji: string;
  };
}

/**
 * A system message, for example when a user changes their phone number or
 * their BSUID changes. `system.type` is `user_changed_number` or
 * `user_changed_user_id`; handle both. Other values may appear as Meta adds them.
 */
export interface SystemIncomingMessage extends IncomingMessageBase {
  type: 'system';
  system: {
    /** Human-readable description of the change. */
    body?: string;
    /** The system event type, e.g. `user_changed_number` or `user_changed_user_id`. */
    type: string;
    /** The user's new phone number; omitted when it cannot be shared. */
    wa_id?: string;
    /** The user's new BSUID. */
    user_id?: string;
    /** The user's new parent BSUID, when parent BSUIDs are enabled. */
    parent_user_id?: string;
    /** The BSUID the user had before the change. */
    previous_user_id?: string;
    /** The parent BSUID the user had before the change. */
    previous_parent_user_id?: string;
  };
}
/**
 * Fallback shape for message types this SDK does not model explicitly.
 *
 * Unrecognized `type` values still parse at runtime and are returned by
 * {@link extractMessages}; they are typed as {@link IncomingMessage}, so a
 * `switch (message.type)` falls through to the `default` branch where the value
 * can be treated as an {@link UnknownIncomingMessage}. It is intentionally NOT a
 * member of the {@link IncomingMessage} union, because an open `type: string`
 * member would defeat discriminated-union narrowing for the known variants.
 */
export interface UnknownIncomingMessage extends IncomingMessageBase {
  /** The raw, unrecognized message type. */
  type: string;
  /** Any additional fields carried by the unrecognized message. */
  [key: string]: unknown;
}

/**
 * Discriminated union of the inbound message types this SDK models, keyed on
 * `type`. Narrowing on a literal `type` (via `switch` or `if`) selects the
 * matching variant.
 *
 * Meta may introduce new message types; those still parse at runtime and are
 * returned by {@link extractMessages} as values whose `type` is none of the
 * known literals. Handle them in a `default` branch (treat as
 * {@link UnknownIncomingMessage}) so new types never break your handler.
 */
export type IncomingMessage =
  | TextIncomingMessage
  | ImageIncomingMessage
  | VideoIncomingMessage
  | AudioIncomingMessage
  | DocumentIncomingMessage
  | StickerIncomingMessage
  | LocationIncomingMessage
  | ContactsIncomingMessage
  | InteractiveIncomingMessage
  | ButtonIncomingMessage
  | ReactionIncomingMessage
  | SystemIncomingMessage;

/** An error entry attached to a failed/warning message status. */
export interface WebhookMessageError {
  /** Numeric Graph error code. */
  code: number;
  /** Short error title. */
  title: string;
  /** Human-readable error message. */
  message?: string;
  /** Additional structured context about the error. */
  error_data?: { details?: string };
}

/** A message status (delivery receipt) update. */
export interface MessageStatus {
  /** WAMID of the message this status refers to. */
  id: string;
  /** The lifecycle state reported for the message. */
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'deleted' | 'warning';
  /** Unix epoch seconds (as a string) when the status was produced. */
  timestamp: string;
  /**
   * The wa_id of the recipient the status concerns. Meta may omit it when the
   * recipient has enabled usernames; use `recipient_user_id` then.
   */
  recipient_id: string;
  /** The recipient's business-scoped user ID (BSUID). */
  recipient_user_id?: string;
  /** The recipient's parent BSUID, only present when parent BSUIDs are enabled. */
  recipient_parent_user_id?: string;
  /** Conversation/pricing context, when provided by Meta. */
  conversation?: {
    id: string;
    origin?: { type?: string };
    expiration_timestamp?: string;
  };
  /** Pricing metadata, when provided by Meta. */
  pricing?: {
    billable?: boolean;
    pricing_model?: string;
    category?: string;
  };
  /** Errors attached to a `failed`/`warning` status. */
  errors?: WebhookMessageError[];
}

/**
 * The `value` object inside a webhook change. Carries EITHER `messages`
 * (incoming) OR `statuses` (updates), never both; `contacts` accompanies either
 * one, and `errors` may also appear independently.
 */
export interface WebhookValue {
  /** Always `whatsapp` for Cloud API webhook values. */
  messaging_product: 'whatsapp';
  /** Business phone number metadata for the event. */
  metadata: WebhookMetadata;
  /** Contact profiles for incoming messages and (except failed) message statuses. */
  contacts?: WebhookContact[];
  /** Inbound messages. */
  messages?: IncomingMessage[];
  /** Message status updates. */
  statuses?: MessageStatus[];
  /** Standalone errors reported on the value. */
  errors?: WebhookMessageError[];
}

/** A single change within an entry. `field` is typically `messages`. */
export interface WebhookChange {
  /** The payload of the change. */
  value: WebhookValue;
  /** The subscription field that produced the change, e.g. `messages`. */
  field: string;
}

/** A single entry within a webhook payload, scoped to one WABA. */
export interface WebhookEntry {
  /** The WhatsApp Business Account (WABA) ID. */
  id: string;
  /** The changes carried by this entry. */
  changes: WebhookChange[];
}

/** The top-level webhook envelope POSTed by Meta. */
export interface WebhookPayload {
  /** Always `whatsapp_business_account` for Cloud API webhooks. */
  object: 'whatsapp_business_account';
  /** One entry per affected WABA. */
  entry: WebhookEntry[];
}

/**
 * A raw webhook request body: a string, a `Uint8Array` (which includes Node's
 * `Buffer`) or an `ArrayBuffer`. Always pass the exact bytes received, never a
 * re-serialized parsed object.
 */
export type WebhookRawBody = string | Uint8Array | ArrayBuffer;

/** Configuration for {@link WebhookHandler}. */
export interface WebhookHandlerConfig {
  /** App Secret used to verify the `X-Hub-Signature-256` header. */
  appSecret?: string;
  /** Verify token used during the GET verification handshake. */
  verifyToken?: string;
  /**
   * Maximum accepted raw body size in bytes for {@link WebhookHandler.parse}.
   * Larger bodies throw `WhatsAppWebhookError` before any hashing or parsing.
   * Defaults to 3 MiB, Meta's documented maximum payload size. Pass `false` to
   * disable the check.
   */
  maxBodyBytes?: number | false;
}

/** Options for {@link parseWebhook}. */
export interface ParseWebhookOptions {
  /**
   * Maximum accepted size in bytes for a string or byte body. Larger bodies
   * throw `WhatsAppWebhookError` before parsing. Defaults to 3 MiB, Meta's
   * documented maximum payload size. Pass `false` to disable the check. It does
   * not apply to an already parsed object.
   */
  maxBodyBytes?: number | false;
}

/** The result of parsing a verified webhook delivery. */
export interface ParsedWebhook {
  /** Inbound messages flattened across all entries/changes. */
  messages: IncomingMessage[];
  /** Message status updates flattened across all entries/changes. */
  statuses: MessageStatus[];
  /** The full validated payload. */
  raw: WebhookPayload;
}
