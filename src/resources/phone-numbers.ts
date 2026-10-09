/**
 * Typed phone-number management API for the WhatsApp Cloud API, exposed as
 * `client.phoneNumbers`.
 *
 * Covers reading a phone number's details ({@link PhoneNumbersResource.get}),
 * the verification flow ({@link PhoneNumbersResource.requestVerificationCode},
 * {@link PhoneNumbersResource.verifyCode}), Cloud API registration
 * ({@link PhoneNumbersResource.register},
 * {@link PhoneNumbersResource.deregister}), two-step PIN management
 * ({@link PhoneNumbersResource.setTwoStepPin}), and the WhatsApp Business
 * Profile ({@link PhoneNumbersResource.getBusinessProfile},
 * {@link PhoneNumbersResource.updateBusinessProfile}). Built on the
 * resource-agnostic request function and error hierarchy from the HTTP core.
 */

import { WhatsAppValidationError } from '../errors.js';
import type { SuccessResponse } from '../types/common.js';
import type {
  BusinessProfile,
  BusinessProfileUpdate,
  PhoneNumber,
  RegisterOptions,
  RequestVerificationCodeOptions,
} from '../types/phone-numbers.js';
import type { PhoneNumberIdAccessor, RequestFn } from './messages.js';

/** The messaging product value required on management requests. */
const MESSAGING_PRODUCT = 'whatsapp';

/** Default fields requested when reading a Business Profile. */
const DEFAULT_PROFILE_FIELDS = [
  'about',
  'address',
  'description',
  'email',
  'profile_picture_url',
  'websites',
  'vertical',
] as const;

/** Documented client-side limits for Business Profile fields (UTF-16 units). */
const PROFILE_LIMITS = {
  about: 139,
  address: 256,
  description: 512,
  email: 128,
  website: 256,
  websites: 2,
} as const;

/** Phone-number management API exposed as `client.phoneNumbers`. */
export class PhoneNumbersResource {
  private readonly request: RequestFn;
  private readonly getDefaultPhoneNumberId: PhoneNumberIdAccessor;

  constructor(request: RequestFn, getDefaultPhoneNumberId: PhoneNumberIdAccessor) {
    this.request = request;
    this.getDefaultPhoneNumberId = getDefaultPhoneNumberId;
  }

  /**
   * Reads a phone number's details. Pass `fields` to request specific Graph
   * fields; when omitted no field selection is sent.
   */
  async get(phoneNumberId?: string, fields?: string[]): Promise<PhoneNumber> {
    const id = this.resolvePhoneNumberId(phoneNumberId);
    return this.request<PhoneNumber>({
      method: 'GET',
      path: `${id}${buildFieldsQuery(fields)}`,
    });
  }

  /**
   * Requests a verification code for the phone number via SMS or voice call.
   * Validates the delivery method and that a language is supplied.
   */
  async requestVerificationCode(
    options: RequestVerificationCodeOptions,
    phoneNumberId?: string,
  ): Promise<SuccessResponse> {
    const id = this.resolvePhoneNumberId(phoneNumberId);
    if (options.codeMethod !== 'SMS' && options.codeMethod !== 'VOICE') {
      throw new WhatsAppValidationError('A codeMethod of "SMS" or "VOICE" is required.');
    }
    if (options.language === '') {
      throw new WhatsAppValidationError('A non-empty language is required (e.g. "en_US").');
    }
    return this.request<SuccessResponse>({
      method: 'POST',
      path: `${id}/request_code`,
      body: { code_method: options.codeMethod, language: options.language },
    });
  }

  /**
   * Submits a verification code received via {@link requestVerificationCode}.
   * The code must be a non-empty numeric string.
   */
  async verifyCode(code: string, phoneNumberId?: string): Promise<SuccessResponse> {
    const id = this.resolvePhoneNumberId(phoneNumberId);
    if (!/^\d+$/.test(code)) {
      throw new WhatsAppValidationError('A non-empty numeric verification code is required.');
    }
    return this.request<SuccessResponse>({
      method: 'POST',
      path: `${id}/verify_code`,
      body: { code },
    });
  }

  /**
   * Registers the phone number for Cloud API use with its six-digit two-step
   * PIN, optionally pinning a data-localization region.
   */
  async register(options: RegisterOptions, phoneNumberId?: string): Promise<SuccessResponse> {
    const id = this.resolvePhoneNumberId(phoneNumberId);
    this.assertPin(options.pin);
    return this.request<SuccessResponse>({
      method: 'POST',
      path: `${id}/register`,
      body: {
        messaging_product: MESSAGING_PRODUCT,
        pin: options.pin,
        ...(options.dataLocalizationRegion !== undefined
          ? { data_localization_region: options.dataLocalizationRegion }
          : {}),
      },
    });
  }

  /** Deregisters the phone number from the Cloud API. */
  async deregister(phoneNumberId?: string): Promise<SuccessResponse> {
    const id = this.resolvePhoneNumberId(phoneNumberId);
    return this.request<SuccessResponse>({
      method: 'POST',
      path: `${id}/deregister`,
    });
  }

  /**
   * Sets or changes the phone number's six-digit two-step verification PIN.
   * There is no API to disable two-step verification once enabled.
   */
  async setTwoStepPin(pin: string, phoneNumberId?: string): Promise<SuccessResponse> {
    const id = this.resolvePhoneNumberId(phoneNumberId);
    this.assertPin(pin);
    return this.request<SuccessResponse>({
      method: 'POST',
      path: `${id}`,
      body: { pin },
    });
  }

  /**
   * Reads the WhatsApp Business Profile for the phone number. When `fields` is
   * omitted a sensible default set is requested. Graph returns the profile as
   * the first element of a `data` array; this unwraps it for convenience and
   * returns `undefined` when the array is empty.
   */
  async getBusinessProfile(
    phoneNumberId?: string,
    fields?: string[],
  ): Promise<BusinessProfile | undefined> {
    const id = this.resolvePhoneNumberId(phoneNumberId);
    const selected = fields ?? [...DEFAULT_PROFILE_FIELDS];
    const response = await this.request<{ data?: BusinessProfile[] }>({
      method: 'GET',
      path: `${id}/whatsapp_business_profile${buildFieldsQuery(selected)}`,
    });
    return response.data?.[0];
  }

  /**
   * Updates the WhatsApp Business Profile for the phone number. Only provided
   * fields are sent; `profilePictureHandle` maps to `profile_picture_handle`.
   * Validates documented length and count limits before sending.
   */
  async updateBusinessProfile(
    profile: BusinessProfileUpdate,
    phoneNumberId?: string,
  ): Promise<SuccessResponse> {
    const id = this.resolvePhoneNumberId(phoneNumberId);
    this.assertProfile(profile);
    return this.request<SuccessResponse>({
      method: 'POST',
      path: `${id}/whatsapp_business_profile`,
      body: {
        messaging_product: MESSAGING_PRODUCT,
        ...this.mapProfileValues(profile),
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

  /** Validates that a value is a six-digit numeric PIN. */
  private assertPin(pin: string): void {
    if (!/^\d{6}$/.test(pin)) {
      throw new WhatsAppValidationError('A six-digit numeric PIN is required.');
    }
  }

  /** Validates the documented length/count limits for a profile update. */
  private assertProfile(profile: BusinessProfileUpdate): void {
    if (profile.about !== undefined) {
      if (profile.about === '') {
        throw new WhatsAppValidationError('Business profile "about" must not be empty.');
      }
      this.assertLength(profile.about, PROFILE_LIMITS.about, 'Business profile about');
    }
    if (profile.address !== undefined) {
      this.assertLength(profile.address, PROFILE_LIMITS.address, 'Business profile address');
    }
    if (profile.description !== undefined) {
      this.assertLength(
        profile.description,
        PROFILE_LIMITS.description,
        'Business profile description',
      );
    }
    if (profile.email !== undefined) {
      this.assertLength(profile.email, PROFILE_LIMITS.email, 'Business profile email');
    }
    if (profile.websites !== undefined) {
      if (profile.websites.length > PROFILE_LIMITS.websites) {
        throw new WhatsAppValidationError(
          `Business profile supports at most ${PROFILE_LIMITS.websites} websites (received ${profile.websites.length}).`,
        );
      }
      for (const website of profile.websites) {
        this.assertLength(website, PROFILE_LIMITS.website, 'Business profile website');
      }
    }
  }

  /** Throws when a string exceeds `max` UTF-16 units. Never truncates. */
  private assertLength(value: string, max: number, field: string): void {
    if (value.length > max) {
      throw new WhatsAppValidationError(
        `${field} must be at most ${max} characters (received ${value.length}).`,
      );
    }
  }

  /** Maps camelCase SDK profile fields to the snake_case API shape, omitting undefined. */
  private mapProfileValues(profile: BusinessProfileUpdate): Record<string, unknown> {
    const mapped: Record<string, unknown> = {};
    if (profile.about !== undefined) {
      mapped.about = profile.about;
    }
    if (profile.address !== undefined) {
      mapped.address = profile.address;
    }
    if (profile.description !== undefined) {
      mapped.description = profile.description;
    }
    if (profile.email !== undefined) {
      mapped.email = profile.email;
    }
    if (profile.vertical !== undefined) {
      mapped.vertical = profile.vertical;
    }
    if (profile.websites !== undefined) {
      mapped.websites = profile.websites;
    }
    if (profile.profilePictureHandle !== undefined) {
      mapped.profile_picture_handle = profile.profilePictureHandle;
    }
    return mapped;
  }
}

/**
 * Builds a `?fields=a,b,c` query string with URL-safe, comma-separated field
 * names, or an empty string when no fields are supplied.
 */
export const buildFieldsQuery = (fields?: string[]): string => {
  if (fields === undefined || fields.length === 0) {
    return '';
  }
  return `?fields=${fields.map(encodeURIComponent).join(',')}`;
};
