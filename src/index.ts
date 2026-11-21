/**
 * TypeScript SDK for the WhatsApp Cloud API
 * (Meta-hosted WhatsApp Business Platform).
 *
 * Exposes the {@link WhatsAppClient} with a typed HTTP core, a typed error
 * hierarchy, the outbound Messages API (`client.messages`), and framework-
 * agnostic webhook utilities (verification, signature validation, and typed
 * inbound parsing), and the Media API (`client.media`) for upload, URL
 * resolution, download, and deletion. Also exposes phone-number management
 * (`client.phoneNumbers`), WhatsApp Business Account management
 * (`client.waba`), message-template management (`client.templates`), the
 * Block API (`client.blocks`) for blocking, unblocking, and listing users,
 * Flows management (`client.flows`) for the interactive-form lifecycle, and
 * the Calling API (`client.calls`) for calling settings and the call
 * lifecycle.
 */

import { HttpClient } from './http.js';
import { BlocksResource } from './resources/blocks.js';
import { CallsResource } from './resources/calls.js';
import { FlowsResource } from './resources/flows.js';
import { MediaResource } from './resources/media.js';
import { MessagesResource } from './resources/messages.js';
import { PhoneNumbersResource } from './resources/phone-numbers.js';
import { TemplatesResource } from './resources/templates.js';
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
  BsuidRecipient,
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
  MessageRecipient,
  ProductListPayload,
  ProductPayload,
  ProductSection,
  ReactionPayload,
  SendMessageResponse,
  SendOptions,
  SendRawOptions,
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
export { createWebhookHandler } from './resources/webhook-handler.js';
export { createMemoryDedupe } from './resources/webhook-dedupe.js';
export type { MemoryDedupeOptions, WebhookDedupe } from './resources/webhook-dedupe.js';
export { parseWebhookEvents } from './resources/webhook-events.js';
export { getUserKey, isKnownMessage, isStale } from './resources/webhook-helpers.js';
export type { IsStaleOptions, UserKeySource } from './resources/webhook-helpers.js';
export { verifySignatureAsync } from './resources/webhook-verify-web.js';
export type {
  CreateWebhookHandlerOptions,
  WebhookDeliveryResult,
  WebhookErrorInfo,
  WebhookHandlerApi,
  WebhookHandlerFn,
  WebhookRequestOptions,
  WebhookSignatureVerifier,
  WebhookTenant,
} from './resources/webhook-handler-core.js';
export type {
  AccountValue,
  AccountWebhookEvent,
  CallRecord,
  CallStatusRecord,
  CallWebhookEvent,
  FlowEventName,
  FlowValue,
  FlowWebhookEvent,
  GroupValue,
  GroupWebhookEvent,
  TemplateValue,
  TemplateWebhookEvent,
  UnknownEventPayload,
  WebhookContext,
  WebhookEvent,
  WebhookEventMap,
  WebhookEventName,
} from './types/webhook-events.js';
export type {
  AudioIncomingMessage,
  ButtonIncomingMessage,
  ContactsIncomingMessage,
  DocumentIncomingMessage,
  EditIncomingMessage,
  ImageIncomingMessage,
  IncomingContactCard,
  IncomingMediaObject,
  IncomingMessage,
  IncomingOrderProductItem,
  InteractiveIncomingMessage,
  InteractiveNfmReply,
  LocationIncomingMessage,
  MessageStatus,
  OrderIncomingMessage,
  ParsedWebhook,
  ParseWebhookOptions,
  ReactionIncomingMessage,
  RevokeIncomingMessage,
  StickerIncomingMessage,
  SystemIncomingMessage,
  TextIncomingMessage,
  UnknownIncomingMessage,
  UnsupportedIncomingMessage,
  VideoIncomingMessage,
  WebhookChange,
  WebhookContact,
  WebhookEntry,
  WebhookHandlerConfig,
  WebhookMessageContext,
  WebhookMessageError,
  WebhookMessageReferral,
  WebhookMetadata,
  WebhookPayload,
  WebhookRawBody,
  WebhookValue,
  WebhookVerificationResult,
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

export { TemplatesResource } from './resources/templates.js';
export type { DeleteTemplateOptions, ListTemplatesOptions } from './resources/templates.js';
export type {
  CreateTemplatePayload,
  CreateTemplateResponse,
  EditTemplatePayload,
  MessageTemplate,
  TemplateButton,
  TemplateCategory,
  TemplateList,
  TemplateNamedParamExample,
  TemplateParameterFormat,
  TemplateStatus,
} from './types/templates.js';
export type { TemplateComponent as MessageTemplateComponent } from './types/templates.js';

export { BlocksResource } from './resources/blocks.js';
export type {
  BlockUsersResponse,
  BlockedUser,
  BlockedUserList,
  FailedBlockUser,
  ListBlockedUsersOptions,
} from './types/blocks.js';

export { FlowsResource } from './resources/flows.js';
export type {
  CreateFlowPayload,
  CreateFlowResponse,
  Flow,
  FlowAsset,
  FlowAssetList,
  FlowCategory,
  FlowJsonInput,
  FlowList,
  FlowPreview,
  FlowStatus,
  FlowValidationError,
  GetPreviewOptions,
  ListFlowsOptions,
  UpdateFlowJsonOptions,
  UpdateFlowJsonResponse,
  UpdateFlowPayload,
} from './types/flows.js';

export { CallsResource } from './resources/calls.js';
export type {
  CallResponse,
  CallSdp,
  CallingSettings,
  CallingSettingsUpdate,
  InitiateCallOptions,
  PhoneNumberSettings,
  UpdateCallSettingsPayload,
} from './types/calls.js';

/** Default per-attempt request timeout in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 30000;

/** Default maximum number of retries (total attempts = this + 1). */
export const DEFAULT_MAX_RETRIES = 2;

/** Default Graph API version targeted by the client. */
export const DEFAULT_API_VERSION = 'v26.0';

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
  /** Graph API version, e.g. `v26.0`. Defaults to {@link DEFAULT_API_VERSION}. */
  apiVersion?: string;
  /** Base URL for the Graph API. Defaults to {@link DEFAULT_BASE_URL}. */
  baseUrl?: string;
  /** Per-attempt request timeout in ms. Defaults to {@link DEFAULT_TIMEOUT_MS}. */
  timeoutMs?: number;
  /** Maximum number of retries. Defaults to {@link DEFAULT_MAX_RETRIES}. */
  maxRetries?: number;
  /**
   * Retry message sends on `5xx`, network and timeout failures too. Defaults to
   * `false`: a `POST` to `{phoneNumberId}/messages` (sends, `sendRaw`, mark-as-read
   * and typing indicators) is retried on HTTP `429` only.
   *
   * Meta documents no idempotency key for sends. A `5xx`, timeout or dropped
   * connection can happen after Meta accepted the message, so with this set to
   * `true` a retry can deliver the same message twice. Enable it only if you
   * de-duplicate on your side. Requests aborted through a `signal` and responses
   * that cannot be parsed are never retried. Other requests keep the standard policy.
   */
  retryMessageSends?: boolean;
}

type ResolvedConfig = Required<
  Pick<WhatsAppClientConfig, 'accessToken' | 'apiVersion' | 'baseUrl' | 'timeoutMs' | 'maxRetries'>
> &
  Pick<WhatsAppClientConfig, 'phoneNumberId' | 'businessAccountId'>;

const trimTrailingSlashes = (value: string): string => {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) {
    end -= 1;
  }
  return end === value.length ? value : value.slice(0, end);
};

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
  private templatesResource?: TemplatesResource;
  private blocksResource?: BlocksResource;
  private flowsResource?: FlowsResource;
  private callsResource?: CallsResource;

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
      retryMessageSends: config.retryMessageSends ?? false,
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

  /**
   * Typed message-template management API. Lazily instantiated on first access
   * and reused thereafter, bound to the internal request path and the
   * configured default business account ID.
   */
  get templates(): TemplatesResource {
    this.templatesResource ??= new TemplatesResource(
      (options) => this.http.request(options),
      () => this.config.businessAccountId,
    );
    return this.templatesResource;
  }

  /**
   * Typed Block API. Lazily instantiated on first access and reused
   * thereafter, bound to the internal request path and the configured default
   * phone number ID.
   */
  get blocks(): BlocksResource {
    this.blocksResource ??= new BlocksResource(
      (options) => this.http.request(options),
      () => this.config.phoneNumberId,
    );
    return this.blocksResource;
  }

  /**
   * Typed Flows management API. Lazily instantiated on first access and reused
   * thereafter, bound to the internal request path and the configured default
   * business account ID.
   */
  get flows(): FlowsResource {
    this.flowsResource ??= new FlowsResource(
      (options) => this.http.request(options),
      () => this.config.businessAccountId,
    );
    return this.flowsResource;
  }

  /**
   * Typed WhatsApp Business Calling API. Lazily instantiated on first access
   * and reused thereafter, bound to the internal request path and the
   * configured default phone number ID.
   */
  get calls(): CallsResource {
    this.callsResource ??= new CallsResource(
      (options) => this.http.request(options),
      () => this.config.phoneNumberId,
    );
    return this.callsResource;
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

  /** Returns the resolved, versioned base URL, e.g. `https://graph.facebook.com/v26.0`. */
  getBaseUrl(): string {
    return `${trimTrailingSlashes(this.config.baseUrl)}/${this.config.apiVersion}`;
  }
}
