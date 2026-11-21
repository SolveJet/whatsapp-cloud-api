import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

// Adds BreadcrumbList structured data (home, then the current page) to every docs page.
export const onRequest = defineRouteMiddleware((context) => {
  const { id, entry, head } = context.locals.starlightRoute;
  if (id === '' || id === 'index') return;
  const home = new URL(import.meta.env.BASE_URL, context.site ?? context.url).href;
  const page = new URL(
    `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${id}/`,
    context.site ?? context.url,
  ).href;
  head.push({
    tag: 'script',
    attrs: { type: 'application/ld+json' },
    content: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Documentation', item: home },
        { '@type': 'ListItem', position: 2, name: entry.data.title, item: page },
      ],
    }),
  });
});
