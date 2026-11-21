import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

const pageUrl = (id: string, site: URL): string => {
  const route = id === 'index' ? '' : `${id}/`;
  return new URL(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/${route}`, site).href;
};

export const GET: APIRoute = async ({ site }) => {
  const origin = site ?? new URL('https://solvejet.github.io');
  const rank = (id: string): number => (id.startsWith('api/') ? 1 : 0);
  const docs = (await getCollection('docs')).sort(
    (a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id),
  );
  const lines = [
    '# @solvejet/whatsapp-cloud-api',
    '',
    '> Zero-dependency, fetch-based TypeScript SDK for the WhatsApp Cloud API. Independent open-source project, not affiliated with Meta or WhatsApp.',
    '',
    `Full text of the guides: ${new URL(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/llms-full.txt`, origin).href}`,
    '',
    '## Documentation',
    '',
  ];
  for (const doc of docs) {
    const description = doc.data.description ? `: ${doc.data.description}` : '';
    lines.push(`- [${doc.data.title}](${pageUrl(doc.id, origin)})${description}`);
  }
  return new Response(`${lines.join('\n')}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
