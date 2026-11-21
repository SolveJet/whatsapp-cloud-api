/**
 * Web-runtime entry point: the webhook handler and parsers without any Node-only
 * dependency. Works on Cloudflare Workers, Deno, Bun and Node 20+.
 * Signatures are verified with Web Crypto.
 */
import {
  createWebhookHandlerCore,
  type CreateWebhookHandlerOptions,
  type WebhookHandlerApi,
} from './resources/webhook-handler-core.js';
import { verifySignatureAsync } from './resources/webhook-verify-web.js';

/**
 * Creates an event-driven webhook handler that verifies `X-Hub-Signature-256`
 * with Web Crypto. Register handlers with `on`, then call `handleRequest`.
 */
export const createWebhookHandler = (
  options: CreateWebhookHandlerOptions = {},
): WebhookHandlerApi => createWebhookHandlerCore(verifySignatureAsync, options);

export {
  extractMessages,
  extractStatuses,
  isMessageEvent,
  isStatusEvent,
  parseWebhook,
} from './resources/webhook-core.js';
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
  WebhookMessageContext,
  WebhookMessageError,
  WebhookMessageReferral,
  WebhookMetadata,
  WebhookPayload,
  WebhookRawBody,
  WebhookValue,
  WebhookVerificationResult,
} from './types/webhooks.js';
