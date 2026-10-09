/**
 * Types for the WhatsApp Business Account (WABA) management endpoints.
 *
 * A WABA is identified by its `{WHATSAPP_BUSINESS_ACCOUNT_ID}` and exposes its
 * details, the phone numbers it owns (`/phone_numbers`), and the apps
 * subscribed to its webhooks (`/subscribed_apps`). Graph responses may carry
 * extra fields beyond those typed here, so permissive shapes allow them.
 */

import type { PhoneNumber } from './phone-numbers.js';

/**
 * A WhatsApp Business Account as returned by the Graph API. Only commonly used
 * fields are typed; an index signature allows any additional Graph fields.
 */
export interface Waba {
  /** The WABA id used in `{WHATSAPP_BUSINESS_ACCOUNT_ID}` paths. */
  id: string;
  /** Display name of the business account. */
  name?: string;
  /** Billing currency, e.g. `USD`. */
  currency?: string;
  /** Timezone id for the account. */
  timezone_id?: string;
  /** Namespace used by this account's message templates. */
  message_template_namespace?: string;
  /** Current account review status. */
  account_review_status?: string;
  /** Additional Graph fields not explicitly typed above. */
  [key: string]: unknown;
}

/** Cursor-based paging markers returned by Graph list endpoints. */
export interface PagingCursors {
  /** Cursor for the previous page. */
  before?: string;
  /** Cursor for the next page. */
  after?: string;
}

/** Paging metadata attached to a Graph list response. */
export interface Paging {
  /** Cursors for navigating pages. */
  cursors?: PagingCursors;
}

/** A page of phone numbers from `GET /{WABA_ID}/phone_numbers`. */
export interface PhoneNumberList {
  /** The phone numbers on this page. */
  data: PhoneNumber[];
  /** Paging metadata, when present. */
  paging?: Paging;
}

/** Options for {@link WabaResource.listPhoneNumbers}. */
export interface ListPhoneNumbersOptions {
  /** Specific fields to request for each phone number. */
  fields?: string[];
}

/**
 * An app subscribed to a WABA's webhooks. The shape is loose because Meta may
 * add fields; the common nested object is typed for convenience.
 */
export interface SubscribedApp {
  /** Details of the subscribed app. */
  whatsapp_business_api_data?: {
    /** The app id. */
    id?: string;
    /** The app name. */
    name?: string;
    /** A link to the app. */
    link?: string;
  };
  /** Additional Graph fields not explicitly typed above. */
  [key: string]: unknown;
}

/** The list returned by `GET /{WABA_ID}/subscribed_apps`. */
export interface SubscribedAppList {
  /** The subscribed apps. */
  data: SubscribedApp[];
}
