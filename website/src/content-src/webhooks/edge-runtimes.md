---
title: 'WhatsApp Cloud API webhooks on Cloudflare Workers, Bun, Deno and Vercel'
description: 'Run the WhatsApp webhook handler on edge and serverless runtimes with the Web Crypto entry point, and keep background work alive with waitUntil.'
sidebar:
  order: 4
---

The `@solvejet/whatsapp-cloud-api/web` entry point has the same `createWebhookHandler`, parsers and dedupe as the main entry, but it imports nothing from `node:*` and verifies signatures with Web Crypto. Use it wherever `node:crypto` is not available or you want one code path for every runtime.

{{include website/snippets/edge-runtimes.ts#worker}}

You can also call the verifier directly:

{{include website/snippets/edge-runtimes.ts#verify}}

## What is tested

| Runtime            | Status                                                      |
| ------------------ | ----------------------------------------------------------- |
| Node.js 20, 22, 24 | Verified in CI                                              |
| Bun                | Verified in CI (the built web entry runs under Bun)         |
| Deno               | Verified in CI only (the built web entry runs under Deno)   |
| Cloudflare Workers | Verified in CI in workerd, without the `nodejs_compat` flag |
| Vercel, Next.js    | Documented, not run in CI                                   |

## Keeping background work alive

With `ackMode: 'before'` the handler answers first and runs your handlers afterwards. Serverless platforms may stop the invocation after the response unless you tell them to wait.

- **Cloudflare Workers:** pass `ctx.waitUntil` as in the example above.
- **Vercel:** pass `waitUntil` from `@vercel/functions` as the `waitUntil` option, or call `after()` from `next/server`.
- **Node.js, Bun and Deno servers that keep running:** nothing is needed. Without `waitUntil`, the background work runs as a detached promise and its failures go to `onError`.

If you do not need to answer early, leave `ackMode` at its default. The handlers then finish before the response is sent.
