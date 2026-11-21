# AGENTS.md

Guidance for coding agents and contributors working in this repository. If you are using the package in your own project, read [`AGENTS-CONSUMER.md`](./AGENTS-CONSUMER.md) instead. For humans, see [CONTRIBUTING.md](./CONTRIBUTING.md).

## Project

`@solvejet/whatsapp-cloud-api` is a TypeScript SDK for Meta's WhatsApp Cloud API. It has zero runtime dependencies, uses the platform `fetch`, and supports Node.js 20+. It also builds `/web` and `/testing` entry points that run on Bun, Deno and Cloudflare Workers.

## Layout

- `src/index.ts`: main entry, `WhatsAppClient`, error exports.
- `src/web.ts`, `src/testing.ts`: the `/web` (no `node:` imports) and `/testing` entry points.
- `src/resources/`: one file per API area (`messages`, `media`, `templates`, webhooks and so on). `src/types/`: request, response and webhook types.
- `tests/`: Vitest tests. `docs/`: guides rendered on the docs site. `website/`: Astro Starlight site with its own `package.json` and lockfile. `examples/`: runnable servers with their own lockfile.

## Commands

Use pnpm (version pinned in `packageManager`). Do not upgrade pnpm or TypeScript.

```sh
pnpm install --frozen-lockfile
pnpm run lint
pnpm run format:check
pnpm run typecheck
pnpm run test
pnpm run build
pnpm exec tsc -p examples/tsconfig.json           # needs: pnpm --dir examples install --frozen-lockfile
pnpm exec tsc -p website/tsconfig.snippets.json   # docs code snippets
pnpm --dir website install --frozen-lockfile && pnpm --dir website run build
```

Run `pnpm run format` to fix formatting. Use single-run commands, not watch mode.

## Rules

- No runtime dependencies. Do not add any to `dependencies`.
- Strict TypeScript. Public API changes need TSDoc, tests and a `CHANGELOG.md` entry under `[Unreleased]`. Do not make breaking changes in a minor or patch release.
- Keep `src/web.ts` and `src/testing.ts` free of `node:` imports. Webhook signatures are checked against the raw body, never re-serialized JSON.
- Edit `README.md`, `docs/*.md` or `website/src/content-src/`. Do not edit `website/src/content/docs/`; it is generated.
- Never commit secrets, tokens or `.env` files. Do not call the real Graph API in tests; mock `fetch`.
- `context7.json` rules are at most 255 characters each, 50 at most. Keep `url` and `public_key` unchanged.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`).
