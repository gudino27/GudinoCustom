#!/usr/bin/env node
// Post-build step (npm "postbuild"): gives every public page its own HTML file
// so search engines and AI crawlers that do not run JavaScript still read the
// page. For each route in PUBLIC_ROUTES (src/seo/site.js), in English and in
// Spanish, it writes build/<route>/index.html and build/es/<route>/index.html:
// the built build/index.html with that page's <title>, description, canonical,
// hreflang, Open Graph / Twitter tags and JSON-LD in <head>, and the page's
// text as plain HTML inside <div id="root">. The text comes from the same
// translation keys the React page uses (scripts/seo/pages.js).
//
// The app still boots normally: React's createRoot() replaces the markup inside
// #root when it mounts, Helmet takes over the head tags (they carry
// data-rh="true"), and the has-js rule in public/index.html keeps the copy
// hidden while the app loads, so visitors see the same loading screen as before.
//
// Also writes:
//   build/app-shell.html   the plain app with <meta name="robots" content="noindex">,
//                          nginx's fallback for admin, token links and unknown URLs
//   build/robots.txt, build/sitemap.xml   (scripts/seo/crawl-policy.js)
//   build/llms.txt, build/es/llms.txt, build/llms-full.txt
//
// Runs on Node 20 (the Docker build image) with no dependencies; see
// scripts/seo/load.js for how the ES module sources are loaded.
//
// Usage: node scripts/prerender.js [buildDir]
// Verify the output with: node scripts/check-prerender.js [buildDir]

const fs = require('fs');
const path = require('path');
const { PAGES, NAV, FOOTER_LINKS } = require('./seo/pages');
const crawlPolicy = require('./seo/crawl-policy');
const { ROOT, loadSources, makeTranslator } = require('./seo/load');

const BUILD = path.resolve(process.argv[2] || path.join(ROOT, 'build'));
const SHELL_MARKER = '<meta name="robots" content="noindex" data-app-shell="true">';

// ---------------------------------------------------------------------------
// HTML and Markdown rendering of the page blocks
// ---------------------------------------------------------------------------

const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const isExternal = (href) => /^(https?:|mailto:|tel:)/.test(href);

function inlineHtml(inline) {
  const parts = Array.isArray(inline) ? inline : [inline];
  return parts.map((part) => {
    if (typeof part === 'string') return escapeHtml(part);
    if (part.a) {
      const newTab = /^https?:/.test(part.a) ? ' rel="noopener noreferrer"' : '';
      return `<a href="${escapeHtml(part.a)}"${newTab}>${escapeHtml(part.text)}</a>`;
    }
    if (part.strong) return `<strong>${escapeHtml(part.strong)}</strong>`;
    if (part.em) return `<em>${escapeHtml(part.em)}</em>`;
    throw new Error(`Unknown inline part: ${JSON.stringify(part)}`);
  }).join('');
}

function blocksToHtml(blocks) {
  return blocks.map(([type, content]) => {
    if (/^h[1-6]$/.test(type)) return `<${type}>${escapeHtml(content)}</${type}>`;
    if (type === 'p') return `<p>${inlineHtml(content)}</p>`;
    if (type === 'ul') return `<ul>${content.map((li) => `<li>${inlineHtml(li)}</li>`).join('')}</ul>`;
    throw new Error(`Unknown block type: ${type}`);
  }).join('\n');
}

function inlineMarkdown(inline, siteUrl) {
  const parts = Array.isArray(inline) ? inline : [inline];
  return parts.map((part) => {
    if (typeof part === 'string') return part;
    if (part.a) {
      const href = isExternal(part.a) ? part.a : `${siteUrl}${part.a}`;
      return `[${part.text}](${href.replace(/ /g, '%20')})`;
    }
    if (part.strong) return `**${part.strong}**`;
    if (part.em) return `*${part.em}*`;
    throw new Error(`Unknown inline part: ${JSON.stringify(part)}`);
  }).join('');
}

function blocksToMarkdown(blocks, siteUrl, headingShift = 0) {
  return blocks.map(([type, content]) => {
    if (/^h[1-6]$/.test(type)) {
      const level = Math.min(Number(type[1]) + headingShift, 6);
      return `${'#'.repeat(level)} ${content}`;
    }
    if (type === 'p') return inlineMarkdown(content, siteUrl);
    if (type === 'ul') return content.map((li) => `- ${inlineMarkdown(li, siteUrl)}`).join('\n');
    throw new Error(`Unknown block type: ${type}`);
  }).join('\n\n');
}

// ---------------------------------------------------------------------------
// Page assembly
// ---------------------------------------------------------------------------

function headTags({ site, route, lang, t }) {
  const title = site.formatTitle(t(route.title));
  const description = t(route.description);
  const canonical = site.canonicalUrl(route, lang);
  const ogImage = `${site.SITE_URL}/O.png`;
  const otherLocale = lang === 'es' ? site.OG_LOCALE.en : site.OG_LOCALE.es;
  const rh = ' data-rh="true"';
  const meta = (attr, key, content) => `<meta ${attr}="${key}" content="${escapeHtml(content)}"${rh}>`;
  return {
    title,
    tags: [
      meta('name', 'description', description),
      `<link rel="canonical" href="${escapeHtml(canonical)}"${rh}>`,
      ...site.alternateLinks(route).map((alt) =>
        `<link rel="alternate" hreflang="${alt.hreflang}" href="${escapeHtml(alt.href)}"${rh}>`),
      meta('property', 'og:type', 'website'),
      meta('property', 'og:site_name', site.SITE_NAME),
      meta('property', 'og:title', title),
      meta('property', 'og:description', description),
      meta('property', 'og:url', canonical),
      meta('property', 'og:image', ogImage),
      meta('property', 'og:locale', site.OG_LOCALE[lang]),
      meta('property', 'og:locale:alternate', otherLocale),
      meta('name', 'twitter:card', 'summary_large_image'),
      meta('name', 'twitter:title', title),
      meta('name', 'twitter:description', description),
      meta('name', 'twitter:image', ogImage),
      `<script type="application/ld+json"${rh}>${site.serializeJsonLd(site.buildStructuredData({ route, lang, t }))}</script>`
    ]
  };
}

function chrome({ route, lang, t, lp, site, mainHtml }) {
  const other = lang === 'es' ? 'en' : 'es';
  const otherName = other === 'es' ? 'Español' : 'English';
  const current = (p) => (p === route.path ? ' aria-current="page"' : '');
  const navItems = NAV.map(([p, key]) => `<li><a href="${lp(p)}"${current(p)}>${escapeHtml(t(key))}</a></li>`);
  navItems.push(`<li><a href="${site.localizePath(route.path, other)}" hreflang="${other}" lang="${other}">${otherName}</a></li>`);
  const footerLinks = FOOTER_LINKS.map(([p, key]) => `<li><a href="${lp(p)}">${escapeHtml(t(key))}</a></li>`);
  return [
    '<div data-prerendered>',
    `<a class="skip-link" href="#main-content">${escapeHtml(t('a11y.skipToContent'))}</a>`,
    `<header><nav aria-label="${escapeHtml(t('nav.primary'))}">`,
    `<a href="${lp('/')}"${current('/')}><img src="/O.png" alt="${escapeHtml(t('nav.home'))}" width="250" height="60"></a>`,
    `<ul>${navItems.join('')}</ul>`,
    '</nav></header>',
    `<main id="main-content">\n${mainHtml}\n</main>`,
    '<footer>',
    `<p>${escapeHtml(t('footer.smsMessage'))}</p>`,
    `<p>${escapeHtml(t('footer.optOut'))}</p>`,
    `<ul>${footerLinks.join('')}</ul>`,
    `<p>${escapeHtml(t('footer.copyright', { year: new Date().getFullYear() }))}</p>`,
    '</footer>',
    '</div>'
  ].join('\n');
}

function fillTemplate(template, { lang, title, tags, body }) {
  let html = template;
  const replaceOnce = (re, fn, what) => {
    if (!re.test(html)) throw new Error(`build/index.html: could not find ${what}`);
    html = html.replace(re, fn);
  };
  replaceOnce(/<html([^>]*?)\slang="[^"]*"/, (m, attrs) => `<html${attrs} lang="${lang}"`, '<html lang>');
  if (title !== undefined) {
    replaceOnce(/<title>[^<]*<\/title>/, () => `<title>${escapeHtml(title)}</title>\n${tags.join('\n')}`, '<title>');
  } else {
    replaceOnce(/<title>/, () => `${tags.join('\n')}\n<title>`, '<title>');
  }
  if (body !== undefined) {
    replaceOnce(/<div id="root"><\/div>/, () => `<div id="root">${body}</div>`, '<div id="root"></div>');
  }
  return html;
}

function writeFile(rel, content) {
  const file = path.join(BUILD, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return rel;
}

const outputPath = (routePath, lang) => {
  const localized = lang === 'es' ? (routePath === '/' ? '/es' : `/es${routePath}`) : routePath;
  return localized === '/' ? 'index.html' : `${localized.slice(1)}/index.html`;
};

// ---------------------------------------------------------------------------
// llms.txt
// ---------------------------------------------------------------------------

function buildLlmsTxt({ site, lang, t }) {
  const { BUSINESS, SITE_URL } = site;
  const url = (p) => `${SITE_URL}${site.localizePath(p, lang)}`;
  const route = (p) => site.findPublicRoute(p);
  const pageLink = (p) => `- [${t(route(p).title)}](${url(p)}): ${t(route(p).description)}`;
  const other = lang === 'es' ? 'en' : 'es';
  const mainPages = ['/', '/portfolio', '/about', '/contact', '/faq', '/cabinet-care', '/why-choose-us', '/hardware-catalog', '/design'];
  const quotePages = ['/quick-quote', '/book-appointment', '/contact'];
  const policyPages = ['/privacy', '/sms-consent-verification', '/sms-terms', '/sms-privacy'];

  return [
    `# ${BUSINESS.name}`,
    '',
    `> ${t('home.heroDescription').replace(/\.?$/, '.')}`,
    '',
    `- [${t('llms.otherLanguage')}](${SITE_URL}${other === 'es' ? '/es/llms.txt' : '/llms.txt'})`,
    `- [${t('llms.fullText')}](${SITE_URL}/llms-full.txt)`,
    '',
    `## ${t('llms.keyFacts')}`,
    '',
    `- ${t('llms.location')}: ${site.formatAddress()}`,
    `- ${t('llms.serviceArea')}: ${t('llms.serviceAreaValue')}`,
    `- ${t('llms.languages')}: ${t('llms.languagesValue')}`,
    `- ${t('llms.phoneEnglish')}: ${BUSINESS.phones.english.display}`,
    `- ${t('llms.phoneSpanish')}: ${BUSINESS.phones.spanish.display}`,
    `- ${t('contact.emailAddress')}: ${BUSINESS.email}`,
    `- ${t('contact.businessHours')}: ${t('contact.hours.weekdays')}; ${t('contact.hours.saturday')}; ${t('contact.hours.sunday')}`,
    `- Instagram: ${BUSINESS.sameAs[0]}`,
    '',
    `## ${t('llms.services')}`,
    '',
    ...site.SERVICES.map((s) => `- ${t(s.name)}: ${t(s.description)}`),
    '',
    `## ${t('llms.quote')}`,
    '',
    site.faqEntries(t).find((f) => f.id === 'quote').answer,
    '',
    ...quotePages.map(pageLink),
    '',
    `## ${t('llms.pages')}`,
    '',
    ...mainPages.map(pageLink),
    '',
    `## ${t('llms.faq')}`,
    '',
    ...site.faqEntries(t).flatMap((f) => [`### ${f.question}`, '', f.answer, '']),
    `## ${t('llms.policies')}`,
    '',
    ...policyPages.map(pageLink),
    ''
  ].join('\n');
}

// ---------------------------------------------------------------------------

async function main() {
  const indexFile = path.join(BUILD, 'index.html');
  const shellFile = path.join(BUILD, 'app-shell.html');
  if (!fs.existsSync(indexFile)) throw new Error(`${indexFile} not found: run react-scripts build first`);

  // The template is the untouched build/index.html. On a second run (without
  // a new build) index.html is already the home page, so rebuild the template
  // from the app shell instead.
  let template = fs.readFileSync(indexFile, 'utf8');
  if (template.includes('<div data-prerendered>')) {
    if (!fs.existsSync(shellFile)) throw new Error('build/index.html is already prerendered and build/app-shell.html is missing: rebuild');
    template = fs.readFileSync(shellFile, 'utf8').replace(`${SHELL_MARKER}\n`, '');
  }

  const { translations, site } = await loadSources();

  const siteUrl = site.SITE_URL;
  if (JSON.stringify(crawlPolicy.PUBLIC_PATHS.slice().sort()) !== JSON.stringify(site.PUBLIC_ROUTES.map((r) => r.path).sort())) {
    throw new Error('scripts/seo/crawl-policy.js PUBLIC_PATHS differs from PUBLIC_ROUTES in src/seo/site.js');
  }

  const missing = new Set();
  const written = [];
  const fullText = [`# ${site.SITE_NAME}`, ''];

  for (const lang of site.LANGUAGES) {
    const t = makeTranslator(translations, lang, missing);
    const lp = (p) => site.localizePath(p, lang);
    fullText.push(`> ${t('llms.fullText')}`, '');

    for (const route of site.PUBLIC_ROUTES) {
      const page = PAGES[route.path];
      if (!page) throw new Error(`No prerender content for ${route.path} in scripts/seo/pages.js`);
      const blocks = page({ t, lang, lp, site, route });
      const h1s = blocks.filter(([type]) => type === 'h1');
      if (h1s.length !== 1) throw new Error(`${route.path}: expected exactly one h1, found ${h1s.length}`);

      const { title, tags } = headTags({ site, route, lang, t });
      const body = chrome({ route, lang, t, lp, site, mainHtml: blocksToHtml(blocks) });
      written.push(writeFile(outputPath(route.path, lang), fillTemplate(template, { lang, title, tags, body })));

      fullText.push(
        `## ${t(route.title)}`,
        '',
        `URL: ${site.canonicalUrl(route, lang)}`,
        '',
        blocksToMarkdown(blocks, siteUrl, 2),
        ''
      );
    }

    written.push(writeFile(lang === 'es' ? 'es/llms.txt' : 'llms.txt', buildLlmsTxt({ site, lang, t })));
  }

  if (missing.size) {
    throw new Error(`Missing translations:\n  ${[...missing].join('\n  ')}`);
  }

  // Fallback for everything that is not a public page (admin, token links,
  // settings, unknown URLs): the plain app, kept out of search results.
  written.push(writeFile('app-shell.html', fillTemplate(template, { lang: 'en', tags: [SHELL_MARKER] })));
  written.push(writeFile('llms-full.txt', fullText.join('\n')));
  written.push(writeFile('robots.txt', crawlPolicy.buildRobotsTxt()));
  written.push(writeFile('sitemap.xml', crawlPolicy.buildSitemapXml()));

  console.log(`prerender: wrote ${written.length} files to ${path.relative(process.cwd(), BUILD) || '.'}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`prerender failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { SHELL_MARKER, outputPath, blocksToHtml };
