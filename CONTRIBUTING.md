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

| Script                   | Description                               |
| ------------------------ | ----------------------------------------- |
| `pnpm run build`         | Build dual ESM + CJS output with types    |
| `pnpm run dev`           | Rebuild on change (tsup watch)            |
| `pnpm run test`          | Run the test suite once                   |
| `pnpm run test:watch`    | Run tests in watch mode                   |
| `pnpm run test:coverage` | Run tests with v8 coverage                |
| `pnpm run typecheck`     | Type-check with `tsc --noEmit`            |
| `pnpm run lint`          | Lint with ESLint                          |
| `pnpm run lint:fix`      | Lint and auto-fix                         |
| `pnpm run format`        | Format with Prettier                      |
| `pnpm run format:check`  | Check formatting without writing          |

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
- **All CI checks must pass** before a PR can be merged. CI runs the same lint, format, typecheck, test, and build steps on Node 20 and 22.

## Code of Conduct

By participating, you agree to abide by our [Code of Conduct](./CODE_OF_CONDUCT.md).
