# Code Review Style Guide


This repository is `@solvejet/whatsapp-cloud-api`, a TypeScript SDK for the
Meta-hosted WhatsApp Cloud API. Apply the following expectations when reviewing
pull requests.

## General

- TypeScript runs in `strict` mode. Flag any `any`, unchecked casts, or
  non-null assertions (`!`) that hide real type gaps. Prefer precise types.
- The package ships dual ESM + CJS. Code must not rely on CommonJS-only or
  ESM-only globals in a way that breaks either build output.
- Target Node.js 20+. Built-in `fetch`, `FormData`, `Blob`, and `AbortController`
  are available and preferred over adding runtime dependencies.
- Keep the package dependency-free at runtime unless a dependency is clearly
  justified. Flag new runtime `dependencies` for scrutiny; dev dependencies are
  fine.

## Correctness and API design

- Public API surface should be intentional. Flag newly exported symbols that
  look like internals leaking out.
- Validate inputs at public boundaries and throw typed, descriptive errors
  rather than failing silently or throwing bare strings.
- Network calls must handle non-2xx responses and surface the WhatsApp API
  error payload, not just the HTTP status.
- Pin and respect the Graph API version (`DEFAULT_API_VERSION`). Flag hardcoded
  version strings scattered through the code instead of using the constant.

## Security

- This SDK handles access tokens and verifies webhook signatures. Flag any code
  that logs tokens, secrets, or full request headers.
- Webhook signature verification must use a constant-time comparison. Flag naive
  `===` string comparison of signatures.
- Flag construction of requests via unsanitized string interpolation where a
  structured request body or URL builder is appropriate.

## Tests and docs

- New public behavior should come with vitest tests. Flag untested public
  functions.
- Exported functions and types should carry TSDoc comments. Flag missing or
  stale documentation on public API.

## Severity guidance

- Treat security issues (token leakage, non-constant-time signature checks) and
  correctness bugs as HIGH or CRITICAL.
- Treat missing tests/docs on public API and loose typing as MEDIUM.
- Do not raise purely stylistic nits already handled by Prettier and ESLint.
