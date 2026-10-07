/**
 * TypeScript SDK for the WhatsApp Cloud API
 * (Meta-hosted WhatsApp Business Platform).
 *
 * Exposes the {@link WhatsAppClient} with a typed HTTP core, a typed error
 * hierarchy, and the outbound Messages API (`client.messages`). Template
 * management, media upload/download, and webhook handling are not yet
 * implemented.
 */

import { HttpClient } from './http.js';
import { MessagesResource } from './resources/messages.js';
import type { RequestOptions } from './types/common.js';

export {
  WhatsAppApiError,
  WhatsAppAuthenticationError,
  WhatsAppError,
  WhatsAppRequestError,
  WhatsAppValidationError,
  errorFromResponse,
} from './errors.js';
export type { WhatsAppApiErrorFields } from './errors.js';
export type { GraphErrorEnvelope, HttpMethod, RequestOptions } from './types/common.js';

export { MessagesResource } from './resources/messages.js';
export type {
  CaptionedMedia,
  Contact,
  ContactEmail,
  ContactName,
  ContactPhone,
  DocumentMedia,
  InteractiveButtonsPayload,
  InteractiveListPayload,
  InteractiveListRow,
  InteractiveListSection,
  InteractiveReplyButton,
  InteractiveTextHeader,
  LocationPayload,
  MediaSource,
  ReactionPayload,
  SendMessageResponse,
  TemplateComponent,
  TemplateParameter,
  TemplatePayload,
  TextMessageOptions,
} from './types/messages.js';

/** Default per-attempt request timeout in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 30000;

/** Default maximum number of retries (total attempts = this + 1). */
export const DEFAULT_MAX_RETRIES = 2;

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
  /** Per-attempt request timeout in ms. Defaults to {@link DEFAULT_TIMEOUT_MS}. */
  timeoutMs?: number;
  /** Maximum number of retries. Defaults to {@link DEFAULT_MAX_RETRIES}. */
  maxRetries?: number;
}

type ResolvedConfig = Required<
  Pick<WhatsAppClientConfig, 'accessToken' | 'apiVersion' | 'baseUrl' | 'timeoutMs' | 'maxRetries'>
> &
  Pick<WhatsAppClientConfig, 'phoneNumberId' | 'businessAccountId'>;

const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, '');

/**
 * WhatsApp Cloud API client.
 *
 * Normalizes configuration, resolves the versioned Graph API base URL, owns the
 * HTTP core, and exposes resource APIs such as {@link WhatsAppClient.messages}.
 */
export class WhatsAppClient {
  private readonly config: ResolvedConfig;
  private readonly http: HttpClient;
  private messagesResource?: MessagesResource;

  constructor(config: WhatsAppClientConfig) {
    if (!config.accessToken) {
      throw new Error('WhatsAppClient requires a non-empty "accessToken".');
    }

    this.config = {
      accessToken: config.accessToken,
      apiVersion: config.apiVersion ?? DEFAULT_API_VERSION,
      baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
      ...(config.phoneNumberId !== undefined ? { phoneNumberId: config.phoneNumberId } : {}),
      ...(config.businessAccountId !== undefined
        ? { businessAccountId: config.businessAccountId }
        : {}),
    };

    this.http = new HttpClient({
      accessToken: this.config.accessToken,
      baseUrl: this.getBaseUrl(),
      timeoutMs: this.config.timeoutMs,
      maxRetries: this.config.maxRetries,
    });
  }

  /**
   * Internal request entry point for resource modules. Delegates to the
   * configured {@link HttpClient}. Not part of the stable public surface.
   *
   * @internal
   */
  request<T>(options: RequestOptions): Promise<T> {
    return this.http.request<T>(options);
  }

  /**
   * Typed outbound Messages API. Lazily instantiated on first access and
   * reused thereafter, bound to the internal request path and the configured
   * default phone number ID.
   */
  get messages(): MessagesResource {
    this.messagesResource ??= new MessagesResource(
      (options) => this.http.request(options),
      () => this.config.phoneNumberId,
    );
    return this.messagesResource;
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
