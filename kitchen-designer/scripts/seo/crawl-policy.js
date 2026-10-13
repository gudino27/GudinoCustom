// robots.txt and sitemap.xml for gudinocustom.com.
//
// This file exists twice, byte for byte:
//   kitchen-designer/scripts/seo/crawl-policy.js  (build: writes build/robots.txt, build/sitemap.xml)
//   cabinet-photo-server/utils/crawl-policy.js    (backend: serves /robots.txt and /sitemap.xml,
//                                                  which nginx-tunnel.conf routes to it)
// The two Docker images are built from separate folders, so they cannot share
// one copy. Edit one, copy it over the other; kitchen-designer/scripts/check-prerender.js
// fails while they differ, and also checks PUBLIC_PATHS against src/seo/site.js.
// No dependencies: it must load in both packages.

const SITE_URL = 'https://gudinocustom.com';

// Every public page; each one also exists in Spanish under /es
const PUBLIC_PATHS = [
  '/',
  '/portfolio',
  '/design',
  '/about',
  '/contact',
  '/faq',
  '/cabinet-care',
  '/why-choose-us',
  '/hardware-catalog',
  '/book-appointment',
  '/quick-quote',
  '/privacy',
  '/sms-consent-verification',
  '/sms-terms',
  '/sms-privacy'
];

// Named so the policy is explicit; all get the same rules as "*".
// Search / answer crawlers first, then AI training crawlers (see the SEO report).
const CRAWLERS = [
  'Googlebot',
  'Bingbot',
  'Applebot',
  'DuckDuckBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Amazonbot',
  'GPTBot',
  'ClaudeBot',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Meta-ExternalAgent'
];

// Public read-only API calls the pages make while rendering (portfolio photos,
// team, testimonials, Instagram, showroom, designer prices, booking slots).
// Search engines that render JavaScript need them to see the full page.
const ALLOWED_API = [
  '/api/photos',
  '/api/testimonials',
  '/api/employees',
  '/api/instagram/',
  '/api/showroom/public/',
  '/api/prices',
  '/api/appointments/available-'
];

// Private areas and one-time links: never crawled (the pages are also noindex)
const DISALLOWED = [
  '/api/',
  '/admin',
  '/reset-password',
  '/register/',
  '/invoice/',
  '/testimonial/',
  '/project/',
  '/appointment/cancel/',
  '/no-access'
];

function buildRobotsTxt() {
  return [
    '# robots.txt for gudinocustom.com (api.gudinocustom.com serves the same file)',
    '#',
    '# Search engines and AI assistants are welcome on every public page, in',
    '# English and in Spanish (/es/...). Private areas and one-time links are',
    '# closed. AI training crawlers are allowed too; to opt one out later,',
    '# take it off the list below and give it its own group:',
    '#   User-agent: GPTBot',
    '#   Disallow: /',
    '# A short summary for AI assistants: https://gudinocustom.com/llms.txt',
    '',
    ...CRAWLERS.map((name) => `User-agent: ${name}`),
    'User-agent: *',
    'Content-Signal: search=yes, ai-input=yes',
    ...ALLOWED_API.map((p) => `Allow: ${p}`),
    ...DISALLOWED.map((p) => `Disallow: ${p}`),
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    ''
  ].join('\n');
}

const localize = (path, lang) => (lang === 'es' ? (path === '/' ? '/es' : `/es${path}`) : path);
const escapeXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// lastmod: optional { '/portfolio': '2026-01-31T...' } (an honest date: when
// that page's content last changed). Pages without one get no <lastmod>.
function buildSitemapXml(lastmod = {}) {
  const urls = [];
  for (const path of PUBLIC_PATHS) {
    const alternates = [
      ['en', `${SITE_URL}${localize(path, 'en')}`],
      ['es', `${SITE_URL}${localize(path, 'es')}`],
      ['x-default', `${SITE_URL}${localize(path, 'en')}`]
    ];
    for (const lang of ['en', 'es']) {
      const lines = [
        '  <url>',
        `    <loc>${escapeXml(`${SITE_URL}${localize(path, lang)}`)}</loc>`
      ];
      if (lastmod[path]) lines.push(`    <lastmod>${escapeXml(lastmod[path])}</lastmod>`);
      alternates.forEach(([hreflang, href]) => {
        lines.push(`    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${escapeXml(href)}"/>`);
      });
      lines.push('  </url>');
      urls.push(lines.join('\n'));
    }
  }
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
    ''
  ].join('\n');
}

module.exports = { SITE_URL, PUBLIC_PATHS, CRAWLERS, ALLOWED_API, DISALLOWED, buildRobotsTxt, buildSitemapXml };
