---
title: 'Choosing a WhatsApp Cloud API library for Node.js'
description: 'Compare npm packages for the WhatsApp Cloud API in TypeScript and Node.js: maintenance status, dependencies, TypeScript support, webhook helpers and runtimes, checked on 2026-11-21.'
sidebar:
  order: 2
---

This page compares the npm packages most often used to call Meta's WhatsApp Cloud API from Node.js. Every figure below was read from the npm registry, the npm downloads API and the GitHub API on **2026-11-21**. Packages change, so check the linked pages before you decide. This project is one of the packages compared, so treat the "pick it if" column as a starting point and verify the claims yourself.

Last verified against Graph API v26.0 on 2026-11-21.

## At a glance

| Package                                                                                      | Latest release (date)      | GitHub repository | Runtime dependencies                    | Downloads, last 30 days | Node.js requirement      |
| -------------------------------------------------------------------------------------------- | -------------------------- | ----------------- | --------------------------------------- | ----------------------- | ------------------------ |
| [`@solvejet/whatsapp-cloud-api`](https://www.npmjs.com/package/@solvejet/whatsapp-cloud-api) | `1.4.0` (2026-11-21)       | Not archived      | None                                    | 134                     | `>=20`                   |
| [`whatsapp-api-js`](https://www.npmjs.com/package/whatsapp-api-js)                           | `6.3.0` (2026-09-21)       | Not archived      | None                                    | 27,829                  | `>=22.13.0` (warns only) |
| [`meta-cloud-api`](https://www.npmjs.com/package/meta-cloud-api)                             | `3.13.0` (2026-11-12)      | Not archived      | None                                    | 8,352                   | `>=20.12.0`              |
| [`@kapso/whatsapp-cloud-api`](https://www.npmjs.com/package/@kapso/whatsapp-cloud-api)       | `0.4.0` (2026-10-23)       | Not archived      | `zod`                                   | 391,042                 | `>=20.19`                |
| [`@great-detail/whatsapp`](https://www.npmjs.com/package/@great-detail/whatsapp)             | `9.2.0` (2026-09-22)       | Not archived      | `ky`, `openapi-fetch`                   | 17,695                  | `>=22`                   |
| [`whatsapp`](https://www.npmjs.com/package/whatsapp) (Meta's Node.js SDK)                    | `0.0.5-Alpha` (2023-04-11) | Archived          | `@types/node`                           | 14,671                  | `>=16.19.1`              |
| [`whatsapp-cloud-api`](https://www.npmjs.com/package/whatsapp-cloud-api) (unscoped)          | `0.3.1` (2023-04-11)       | Archived          | `axios`, `dotenv`, `express` and others | 27,949                  | `>=12`                   |

All packages in the table publish TypeScript declarations. Download counts include installs from CI and mirrors, so they say little about how many people use a package. The `@kapso` figure may include traffic from the vendor's own platform; that was not checked.

The GitHub repositories for [Meta's `whatsapp` SDK](https://github.com/WhatsApp/WhatsApp-Nodejs-SDK) and [`tawn33y/whatsapp-cloud-api`](https://github.com/tawn33y/whatsapp-cloud-api) are archived, so they are read-only and get no fixes. If you use one of them, see [Migrating from `whatsapp-cloud-api`](/whatsapp-cloud-api/migration/from-whatsapp-cloud-api/) or [Migrating from Meta's `whatsapp` package](/whatsapp-cloud-api/migration/from-meta-whatsapp-sdk/).

## Webhooks and runtimes

Webhook support differs more between these packages than the send APIs do. This summary is based on each package's published README on the date above, not on running the code.

| Package                         | Webhook support described in its README                                                                           | Runtimes named in its README                               |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `@solvejet/whatsapp-cloud-api`  | GET handshake, `X-Hub-Signature-256` check over the raw body, typed events, dedupe, secret rotation, test helpers | Node.js 20+, Bun, Deno, Cloudflare Workers (all run in CI) |
| `whatsapp-api-js`               | GET verification handler and `x-hub-signature-256` checking                                                       | See its README                                             |
| `meta-cloud-api`                | Built-in adapters for Express, Next.js, Hono and Fastify, with optional signature verification                    | Node.js, Bun, Deno, Cloudflare Workers, Vercel Edge        |
| `@kapso/whatsapp-cloud-api`     | `verifySignature` and `normalizeWebhook` utilities                                                                | See its README                                             |
| `@great-detail/whatsapp`        | Webhook support listed                                                                                            | Node.js, Deno, Bun (tested on Deno and Bun LTS versions)   |
| `whatsapp` (Meta, archived)     | Verification token and a listener endpoint configured through environment variables                               | Node.js                                                    |
| `whatsapp-cloud-api` (archived) | Built-in Express server that handles the verify token                                                             | Node.js                                                    |

## When to pick which

- **`@solvejet/whatsapp-cloud-api`**: you want no runtime dependencies, strict TypeScript types, one webhook handler that also runs on Cloudflare Workers, Bun and Deno, and test helpers for webhook endpoints. It has little adoption so far (see the download count above), a smaller community than the older packages, and no framework adapters beyond the web-standard `Request` and `Response` pair and raw-body input.
- **`whatsapp-api-js`**: you want a library with a longer track record and a larger user base, and you run Node.js 22.13 or newer.
- **`meta-cloud-api`**: you want ready-made Express, Next.js, Hono or Fastify webhook adapters and a dedicated documentation site.
- **`@kapso/whatsapp-cloud-api`**: you already use, or plan to use, the Kapso platform, or you want its hosted features alongside the SDK.
- **`@great-detail/whatsapp`**: you prefer a client built on `openapi-fetch` and `ky`.
- **Meta's `whatsapp` and the unscoped `whatsapp-cloud-api`**: not for new projects, because their repositories are archived and their last releases are from 2023.

## When not to use this package

- You need a hosted inbox, a no-code flow builder or a managed platform. This is a client library only.
- You want built-in Express, Next.js, Hono or Fastify webhook adapters instead of passing the raw body yourself. [`meta-cloud-api`](https://www.npmjs.com/package/meta-cloud-api) ships them.
- You want a request client generated from an OpenAPI description.
- You need Node.js 18 or older. This package requires Node.js 20 or newer.
- You want to drive a regular WhatsApp account rather than use the business API. Baileys and whatsapp-web.js do that through the WhatsApp Web protocol or browser automation, and WhatsApp's [terms of service](https://www.whatsapp.com/legal/terms-of-service) restrict automated access, so read them first.

## How to check this yourself

```sh
npm view <package> version time.modified dependencies engines
curl -s https://api.npmjs.org/downloads/point/last-month/<package>
curl -s https://api.github.com/repos/<owner>/<repo>
```

The GitHub response has an `archived` field. If any cell above is out of date, [open an issue](https://github.com/SolveJet/whatsapp-cloud-api/issues) and we will correct it.
