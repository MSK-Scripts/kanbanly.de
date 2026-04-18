import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kanbanly.de';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/trello-alternative', '/impressum', '/datenschutz'],
        disallow: [
          '/dashboard',
          '/boards/',
          '/workspaces/',
          '/invite/',
          '/auth/',
          '/login',
          '/register',
          '/meine-karten',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
