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
 * Common trailing options accepted by every sender.
 *
 * When `replyToMessageId` is set, the request body carries a root-level
 * `context: { message_id }` (a sibling of `type`), threading the outbound
 * message as a reply to a previously received message.
 */
export interface SendOptions {
  /** WAMID of the message this send should reply to. */
  replyToMessageId?: string;
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
 * Structured name for a contact card. `formatted_name` is required by the API;
 * the remaining component name parts are optional.
 */
export interface ContactName {
  formatted_name: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  suffix?: string;
  prefix?: string;
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

/** A single postal address entry on a contact card. */
export interface ContactAddress {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  country_code?: string;
  type?: string;
}

/** Organization details on a contact card. */
export interface ContactOrg {
  company?: string;
  department?: string;
  title?: string;
}

/** A single URL entry on a contact card. */
export interface ContactUrl {
  url?: string;
  type?: string;
}

/** A contact card. */
export interface Contact {
  name: ContactName;
  phones?: ContactPhone[];
  emails?: ContactEmail[];
  addresses?: ContactAddress[];
  org?: ContactOrg;
  urls?: ContactUrl[];
  /** Birthday in `YYYY-MM-DD` format. */
  birthday?: string;
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

/** Text header for an interactive message. */
export interface InteractiveTextHeader {
  type: 'text';
  text: string;
}

/** Media header for an interactive message (image, video, or document). */
export interface InteractiveMediaHeader {
  type: 'image' | 'video' | 'document';
  image?: MediaSource;
  video?: MediaSource;
  document?: MediaSource;
}

/**
 * Header accepted by interactive senders. A plain string is treated as a text
 * header; a structured object may be a text or media header.
 */
export type InteractiveHeader = string | InteractiveTextHeader | InteractiveMediaHeader;

/** Options for {@link MessagesResource.sendInteractiveButtons}. */
export interface InteractiveButtonsPayload {
  /** Body text shown above the buttons. */
  body: string;
  /** Up to three reply buttons. */
  buttons: { id: string; title: string }[];
  /** Optional header: a plain string (text) or a structured text/media header. */
  header?: InteractiveHeader;
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
  /** Optional header: a plain string (text) or a structured text/media header. */
  header?: InteractiveHeader;
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

/** Options for {@link MessagesResource.sendInteractiveCtaUrl}. */
export interface CtaUrlPayload {
  /** Body text shown above the call-to-action button. */
  body: string;
  /** Visible label of the call-to-action button. */
  displayText: string;
  /** URL the button opens. */
  url: string;
  /** Optional header: a plain string (text) or a structured text/media header. */
  header?: InteractiveHeader;
  /** Optional footer text. */
  footer?: string;
}

/** Options for {@link MessagesResource.sendInteractiveFlow}. */
export interface FlowPayload {
  /** Body text shown above the flow button. */
  body: string;
  /** Visible label of the button that opens the flow. */
  flowCta: string;
  /** Opaque token echoed back on flow completion. */
  flowToken?: string;
  /** Identifier of the published flow. */
  flowId?: string;
  /** Name of the published flow (alternative to `flowId`). */
  flowName?: string;
  /** Flow action, e.g. `navigate` or `data_exchange`. */
  flowAction?: string;
  /** Payload passed to the first screen when `flowAction` is `navigate`. */
  flowActionPayload?: Record<string, unknown>;
  /** Flow mode, e.g. `draft` or `published`. */
  mode?: string;
  /** Optional header: a plain string (text) or a structured text/media header. */
  header?: InteractiveHeader;
  /** Optional footer text. */
  footer?: string;
}

/** Options for {@link MessagesResource.sendLocationRequest}. */
export interface LocationRequestPayload {
  /** Body text shown above the share-location button. */
  body: string;
}

/** Options for {@link MessagesResource.sendProduct}. */
export interface ProductPayload {
  /** Catalog that the product belongs to. */
  catalogId: string;
  /** Retailer-defined identifier of the product. */
  productRetailerId: string;
  /** Optional body text. */
  body?: string;
  /** Optional footer text. */
  footer?: string;
}

/**
 * Address fields for an {@link AddressMessagePayload}. Fields map to snake_case
 * API keys. Some fields are supported only in specific countries (noted below).
 *
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/messages/address-messages
 */
export interface AddressMessageValues {
  /** Full name (India, Singapore). */
  name?: string;
  /** Phone number (India, Singapore). Maps to `phone_number`. */
  phoneNumber?: string;
  /** Street address (India, Singapore). */
  address?: string;
  /** City (India, Singapore). */
  city?: string;
  /** PIN code (India only). Maps to `in_pin_code`; max length 6. */
  inPinCode?: string;
  /** House number (India only). Maps to `house_number`. */
  houseNumber?: string;
  /** Floor number (India only). Maps to `floor_number`. */
  floorNumber?: string;
  /** Tower number (India only). Maps to `tower_number`. */
  towerNumber?: string;
  /** Building name (India only). Maps to `building_name`. */
  buildingName?: string;
  /** Landmark or area (India only). Maps to `landmark_area`. */
  landmarkArea?: string;
  /** State (India only). */
  state?: string;
  /** Postal code (Singapore only). Maps to `sg_post_code`; max length 6. */
  sgPostCode?: string;
  /** Unit number (Singapore only). Maps to `unit_number`. */
  unitNumber?: string;
}

/** A previously saved address offered to the user in an address message. */
export interface AddressMessageSavedAddress {
  /** Identifier echoed back when the saved address is selected. */
  id: string;
  /** The address field values for this saved address. */
  value: AddressMessageValues;
}

/**
 * Options for {@link MessagesResource.sendAddressMessage}.
 *
 * `country` is required and must be `IN` (India) or `SG` (Singapore). The SDK
 * serializes the parameters (country, values, saved addresses, validation
 * errors) into the JSON-encoded `action.parameters` string the API expects.
 */
export interface AddressMessagePayload {
  /** Body text shown above the address form. */
  body: string;
  /** Supported country: `IN` (India) or `SG` (Singapore). */
  country: 'IN' | 'SG';
  /** Pre-filled address field values. Maps to `values`. */
  values?: AddressMessageValues;
  /** Previously saved addresses to offer. Maps to `saved_addresses`. */
  savedAddresses?: AddressMessageSavedAddress[];
  /** Per-field validation error messages keyed by API field name. Maps to `validation_errors`. */
  validationErrors?: Record<string, string>;
  /** Optional header: a plain string (text) or a structured text/media header. */
  header?: InteractiveHeader;
  /** Optional footer text. */
  footer?: string;
}

/** A grouping of products within an interactive product list. */
export interface ProductSection {
  title?: string;
  productItems: { productRetailerId: string }[];
}

/** Options for {@link MessagesResource.sendProductList}. */
export interface ProductListPayload {
  /** Catalog that the products belong to. */
  catalogId: string;
  /** Required text header shown above the list. */
  headerText: string;
  /** Body text shown above the list. */
  body: string;
  /** Grouped product sections. */
  sections: ProductSection[];
  /** Optional footer text. */
  footer?: string;
}
