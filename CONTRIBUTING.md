# Contributing

Thanks for your interest in contributing to `@solvejet/whatsapp-cloud-api`. This guide covers the development setup and the conventions we follow.

## Prerequisites

- **Node.js 20 or newer** (see [`.nvmrc`](./.nvmrc); run `nvm use` if you use nvm).
- **pnpm** is the required package manager for this project. The repository pins a pnpm version via the `packageManager` field, so the easiest way is to enable [Corepack](https://nodejs.org/api/corepack.html):

  ```sh
  corepack enable
  ```

  Please do not use npm or yarn — the lockfile and scripts assume pnpm.

## Setup

```sh
git clone https://github.com/solvejet/whatsapp-cloud-api.git
cd whatsapp-cloud-api
pnpm install
```

## Development workflow

Common scripts:

| Script                   | Description                            |
| ------------------------ | -------------------------------------- |
| `pnpm run build`         | Build dual ESM + CJS output with types |
| `pnpm run dev`           | Rebuild on change (tsup watch)         |
| `pnpm run test`          | Run the test suite once                |
| `pnpm run test:watch`    | Run tests in watch mode                |
| `pnpm run test:coverage` | Run tests with v8 coverage             |
| `pnpm run typecheck`     | Type-check with `tsc --noEmit`         |
| `pnpm run lint`          | Lint with ESLint                       |
| `pnpm run lint:fix`      | Lint and auto-fix                      |
| `pnpm run format`        | Format with Prettier                   |
| `pnpm run format:check`  | Check formatting without writing       |

Before opening a pull request, make sure the full check set passes locally:

```sh
pnpm run lint
pnpm run format:check
pnpm run typecheck
pnpm run test
pnpm run build
```

## Commit & PR conventions

- Follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages (e.g. `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`).
- Keep pull requests focused and fill out the PR template.
- **All CI checks must pass** before a PR can be merged. CI runs the same lint, format, typecheck, test, and build steps on Node 22 and 24, plus a Node 20 smoke test that imports the built ESM and CJS artifacts (the published package supports Node 20+).

## Releasing

Publishing to npm is automated via GitHub Actions and **npm OIDC Trusted Publishing** — there is no `NPM_TOKEN` secret. A short-lived token is minted from the workflow's OIDC identity at publish time.

To cut a release:

1. Bump `version` in `package.json` and update the `CHANGELOG.md`.
2. Merge to `master`, then create a GitHub Release whose tag is `v<version>` (e.g. `v0.3.0`). The `release.yml` workflow verifies the tag matches `package.json`, builds, and publishes.
3. You can also trigger `release.yml` manually from the Actions tab (`workflow_dispatch`) to retry a failed publish without re-tagging.

The npm trusted-publisher configuration (npmjs.com → package → Settings → Trusted Publisher) must match the GitHub OIDC claims **exactly, and all fields are case-sensitive**:

| Field                | Value                |
| -------------------- | -------------------- |
| Organization or user | `SolveJet`           |
| Repository           | `whatsapp-cloud-api` |
| Workflow filename    | `release.yml`        |
| Environment name     | (empty)              |

A casing mismatch (e.g. `solvejet`) makes npm's token exchange return `404 package not found`, which the npm CLI then surfaces as a misleading `ENEEDAUTH`. See the header comment in [`.github/workflows/release.yml`](./.github/workflows/release.yml) for the full rationale.

## Code of Conduct

By participating, you agree to abide by our [Code of Conduct](./CODE_OF_CONDUCT.md).
