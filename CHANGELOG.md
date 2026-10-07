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
- CI (Node 20 and 22) and release-on-tag workflows.
- OSS docs: README, LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, CODEOWNERS.

[Unreleased]: https://github.com/solvejet/whatsapp-cloud-api/commits/master
