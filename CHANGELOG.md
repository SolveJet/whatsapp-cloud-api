# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.1] - 2026-10-08

### Fixed

- npm publish failed provenance validation with `E422` because `package.json` URLs used the lowercase owner `solvejet` while the signed provenance (from the GitHub OIDC claim) uses the canonical `SolveJet`; npm requires `repository.url` to match the provenance exactly, case-sensitively. Corrected `repository.url`, `homepage`, `bugs.url`, and the contributor URL to `SolveJet`. This is the first version actually published to npm with provenance; `0.3.0` was tagged and released on GitHub but never reached npm due to this error.

## [0.3.0] - 2026-10-08

> Note: `0.3.0` was tagged and released on GitHub but never published to npm — its publish failed provenance validation (see `0.3.1`). The features below ship in `0.3.1`.

### Added

- Typing indicator via `client.messages.sendTypingIndicator(messageId, phoneNumberId?)`: marks an inbound message as read and shows a `typing_indicator` of type `text` to the user (dismissed when you send a message or after about 25 seconds). The existing `markAsRead` signature is unchanged.
- Interactive address message via `client.messages.sendAddressMessage` (supported in India and Singapore): a typed `AddressMessagePayload` (body, required `country` of `IN`/`SG`, optional pre-filled `values`, `savedAddresses`, `validationErrors`, plus the shared header/footer) whose camelCase fields map to the snake_case API shape and are serialized into the JSON-encoded `action.parameters` string the API requires. Client-side validation rejects a missing/unsupported country, an `in_pin_code`/`sg_post_code` longer than 6 characters, and over-limit body/footer/header lengths. New exported types `AddressMessagePayload`, `AddressMessageValues`, and `AddressMessageSavedAddress`.
- Inbound parsing for address submissions: the interactive webhook union now carries `nfm_reply` (Native Flow Message reply) with `name`, the RAW `response_json` string (left unparsed so a malformed payload never throws — callers `JSON.parse` it), and an optional `body`. New exported type `InteractiveNfmReply`.

### Fixed

- Release workflow: npm OIDC trusted publishing now works end to end. The publish was failing with a misleading `ENEEDAUTH`; the actual cause was a case mismatch in the npm trusted-publisher config (`solvejet` vs the canonical GitHub owner `SolveJet`), which made npm's token exchange return `404 package not found`. The workflow now uses Node 24's bundled npm, keeps `registry-url` while stripping the empty `_authToken` line setup-node writes, never sets `NODE_AUTH_TOKEN`, and gained a `workflow_dispatch` trigger for manual re-runs. Trusted-publisher field names are case-sensitive and must match the GitHub OIDC claims exactly.

## [0.2.0] - 2026-10-07

### Added

- Media API via `client.media`: `upload` (multipart upload of a `Blob`/`File` or raw bytes with an explicit content type, returning a reusable media `id`), `getUrl` (typed `MediaInfo` with a short-lived download URL), `download`/`downloadByUrl` (fetch the bytes as a `Uint8Array` with the bearer token and a `User-Agent`), and `delete`. Each method accepts an optional `phoneNumberId` override.
- HTTP core support for the media lifecycle: multipart `FormData` request bodies (no manual `Content-Type`, so `fetch` sets the boundary), binary responses (`responseType: 'binary'` returning a `Uint8Array`), absolute `http(s)` download targets used verbatim instead of the base URL, and an optional `User-Agent` header. Non-idempotent multipart uploads run as a single attempt (an unreplayable body is never retried); idempotent `GET`/`DELETE` and downloads still follow the retry policy. Error responses always parse the Graph envelope and throw a typed error — binary callers never receive partial bytes on failure.
- A dependency-audit CI job that runs `pnpm audit --audit-level high`, failing the build only on high/critical advisories.

### Changed

- Upgraded `vitest` and `@vitest/coverage-v8` to v5, resolving the transitive `tinypool` critical advisories (GHSA-85c8-ppgw-ccpr, GHSA-5gmw-xhrv-c9v3); vitest 5 no longer depends on the affected `tinypool`.
- CI dev-tooling checks (lint, typecheck, test, build) now run on Node 22 and 24, since vitest 5 requires Node >= 22.12. The published package continues to support Node 20 (`engines.node` stays `>=20`), verified by a dedicated job that imports the built ESM and CJS artifacts on Node 20.

## [0.1.0] - 2026-10-07

### Added

- Project foundation: TypeScript 6 toolchain, tsup dual ESM/CJS build, vitest, ESLint 10 flat config, and Prettier.
- Minimal `WhatsAppClient` skeleton pinned to Graph API `v23.0`.
- HTTP core built on native `fetch`/`AbortController` with per-attempt timeout, retries on 429/5xx/network errors using jittered exponential backoff (honoring `Retry-After`), and a typed error hierarchy (`WhatsAppApiError`, `WhatsAppAuthenticationError`, `WhatsAppRequestError`, `WhatsAppValidationError`).
- Typed outbound Messages API via `client.messages`: `sendText`, `sendImage`, `sendVideo`, `sendAudio`, `sendDocument`, `sendSticker`, `sendLocation`, `sendContacts`, `sendTemplate`, `sendInteractiveButtons`, `sendInteractiveList`, `sendReaction`, and `markAsRead`.
- Reply/context support: every sender accepts a trailing `SendOptions` with `replyToMessageId`, injecting a root-level `context: { message_id }` into the request body.
- Five new interactive senders: `sendInteractiveCtaUrl`, `sendInteractiveFlow`, `sendLocationRequest`, `sendProduct`, and `sendProductList`.
- Rich interactive headers for buttons and lists: a plain string, a structured text header, or an image/video/document media header (`InteractiveHeader`, `InteractiveMediaHeader`).
- Full contacts object: `ContactName` middle name/suffix/prefix plus `ContactAddress`, `ContactOrg`, `ContactUrl`, and `Contact` `addresses`/`org`/`urls`/`birthday`.
- Client-side validation of documented Messages API limits (text/interactive body, footer, header, button counts and ids, list sections/rows, reaction emoji, flow CTA, product-list items), raising `WhatsAppValidationError` with a field + limit message; nothing is truncated.
- Typed errors `WhatsAppRateLimitError` (exposing `retryAfterMs` when a `Retry-After` header is present) and `WhatsAppReEngagementError`, both subclasses of `WhatsAppApiError`; `errorFromResponse` maps `429`/`130429`/`131056`/`133016` to rate-limit and `131047` to re-engagement.
- Framework-agnostic webhooks module: GET verification handshake (`verifyWebhook`, `verifyWebhookQuery`) echoing the raw `hub.challenge` with a constant-time token check; constant-time `X-Hub-Signature-256` validation over the raw request body (`verifySignature`); typed inbound parsing (`parseWebhook`, `extractMessages`, `extractStatuses`, `isMessageEvent`/`isStatusEvent`) with a discriminated `IncomingMessage` union (text, image, video, audio, document, sticker, location, contacts, interactive, button, reaction, plus an unknown fallback) and `MessageStatus`; a `WebhookHandler` that binds the verify token and App Secret; and a new `WhatsAppWebhookError`.
- CI (Node 20 and 22) and release-on-tag workflows.
- OSS docs: README, LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, CODEOWNERS.

### Changed

- Interactive button and list headers now accept the structured `InteractiveHeader` type in addition to a plain string (backward compatible).
- Removed stale "omitted" notes from the contact types now that the full contacts object is modeled.

[Unreleased]: https://github.com/SolveJet/whatsapp-cloud-api/compare/v0.3.1...HEAD
[0.3.1]: https://github.com/SolveJet/whatsapp-cloud-api/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/SolveJet/whatsapp-cloud-api/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/solvejet/whatsapp-cloud-api/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/solvejet/whatsapp-cloud-api/releases/tag/v0.1.0
