/**
 * TypeScript SDK for the WhatsApp Cloud API
 * (Meta-hosted WhatsApp Business Platform).
 *
 * Exposes the {@link WhatsAppClient} with a typed HTTP core, a typed error
 * hierarchy, the outbound Messages API (`client.messages`), and framework-
 * agnostic webhook utilities (verification, signature validation, and typed
 * inbound parsing), and the Media API (`client.media`) for upload, URL
 * resolution, download, and deletion. Also exposes phone-number management
 * (`client.phoneNumbers`) and WhatsApp Business Account management
 * (`client.waba`). Template management is not yet implemented.
 */

import { HttpClient } from './http.js';
import { MediaResource } from './resources/media.js';
import { MessagesResource } from './resources/messages.js';
import { PhoneNumbersResource } from './resources/phone-numbers.js';
import { WabaResource } from './resources/waba.js';
import type { RequestOptions } from './types/common.js';

export {
  WhatsAppApiError,
  WhatsAppAuthenticationError,
  WhatsAppError,
  WhatsAppRateLimitError,
  WhatsAppReEngagementError,
  WhatsAppRequestError,
  WhatsAppValidationError,
  WhatsAppWebhookError,
  WhatsAppErrorCode,
  errorFromResponse,
} from './errors.js';
export type { WhatsAppApiErrorFields, WhatsAppErrorCodeValue } from './errors.js';
export type {
  GraphErrorEnvelope,
  HttpMethod,
  RequestOptions,
  ResponseType,
  SuccessResponse,
} from './types/common.js';

export { MediaResource } from './resources/media.js';
export type {
  DeleteMediaResponse,
  DownloadMediaResult,
  MediaBytes,
  MediaInfo,
  MediaRequestOptions,
  MediaUploadInput,
  UploadMediaResponse,
} from './types/media.js';

export { MessagesResource } from './resources/messages.js';
export type {
  AddressMessagePayload,
  AddressMessageSavedAddress,
  AddressMessageValues,
  CaptionedMedia,
  Contact,
  ContactAddress,
  ContactEmail,
  ContactName,
  ContactOrg,
  ContactPhone,
  ContactUrl,
  CtaUrlPayload,
  DocumentMedia,
  FlowPayload,
  InteractiveButtonsPayload,
  InteractiveHeader,
  InteractiveListPayload,
  InteractiveListRow,
  InteractiveListSection,
  InteractiveMediaHeader,
  InteractiveReplyButton,
  InteractiveTextHeader,
  LocationPayload,
  LocationRequestPayload,
  MediaSource,
  ProductListPayload,
  ProductPayload,
  ProductSection,
  ReactionPayload,
  SendMessageResponse,
  SendOptions,
  TemplateComponent,
  TemplateParameter,
  TemplatePayload,
  TextMessageOptions,
} from './types/messages.js';

export {
  WebhookHandler,
  extractMessages,
  extractStatuses,
  isMessageEvent,
  isStatusEvent,
  parseWebhook,
  verifySignature,
  verifyWebhook,
  verifyWebhookQuery,
} from './resources/webhooks.js';
export type { WebhookVerificationResult } from './resources/webhooks.js';
export type {
  AudioIncomingMessage,
  ButtonIncomingMessage,
  ContactsIncomingMessage,
  DocumentIncomingMessage,
  ImageIncomingMessage,
  IncomingContactCard,
  IncomingMediaObject,
  IncomingMessage,
  InteractiveIncomingMessage,
  InteractiveNfmReply,
  LocationIncomingMessage,
  MessageStatus,
  ParsedWebhook,
  ReactionIncomingMessage,
  StickerIncomingMessage,
  TextIncomingMessage,
  UnknownIncomingMessage,
  VideoIncomingMessage,
  WebhookChange,
  WebhookContact,
  WebhookEntry,
  WebhookHandlerConfig,
  WebhookMessageContext,
  WebhookMessageError,
  WebhookMetadata,
  WebhookPayload,
  WebhookValue,
} from './types/webhooks.js';

export { PhoneNumbersResource } from './resources/phone-numbers.js';
export type {
  BusinessProfile,
  BusinessProfileUpdate,
  BusinessProfileVertical,
  PhoneNumber,
  RegisterOptions,
  RequestVerificationCodeOptions,
} from './types/phone-numbers.js';

export { WabaResource } from './resources/waba.js';
export type {
  ListPhoneNumbersOptions,
  Paging,
  PagingCursors,
  PhoneNumberList,
  SubscribedApp,
  SubscribedAppList,
  Waba,
} from './types/waba.js';

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
  private mediaResource?: MediaResource;
  private phoneNumbersResource?: PhoneNumbersResource;
  private wabaResource?: WabaResource;

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

  /**
   * Typed Media API. Lazily instantiated on first access and reused
   * thereafter, bound to the internal request path and the configured default
   * phone number ID.
   */
  get media(): MediaResource {
    this.mediaResource ??= new MediaResource(
      (options) => this.http.request(options),
      () => this.config.phoneNumberId,
    );
    return this.mediaResource;
  }

  /**
   * Typed phone-number management API. Lazily instantiated on first access and
   * reused thereafter, bound to the internal request path and the configured
   * default phone number ID.
   */
  get phoneNumbers(): PhoneNumbersResource {
    this.phoneNumbersResource ??= new PhoneNumbersResource(
      (options) => this.http.request(options),
      () => this.config.phoneNumberId,
    );
    return this.phoneNumbersResource;
  }

  /**
   * Typed WhatsApp Business Account (WABA) management API. Lazily instantiated
   * on first access and reused thereafter, bound to the internal request path
   * and the configured default business account ID.
   */
  get waba(): WabaResource {
    this.wabaResource ??= new WabaResource(
      (options) => this.http.request(options),
      () => this.config.businessAccountId,
    );
    return this.wabaResource;
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
