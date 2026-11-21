// Maps the maintained markdown sources to routes on the documentation site.
// Keys for README sections are the heading text; `level` is 2 unless noted.

export const repo = 'SolveJet/whatsapp-cloud-api';
export const branch = 'master';
export const base = '/whatsapp-cloud-api';

/**
 * README sections. A page may merge several consecutive headings (`headings`).
 * Level-3 headings listed here are cut out of their parent section into their own page.
 */
export const readmePages = [
  {
    route: 'getting-started/overview',
    title: 'Overview',
    description:
      'Why use this zero-dependency TypeScript SDK for the WhatsApp Cloud API, and how it compares with other Node.js libraries.',
    headings: [
      { text: 'Why this library' },
      { text: 'How it compares' },
      { text: 'When to use this package' },
    ],
  },
  {
    route: 'getting-started/ai-assistants',
    title: 'Using with AI coding assistants',
    description:
      'Context7 library ID, DeepWiki and llms.txt links for coding assistants that use the WhatsApp Cloud API SDK.',
    headings: [{ text: 'Using with AI coding assistants' }],
  },
  {
    route: 'getting-started/install',
    title: 'Install',
    description:
      'Install @solvejet/whatsapp-cloud-api with npm, pnpm or yarn, and see the supported Node.js and runtime versions.',
    headings: [{ text: 'Install' }, { text: 'Runtime support' }],
  },
  {
    route: 'getting-started/configuration',
    title: 'Configuration',
    description:
      'Configure the WhatsAppClient: access token, phone number ID, API version, timeouts, retries and custom fetch.',
    headings: [{ text: 'Configuration' }],
  },
  {
    route: 'guides/messaging',
    title: 'Messaging',
    description:
      'Send text, reply, interactive, address and other WhatsApp messages from Node.js with client.messages.',
    headings: [{ text: 'Messaging' }],
  },
  {
    route: 'guides/usernames-and-bsuids',
    title: 'Usernames and BSUIDs',
    description:
      'Address recipients by business-scoped user ID (BSUID) and read usernames from webhook payloads.',
    headings: [{ text: 'Usernames and BSUIDs' }],
  },
  {
    route: 'guides/raw-sends',
    title: 'Raw sends',
    description:
      'Send any message payload the Cloud API accepts with client.messages.sendRaw, including types the SDK does not model yet.',
    headings: [{ text: 'Raw sends' }],
  },
  {
    route: 'guides/media',
    title: 'Media',
    description:
      'Upload, download, look up and delete WhatsApp media with client.media from Node.js.',
    headings: [{ text: 'Media' }],
  },
  {
    route: 'guides/phone-numbers-and-waba',
    title: 'Phone numbers and WABA',
    description:
      'Manage phone numbers and WhatsApp Business Account settings: profile, registration and verification.',
    headings: [{ text: 'Phone number & WABA management' }],
  },
  {
    route: 'webhooks/overview',
    title: 'Webhooks',
    description:
      'Receive WhatsApp webhooks in Node.js: answer the verification handshake and verify X-Hub-Signature-256 with WebhookHandler.',
    headings: [{ text: 'Webhooks' }],
  },
  {
    route: 'webhooks/raw-body',
    title: 'Webhooks: raw body',
    description:
      'Why WhatsApp webhook signatures need the raw request body, and how to read it in Express, Next.js, Hono and Fastify.',
    headings: [{ text: 'Webhooks: raw body', level: 3 }],
  },
  {
    route: 'webhooks/handling-events',
    title: 'Handling events',
    description:
      'Flatten WhatsApp webhook payloads into messages and statuses with extractMessages and extractStatuses.',
    headings: [{ text: 'Handling events', level: 3 }],
  },
  {
    route: 'faq',
    title: 'FAQ',
    description:
      'Answers about sending template messages, dependencies, Node.js versions, Meta accounts, rate limits and errors.',
    headings: [{ text: 'FAQ' }],
  },
];

/** docs/*.md files. */
export const docPages = [
  {
    source: 'docs/templates.md',
    route: 'guides/templates',
    description:
      'Create, list, read, edit and delete WhatsApp message templates with client.templates.',
  },
  {
    source: 'docs/errors.md',
    route: 'guides/errors',
    description:
      'The error class hierarchy, retries and how to branch on Graph API error codes in the WhatsApp Cloud API SDK.',
  },
  {
    source: 'docs/flows.md',
    route: 'guides/flows',
    description: 'Build, publish and manage WhatsApp Flows with client.flows.',
  },
  {
    source: 'docs/calling.md',
    route: 'guides/calling',
    description: 'WhatsApp Business Calling API: calling settings and the call lifecycle.',
  },
  {
    source: 'docs/blocks.md',
    route: 'guides/block-api',
    description: 'Block, unblock and list blocked WhatsApp users with the Block API.',
  },
  {
    source: 'docs/migrating-from-whatsapp-cloud-api.md',
    route: 'migration/from-whatsapp-cloud-api',
    description:
      'Move from the whatsapp-cloud-api npm package to @solvejet/whatsapp-cloud-api, with an API mapping.',
  },
  {
    source: 'docs/migrating-from-meta-whatsapp-sdk.md',
    route: 'migration/from-meta-whatsapp-sdk',
    description:
      "Move from Meta's whatsapp npm package to @solvejet/whatsapp-cloud-api, with an API mapping.",
  },
];

export const changelogPage = {
  source: 'CHANGELOG.md',
  route: 'reference/changelog',
  title: 'Changelog',
  description: 'Release notes for @solvejet/whatsapp-cloud-api.',
};
