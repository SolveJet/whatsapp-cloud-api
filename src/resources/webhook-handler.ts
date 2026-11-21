/**
 * `createWebhookHandler` for Node, using the synchronous `node:crypto` signature check.
 */
import {
  createWebhookHandlerCore,
  type CreateWebhookHandlerOptions,
  type WebhookHandlerApi,
} from './webhook-handler-core.js';
import { verifySignature } from './webhooks.js';

/**
 * Creates an event-driven webhook handler that verifies `X-Hub-Signature-256`
 * with `node:crypto`. Register handlers with `on`, then call `handleRequest`
 * (fetch-style frameworks) or `handleDelivery` (raw body plus header).
 */
export const createWebhookHandler = (
  options: CreateWebhookHandlerOptions = {},
): WebhookHandlerApi =>
  createWebhookHandlerCore(
    (rawBody, signatureHeader, secrets) =>
      Promise.resolve(verifySignature(rawBody, signatureHeader, secrets)),
    options,
  );
