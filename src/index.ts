/**
 * TypeScript SDK for the WhatsApp Cloud API
 * (Meta-hosted WhatsApp Business Platform).
 *
 * Foundation phase: this module exposes a minimal client skeleton only.
 * The messaging, template, media, and webhook surfaces are not implemented yet.
 */

/** Default Graph API version targeted by the client. */
export const DEFAULT_API_VERSION = 'v23.0';

/** Default base URL for the Meta Graph API. */
export const DEFAULT_BASE_URL = 'https://graph.facebook.com';

/** Configuration accepted by {@link WhatsAppClient}. */
export interface WhatsAppClientConfig {
  /** Permanent or temporary access token used to authenticate requests. */
  accessToken: string;
  /** Phone number ID used as the sender for messaging endpoints. */
  phoneNumberId?: string;
  /** WhatsApp Business Account (WABA) ID. */
  businessAccountId?: string;
  /** Graph API version, e.g. `v23.0`. Defaults to {@link DEFAULT_API_VERSION}. */
  apiVersion?: string;
  /** Base URL for the Graph API. Defaults to {@link DEFAULT_BASE_URL}. */
  baseUrl?: string;
}

type ResolvedConfig = Required<
  Pick<WhatsAppClientConfig, 'accessToken' | 'apiVersion' | 'baseUrl'>
> &
  Pick<WhatsAppClientConfig, 'phoneNumberId' | 'businessAccountId'>;

const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, '');

/**
 * Minimal WhatsApp Cloud API client skeleton.
 *
 * Stores normalized configuration and resolves the Graph API base URL.
 * HTTP calls are intentionally not implemented in the foundation phase.
 */
export class WhatsAppClient {
  private readonly config: ResolvedConfig;

  constructor(config: WhatsAppClientConfig) {
    if (!config.accessToken) {
      throw new Error('WhatsAppClient requires a non-empty "accessToken".');
    }

    this.config = {
      accessToken: config.accessToken,
      apiVersion: config.apiVersion ?? DEFAULT_API_VERSION,
      baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
      ...(config.phoneNumberId !== undefined ? { phoneNumberId: config.phoneNumberId } : {}),
      ...(config.businessAccountId !== undefined
        ? { businessAccountId: config.businessAccountId }
        : {}),
    };
  }

  /** Returns the configured phone number ID, if any. */
  getPhoneNumberId(): string | undefined {
    return this.config.phoneNumberId;
  }

  /** Returns the configured business account ID, if any. */
  getBusinessAccountId(): string | undefined {
    return this.config.businessAccountId;
  }

  /** Returns the Graph API version in use. */
  getApiVersion(): string {
    return this.config.apiVersion;
  }

  /** Returns the resolved, versioned base URL, e.g. `https://graph.facebook.com/v23.0`. */
  getBaseUrl(): string {
    return `${trimTrailingSlashes(this.config.baseUrl)}/${this.config.apiVersion}`;
  }
}
