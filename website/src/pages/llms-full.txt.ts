import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ site }) => {
  const origin = site ?? new URL('https://solvejet.github.io');
  // The generated API reference is large; llms.txt links to it instead.
  const docs = (await getCollection('docs'))
    .filter((doc) => !doc.id.startsWith('api/') && doc.id !== 'index')
    .sort((a, b) => a.id.localeCompare(b.id));
  const parts = docs.map((doc) => {
    const url = new URL(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/${doc.id}/`, origin).href;
    return `# ${doc.data.title}\n\nSource: ${url}\n\n${doc.body ?? ''}`.trim();
  });
  return new Response(`${parts.join('\n\n---\n\n')}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
