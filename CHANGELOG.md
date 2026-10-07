# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- CI (Node 20 and 22) and release-on-tag workflows.
- OSS docs: README, LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, CODEOWNERS.

### Changed

- Interactive button and list headers now accept the structured `InteractiveHeader` type in addition to a plain string (backward compatible).
- Removed stale "omitted" notes from the contact types now that the full contacts object is modeled.

[Unreleased]: https://github.com/solvejet/whatsapp-cloud-api/commits/master
