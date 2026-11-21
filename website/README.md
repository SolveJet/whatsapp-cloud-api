# Documentation site

Source for https://solvejet.github.io/whatsapp-cloud-api/, built with [Astro Starlight](https://starlight.astro.build). This package is private and is not published to npm.

## How it is built

The site has no separate copy of the guides. `scripts/sync-content.mjs` runs before `dev` and `build` and writes the pages into `src/content/docs/`, which is generated and gitignored:

- `docs/*.md` are copied with frontmatter added (title, description, edit link, last-updated date).
- `README.md` is split by section into pages, mapped in `scripts/content-map.mjs`.
- `CHANGELOG.md` becomes the changelog page.
- Hand-written pages in `src/content-src/` are copied into the same tree.
- Relative links in the sources keep working on GitHub. The script rewrites them for the site and exits non-zero on an unresolved file or anchor.

The API reference is generated from `../src/index.ts` by `starlight-typedoc` during the build. `starlight-links-validator` fails the build on dead internal links.

Edit `README.md`, `docs/*.md` or `src/content-src/`. Do not edit `src/content/docs/`.

### Code snippets

Code on hand-written pages is embedded from real files with `{{include path[#region]}}`. Site-specific snippets live in `snippets/` and are typechecked against the SDK source:

```sh
pnpm exec tsc -p website/tsconfig.snippets.json   # from the repository root
```

## Commands

Run from the repository root. Node.js 22.23.4 or newer is required.

```sh
pnpm install --frozen-lockfile
pnpm --dir website install --frozen-lockfile
pnpm --dir website run dev
pnpm --dir website run build
pnpm --dir website exec astro preview --port 4321
```

## Deployment

`.github/workflows/docs.yml` builds the site and deploys `website/dist` to GitHub Pages on pushes to `master` that touch the site or its sources. Pages must be set to "GitHub Actions" as the source in the repository settings. The `Docs site` job in `ci.yml` builds the site on every pull request.

## Using a custom domain

No custom domain is configured. To add one:

1. Create `public/CNAME` containing the domain, for example `docs.example.com`.
2. In `astro.config.mjs`, set `site` to `https://docs.example.com` and `base` to `'/'`. Update the absolute URLs in `public/robots.txt` and `package.json` `homepage`.
3. Enter the domain under Settings, Pages, Custom domain.
4. Add a DNS `CNAME` record for the domain pointing to `solvejet.github.io`.
