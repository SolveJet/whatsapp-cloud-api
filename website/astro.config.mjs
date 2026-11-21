import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLinksValidator from 'starlight-links-validator';
import starlightTypeDoc from 'starlight-typedoc';

const site = 'https://solvejet.github.io';
const base = '/whatsapp-cloud-api';
const ogImage = `${site}${base}/og.png`;

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  integrations: [
    starlight({
      title: 'WhatsApp Cloud API SDK',
      description:
        'Zero-dependency, fetch-based TypeScript SDK for the WhatsApp Cloud API: messages, templates, media and webhooks.',
      lastUpdated: true,
      favicon: '/favicon.svg',
      editLink: {
        baseUrl: 'https://github.com/SolveJet/whatsapp-cloud-api/edit/master/website/',
      },
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/SolveJet/whatsapp-cloud-api',
        },
      ],
      head: [
        { tag: 'meta', attrs: { property: 'og:image', content: ogImage } },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
        { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
        { tag: 'meta', attrs: { name: 'twitter:image', content: ogImage } },
      ],
      components: {
        Footer: './src/components/Footer.astro',
      },
      customCss: ['./src/styles/custom.css'],
      plugins: [
        starlightLinksValidator({ errorOnRelativeLinks: false }),
        starlightTypeDoc({
          entryPoints: ['../src/index.ts'],
          tsconfig: '../tsconfig.json',
          output: 'api',
          sidebar: { label: 'API reference', collapsed: true },
        }),
      ],
      sidebar: [
        {
          label: 'Getting started',
          items: [
            'getting-started/overview',
            'getting-started/install',
            'getting-started/send-first-message',
            'getting-started/configuration',
          ],
        },
        {
          label: 'Guides',
          items: [
            'guides/messaging',
            'guides/interactive-buttons-and-lists',
            'guides/templates',
            'guides/send-template-message',
            'guides/media',
            'guides/upload-download-media',
            'guides/usernames-and-bsuids',
            'guides/raw-sends',
            'guides/errors',
            'guides/rate-limits-and-24-hour-window',
            'guides/flows',
            'guides/calling',
            'guides/block-api',
            'guides/phone-numbers-and-waba',
          ],
        },
        {
          label: 'Webhooks',
          items: [
            'webhooks/overview',
            'webhooks/verify-signature',
            'webhooks/verification-request',
            'webhooks/raw-body',
            'webhooks/handling-events',
            'webhooks/express',
            'webhooks/nextjs',
            'webhooks/hono',
            'webhooks/fastify',
          ],
        },
        {
          label: 'Migration',
          items: ['migration/from-whatsapp-cloud-api', 'migration/from-meta-whatsapp-sdk'],
        },
        // The API reference group is added by starlight-typedoc.
        'faq',
        'reference/changelog',
      ],
    }),
  ],
});
