---
title: 'WhatsApp Cloud API webhook handler with typed events in TypeScript'
description: 'Receive WhatsApp webhooks with createWebhookHandler: signature check, typed message, status, call, flow, template and group events, dedupe, retries and multi-tenant secrets.'
sidebar:
  order: 3
---

`createWebhookHandler` wraps the whole receiving side: it answers the verify-token handshake, checks `X-Hub-Signature-256` against the raw body, parses the delivery, skips duplicates and calls the handlers you register. The lower-level `WebhookHandler`, `verifySignature` and `parseWebhook` stay available and behave as before.

## Create a handler

{{include website/snippets/webhook-handler.ts#create}}

`appSecrets` takes one secret or an array, so you can accept the old and the new App Secret while you rotate. The signature check always runs when a secret is set.

## Register event handlers

{{include website/snippets/webhook-handler.ts#events}}

| Event      | Payload                                    | Meta webhook fields                                                                                                |
| ---------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `message`  | `message`, `ctx`                           | `messages` (one event per message)                                                                                 |
| `status`   | `status`, `ctx`                            | `messages` (one event per status)                                                                                  |
| `error`    | `error`, `ctx`                             | `messages` (one event per `errors[]` entry)                                                                        |
| `call`     | `event` (`connect`, `terminate`, `status`) | `calls`                                                                                                            |
| `flow`     | `event` (`kind` is the flow event name)    | `flows`                                                                                                            |
| `template` | `event`                                    | `message_template_status_update`, `message_template_quality_update`, `template_category_update`                    |
| `account`  | `event`                                    | `phone_number_quality_update`, `account_update`, `account_alerts`, `user_preferences`, `business_username_updates` |
| `group`    | `event`                                    | `group_lifecycle_update`, `group_participants_update`, `group_settings_update`, `group_status_update`              |
| `unknown`  | `field`, `value`, `ctx`                    | every other field, with the untouched `value`                                                                      |

`ctx` carries `wabaId`, `field`, `time`, the phone number `metadata` and the matching `contact` when the delivery has one. Handlers for one event run one after another. Events of one delivery run at the same time, up to `concurrency`. A handler that throws is reported to `onError` and does not stop the others.

## Answer Meta

{{include website/snippets/webhook-handler.ts#delivery}}

{{include website/snippets/webhook-handler.ts#request}}

| Situation                                               | Status                       |
| ------------------------------------------------------- | ---------------------------- |
| Missing or wrong signature, or no tenant resolved       | `401`                        |
| Body over `maxBodyBytes` (3 MiB by default)             | `413`                        |
| Valid signature, body that is not JSON or not a webhook | `200`, reported to `onError` |
| Valid delivery                                          | `200`                        |
| A handler threw and `retryOnHandlerError` is `true`     | `500`                        |
| Method other than `GET` or `POST` on `handleRequest`    | `405`                        |

A valid signature with an unreadable body gets `200` so Meta does not retry a payload that can never parse. The size limit is checked from `content-length` and again while the body streams in.

By default the handlers run before the answer (`ackMode: 'after'`). With `ackMode: 'before'` the handler answers once the delivery is verified and parsed, and runs the handlers in the background. Pass `waitUntil` so serverless platforms keep the invocation alive; see [Edge runtimes](/whatsapp-cloud-api/webhooks/edge-runtimes/).

## Options

{{include website/snippets/webhook-handler.ts#options}}

Meta can deliver the same event more than once. The default dedupe keys are `message:<id>` and `status:<id>:<status>`; other events are not deduplicated. `createMemoryDedupe` keeps keys in memory for one process, so serverless instances do not share it. Pass your own `WebhookDedupe` backed by Redis or a database for that. With `retryOnHandlerError`, keys of failed events are released so Meta's retry is not skipped.

Set `allowUnsigned: true` only when no secret is configured on purpose. Without any secret, the handler accepts unsigned deliveries and emits a one-time warning (`WHATSAPP_WEBHOOK_UNSIGNED`) unless you set it.

## Serve several apps

{{include website/snippets/webhook-handler.ts#tenants}}

Related: [verify the signature](/whatsapp-cloud-api/webhooks/verify-signature/), [handling events](/whatsapp-cloud-api/webhooks/handling-events/) and [testing your webhook handler](/whatsapp-cloud-api/webhooks/testing-your-webhook-handler/).
