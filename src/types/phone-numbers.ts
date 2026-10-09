/**
 * Types for the WhatsApp Cloud API phone-number management endpoints.
 *
 * A phone number is identified by its `{PHONE_NUMBER_ID}` and supports
 * verification (`request_code`/`verify_code`), Cloud API registration
 * (`register`/`deregister`), two-step PIN management, and its WhatsApp Business
 * Profile (`whatsapp_business_profile`). Graph responses may carry extra fields
 * beyond those typed here, so permissive shapes allow them to pass through.
 */

/**
 * A WhatsApp phone number as returned by the Graph API. Only the commonly used
 * fields are typed; an index signature allows any additional Graph fields.
 */
export interface PhoneNumber {
  /** The phone number id used in `{PHONE_NUMBER_ID}` paths. */
  id: string;
  /** Human-readable display phone number, e.g. `+1 555-555-5555`. */
  display_phone_number?: string;
  /** The approved display name for the number. */
  verified_name?: string;
  /** Current messaging quality rating, e.g. `GREEN`. */
  quality_rating?: string;
  /** Status of the display-name/code verification flow. */
  code_verification_status?: string;
  /** Status of the display-name review. */
  name_status?: string;
  /** Connection/registration status of the number. */
  status?: string;
  /** Additional Graph fields not explicitly typed above. */
  [key: string]: unknown;
}

/** Delivery method for a phone-number verification code. */
export interface RequestVerificationCodeOptions {
  /** How Meta should deliver the verification code. */
  codeMethod: 'SMS' | 'VOICE';
  /** BCP-47 language/locale for the message, e.g. `en_US`. */
  language: string;
}

/** Options for registering a phone number with the Cloud API. */
export interface RegisterOptions {
  /** The six-digit two-step verification PIN for the number. */
  pin: string;
  /** Optional data-localization region (two-letter country code). */
  dataLocalizationRegion?: string;
}

/**
 * A WhatsApp Business Profile as returned by `GET /{id}/whatsapp_business_profile`.
 * All fields are optional; Meta omits those that are unset.
 */
export interface BusinessProfile {
  /** The "about" text shown on the profile. */
  about?: string;
  /** Business address. */
  address?: string;
  /** Business description. */
  description?: string;
  /** Contact email address. */
  email?: string;
  /** URL of the current profile picture. */
  profile_picture_url?: string;
  /** Up to two associated websites. */
  websites?: string[];
  /** Industry vertical the business belongs to. */
  vertical?: string;
  /** Messaging product the profile belongs to (always `whatsapp`). */
  messaging_product?: string;
}

/**
 * Industry vertical accepted by the Business Profile update endpoint. An empty
 * string clears the vertical.
 */
export type BusinessProfileVertical =
  | 'ALCOHOL'
  | 'APPAREL'
  | 'AUTO'
  | 'BEAUTY'
  | 'EDU'
  | 'ENTERTAIN'
  | 'EVENT_PLAN'
  | 'FINANCE'
  | 'GOVT'
  | 'GROCERY'
  | 'HEALTH'
  | 'HOTEL'
  | 'NONPROFIT'
  | 'ONLINE_GAMBLING'
  | 'OTC_DRUGS'
  | 'OTHER'
  | 'PHYSICAL_GAMBLING'
  | 'PROF_SERVICES'
  | 'RESTAURANT'
  | 'RETAIL'
  | 'TRAVEL'
  | '';

/**
 * Editable fields for a Business Profile update. All fields are optional; only
 * provided fields are sent. `profilePictureHandle` is a media handle obtained
 * from a resumable upload and maps to the API's `profile_picture_handle`.
 */
export interface BusinessProfileUpdate {
  /** The "about" text (1–139 characters when provided). */
  about?: string;
  /** Business address (at most 256 characters). */
  address?: string;
  /** Business description (at most 512 characters). */
  description?: string;
  /** Contact email address (at most 128 characters). */
  email?: string;
  /** Industry vertical; an empty string clears it. */
  vertical?: BusinessProfileVertical;
  /** Up to two websites, each at most 256 characters. */
  websites?: string[];
  /** Resumable-upload handle for a new profile picture. */
  profilePictureHandle?: string;
}
