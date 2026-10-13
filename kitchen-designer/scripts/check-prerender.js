#!/usr/bin/env node
// Checks the output of scripts/prerender.js, the way a crawler without
// JavaScript would read it. Run after a build:
//
//   npm run build                      (runs the prerender as "postbuild")
//   node scripts/check-prerender.js    (or: npm run check:prerender)
//
// For every public page in both languages it checks the file exists and has
// the right <html lang>, one <title>, description, canonical, hreflang
// alternates, Open Graph URL, valid JSON-LD with the properties search
// engines require, one h1 with the expected text, the page's own content, the
// app bundle, and no leftover "undefined", {placeholders} or raw translation
// keys. It also checks the app shell, robots.txt, sitemap.xml and llms.txt,
// that private routes were not prerendered, and that the copies that must
// agree (public/robots.txt, the backend's crawl-policy.js, the Contact page
// hours) still do. No dependencies, Node 20+.

const fs = require('fs');
const path = require('path');
const { PAGES } = require('./seo/pages');
const crawlPolicy = require('./seo/crawl-policy');
const { ROOT, loadSources, makeTranslator } = require('./seo/load');
const { SHELL_MARKER, outputPath } = require('./prerender');

const BUILD = path.resolve(process.argv[2] || path.join(ROOT, 'build'));
const BACKEND_POLICY = path.join(ROOT, '..', 'cabinet-photo-server', 'utils', 'crawl-policy.js');
const PRIVATE_PATHS = ['admin', 'reset-password', 'register', 'invoice', 'testimonial', 'project', 'appointment', 'no-access', 'showroom'];

const failures = [];
const warnings = [];
let checks = 0;
// Advice rather than errors: length limits search results truncate at
const warn = (ok, message) => {
  if (!ok) warnings.push(message);
  return ok;
};
function check(ok, message) {
  checks += 1;
  if (!ok) failures.push(message);
  return ok;
}

const decode = (s) => String(s)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const all = (html, re) => [...html.matchAll(re)];
const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? decode(m[1]) : null;
};
const metaContent = (html, key, attrName = 'name') => all(html, /<meta\s[^>]*>/g)
  .map((m) => m[0])
  .filter((tag) => attr(tag, attrName) === key)
  .map((tag) => attr(tag, 'content'));
const stripTags = (html) => decode(html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');

// ---------------------------------------------------------------------------
// JSON-LD: required / recommended properties (schema.org + Google's docs)
// ---------------------------------------------------------------------------

function checkJsonLd(where, data, { route, lang, canonical, site, t, visibleText }) {
  check(data['@context'] === 'https://schema.org', `${where}: JSON-LD @context`);
  const graph = Array.isArray(data['@graph']) ? data['@graph'] : [];
  check(graph.length > 0, `${where}: JSON-LD has no @graph`);
  const byType = (type) => graph.filter((n) => n['@type'] === type);

  const [biz] = byType('HomeAndConstructionBusiness');
  if (check(!!biz, `${where}: no HomeAndConstructionBusiness node`)) {
    ['name', 'url', 'telephone', 'address', 'openingHoursSpecification', 'areaServed'].forEach((k) =>
      check(biz[k] !== undefined && biz[k] !== '', `${where}: business.${k} missing`));
    const a = biz.address || {};
    ['streetAddress', 'addressLocality', 'addressRegion', 'postalCode', 'addressCountry'].forEach((k) =>
      check(typeof a[k] === 'string' && a[k].length > 0, `${where}: business.address.${k} missing`));
    check(/^\+1-\d{3}-\d{3}-\d{4}$/.test(biz.telephone), `${where}: business.telephone format`);
    (biz.openingHoursSpecification || []).forEach((h, i) => {
      check(Array.isArray(h.dayOfWeek) && h.dayOfWeek.length > 0, `${where}: openingHours[${i}].dayOfWeek`);
      check(/^\d{2}:\d{2}$/.test(h.opens) && /^\d{2}:\d{2}$/.test(h.closes), `${where}: openingHours[${i}] times`);
    });
    check(!('aggregateRating' in biz) && !('review' in biz), `${where}: business must not carry review markup (none is computed from real data)`);
  }

  const [website] = byType('WebSite');
  check(website && website.url === `${site.SITE_URL}/` && website.name, `${where}: WebSite node`);

  const pageType = route.pageType || 'WebPage';
  const [page] = byType(pageType);
  if (check(!!page, `${where}: no ${pageType} node`)) {
    check(page.url === canonical, `${where}: ${pageType}.url ${page.url} != canonical ${canonical}`);
    check(page.inLanguage === lang, `${where}: ${pageType}.inLanguage`);
    check(!!page.name && !!page.description, `${where}: ${pageType} name/description`);
  }

  const crumbs = byType('BreadcrumbList');
  if (route.path === '/') {
    check(crumbs.length === 0, `${where}: home page should have no breadcrumb`);
    const services = byType('Service');
    check(services.length === site.SERVICES.length, `${where}: expected ${site.SERVICES.length} Service nodes`);
    services.forEach((s) => check(s.name && s.description && s.provider && s.provider['@id'], `${where}: Service ${s.name} incomplete`));
  } else if (check(crumbs.length === 1, `${where}: expected one BreadcrumbList`)) {
    const items = crumbs[0].itemListElement || [];
    check(items.length >= 2, `${where}: breadcrumb needs at least two items`);
    items.forEach((it, i) => {
      check(it['@type'] === 'ListItem' && it.position === i + 1 && it.name && it.item, `${where}: breadcrumb item ${i + 1}`);
    });
    check(items.length && items[items.length - 1].item === canonical, `${where}: last breadcrumb is not the page`);
  }

  if (pageType === 'FAQPage') {
    const questions = (page && page.mainEntity) || [];
    check(questions.length === site.FAQ_IDS.length, `${where}: FAQPage has ${questions.length} questions`);
    questions.forEach((q, i) => {
      const ok = q['@type'] === 'Question' && q.name && q.acceptedAnswer && q.acceptedAnswer['@type'] === 'Answer' && q.acceptedAnswer.text;
      check(ok, `${where}: FAQ question ${i + 1} incomplete`);
      // Google: the questions and answers must be visible on the page
      if (ok) {
        check(visibleText.includes(q.name), `${where}: FAQ question not visible: ${q.name}`);
        check(visibleText.includes(q.acceptedAnswer.text), `${where}: FAQ answer not visible: ${q.name}`);
      }
    });
  } else {
    check(!graph.some((n) => n.mainEntity), `${where}: unexpected mainEntity`);
  }
}

// ---------------------------------------------------------------------------

function checkPage({ site, translations, route, lang, keyPattern }) {
  const rel = outputPath(route.path, lang);
  const where = `${lang} ${route.path} (${rel})`;
  const file = path.join(BUILD, rel);
  if (!check(fs.existsSync(file), `${where}: file missing`)) return;
  const html = fs.readFileSync(file, 'utf8');
  const missing = new Set();
  const t = makeTranslator(translations, lang, missing);
  const lp = (p) => site.localizePath(p, lang);
  const canonical = site.canonicalUrl(route, lang);

  check(new RegExp(`<html[^>]*\\slang="${lang}"`).test(html), `${where}: <html lang="${lang}">`);

  const titles = all(html, /<title>([^<]*)<\/title>/g);
  const expectedTitle = site.formatTitle(t(route.title));
  check(titles.length === 1, `${where}: expected one <title>, found ${titles.length}`);
  check(titles[0] && decode(titles[0][1]) === expectedTitle, `${where}: title is "${titles[0] && decode(titles[0][1])}"`);
  warn(expectedTitle.length <= 70, `${where}: title is ${expectedTitle.length} characters; results show about 60`);

  const descriptions = metaContent(html, 'description');
  check(descriptions.length === 1 && descriptions[0] === t(route.description), `${where}: meta description`);
  warn(descriptions[0] && descriptions[0].length >= 70 && descriptions[0].length <= 200, `${where}: description is ${descriptions[0] && descriptions[0].length} characters; aim for 70-160`);
  check(metaContent(html, 'robots').length === 0, `${where}: public page must not carry a robots meta`);

  const canonicals = all(html, /<link\s[^>]*rel="canonical"[^>]*>/g).map((m) => attr(m[0], 'href'));
  check(canonicals.length === 1 && canonicals[0] === canonical, `${where}: canonical ${canonicals.join(', ')} != ${canonical}`);

  const alternates = Object.fromEntries(all(html, /<link\s[^>]*rel="alternate"[^>]*>/g)
    .map((m) => [attr(m[0], 'hreflang'), attr(m[0], 'href')]));
  site.alternateLinks(route).forEach((alt) =>
    check(alternates[alt.hreflang] === alt.href, `${where}: hreflang ${alt.hreflang} should be ${alt.href}`));

  check(metaContent(html, 'og:url', 'property')[0] === canonical, `${where}: og:url`);
  check(metaContent(html, 'og:title', 'property')[0] === expectedTitle, `${where}: og:title`);
  check(metaContent(html, 'og:locale', 'property')[0] === site.OG_LOCALE[lang], `${where}: og:locale`);
  check(/^https:\/\//.test(metaContent(html, 'og:image', 'property')[0] || ''), `${where}: og:image must be an absolute URL`);

  // Every head tag Helmet also renders carries data-rh, so it is taken over, not duplicated
  all(html, /<(meta|link)\s[^>]*>/g).map((m) => m[0])
    .filter((tag) => /name="description"|rel="canonical"|rel="alternate"|property="og:|name="twitter:/.test(tag))
    .forEach((tag) => check(/data-rh="true"/.test(tag), `${where}: head tag without data-rh: ${tag.slice(0, 60)}`));

  // Body: the prerendered copy inside #root
  const bodyMatch = html.match(/<div id="root">([\s\S]*?)<\/div>\s*(<!--|<script|<\/body>)/);
  const body = bodyMatch ? bodyMatch[1] : '';
  check(body.includes('<div data-prerendered>'), `${where}: no prerendered content in #root`);
  const visibleText = stripTags(body);
  const h1s = all(body, /<h1>([\s\S]*?)<\/h1>/g);
  const blocks = PAGES[route.path]({ t, lang, lp, site, route });
  const expectedH1 = blocks.find(([type]) => type === 'h1')[1];
  check(h1s.length === 1, `${where}: expected one h1, found ${h1s.length}`);
  check(h1s[0] && decode(h1s[0][1]) === expectedH1, `${where}: h1 is "${h1s[0] && decode(h1s[0][1])}", expected "${expectedH1}"`);
  check((body.match(/<main id="main-content">/g) || []).length === 1, `${where}: expected one <main id="main-content">`);
  check(body.includes('class="skip-link" href="#main-content"'), `${where}: skip link`);
  check(visibleText.length > 150, `${where}: very little text (${visibleText.length} characters)`);
  // every heading and plain paragraph of the page made it into the file
  blocks.filter(([type, content]) => /^(h[1-6]|p)$/.test(type) && typeof content === 'string').forEach(([, text]) => {
    check(visibleText.includes(text.replace(/\s+/g, ' ')), `${where}: missing text "${text.slice(0, 50)}..."`);
  });
  check(missing.size === 0, `${where}: missing translations: ${[...missing].join(', ')}`);

  // Links to other public pages stay in the same language
  all(body, /<a href="([^"]+)"([^>]*)>/g).forEach((m) => {
    const href = decode(m[1]);
    if (!href.startsWith('/') || href.startsWith('/documents/') || /hreflang=/.test(m[2])) return;
    const target = site.splitLanguagePath(href);
    if (!site.findPublicRoute(target.basePath)) {
      check(false, `${where}: link to a non-public page ${href}`);
      return;
    }
    check((target.lang === 'es') === (lang === 'es'), `${where}: link ${href} switches language`);
  });

  // The app still boots
  check(/<script[^>]+src="\/static\/js\/main\.[^"]+\.js"/.test(html), `${where}: app bundle <script> missing`);

  // Leftovers
  const text = `${visibleText} ${all(html, /<(?:meta|link)\s[^>]*data-rh="true"[^>]*>/g).map((m) => m[0]).join(' ')}`;
  check(!/\bundefined\b|\bnull\b|\[object Object\]|\bNaN\b/.test(text), `${where}: "undefined"/"null"/"NaN" in output`);
  check(!/\{[a-zA-Z0-9_]+\}/.test(visibleText), `${where}: unreplaced {placeholder}`);
  const rawKeys = (visibleText.match(keyPattern) || []);
  check(rawKeys.length === 0, `${where}: raw translation keys: ${rawKeys.slice(0, 5).join(', ')}`);

  // JSON-LD
  const scripts = all(html, /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g);
  if (check(scripts.length === 1, `${where}: expected one JSON-LD script, found ${scripts.length}`)) {
    let data = null;
    try {
      data = JSON.parse(scripts[0][1]);
    } catch (err) {
      check(false, `${where}: JSON-LD does not parse: ${err.message}`);
    }
    if (data) {
      const json = JSON.stringify(data);
      check(!/undefined|\[object Object\]/.test(json), `${where}: JSON-LD contains undefined`);
      check(!(json.match(keyPattern) || []).length, `${where}: JSON-LD contains raw translation keys`);
      checkJsonLd(where, data, { route, lang, canonical, site, t, visibleText });
    }
  }
}

function hoursFromText(text) {
  // "Monday - Friday: 7:00 AM - 5:00 PM" -> ['07:00', '17:00']
  const m = text.match(/(\d{1,2}):(\d{2})\s*([AP]M)\s*-\s*(\d{1,2}):(\d{2})\s*([AP]M)/i);
  if (!m) return null;
  const to24 = (h, min, ap) => {
    let hour = Number(h) % 12;
    if (/pm/i.test(ap)) hour += 12;
    return `${String(hour).padStart(2, '0')}:${min}`;
  };
  return [to24(m[1], m[2], m[3]), to24(m[4], m[5], m[6])];
}

async function main() {
  if (!fs.existsSync(path.join(BUILD, 'index.html'))) {
    console.error(`${BUILD}/index.html not found: run "npm run build" first`);
    process.exit(1);
  }
  const { translations, site } = await loadSources();

  // Any translation key appearing verbatim in the output means a missing string
  const keys = Object.keys(translations.en).filter((k) => /^[a-zA-Z]+\.[a-zA-Z0-9.-]*[a-zA-Z0-9]$/.test(k));
  const keyPattern = new RegExp(`(?<![\\w.@/-])(?:${keys.map((k) => k.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')).join('|')})(?![\\w.-])`, 'g');

  for (const lang of site.LANGUAGES) {
    for (const route of site.PUBLIC_ROUTES) {
      checkPage({ site, translations, route, lang, keyPattern });
    }
  }

  // The app shell: nginx's fallback for everything else
  const shellFile = path.join(BUILD, 'app-shell.html');
  if (check(fs.existsSync(shellFile), 'app-shell.html missing')) {
    const shell = fs.readFileSync(shellFile, 'utf8');
    check(shell.includes(SHELL_MARKER), 'app-shell.html: noindex meta missing');
    check(!shell.includes('<div data-prerendered>'), 'app-shell.html: must not contain page content');
    check(!/rel="canonical"/.test(shell), 'app-shell.html: must not have a canonical');
    check(/<div id="root"><\/div>/.test(shell), 'app-shell.html: empty #root expected');
    check(/<script[^>]+src="\/static\/js\/main\./.test(shell), 'app-shell.html: app bundle missing');
  }

  // Private routes are never prerendered
  PRIVATE_PATHS.forEach((p) => {
    check(!fs.existsSync(path.join(BUILD, p)) && !fs.existsSync(path.join(BUILD, 'es', p)), `private route prerendered: /${p}`);
  });

  // robots.txt
  const robots = fs.existsSync(path.join(BUILD, 'robots.txt')) ? fs.readFileSync(path.join(BUILD, 'robots.txt'), 'utf8') : '';
  check(robots === crawlPolicy.buildRobotsTxt(), 'build/robots.txt differs from crawl-policy.js');
  ['/admin', '/reset-password', '/register/', '/invoice/', '/testimonial/', '/project/', '/appointment/cancel/', '/api/'].forEach((p) =>
    check(robots.includes(`\nDisallow: ${p}\n`), `robots.txt: Disallow ${p} missing`));
  check(!/^Disallow:\s*\/\s*$/m.test(robots), 'robots.txt: something disallows the whole site');
  check(robots.includes('\nSitemap: https://gudinocustom.com/sitemap.xml\n'), 'robots.txt: Sitemap line');
  ['Googlebot', 'Bingbot', 'GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'Claude-SearchBot', 'PerplexityBot', 'Google-Extended'].forEach((ua) =>
    check(robots.includes(`User-agent: ${ua}\n`), `robots.txt: ${ua} not listed`));
  const publicRobots = path.join(ROOT, 'public', 'robots.txt');
  check(fs.existsSync(publicRobots) && fs.readFileSync(publicRobots, 'utf8') === robots,
    'public/robots.txt differs from the generated one (copy build/robots.txt over it)');
  if (fs.existsSync(BACKEND_POLICY)) {
    check(fs.readFileSync(BACKEND_POLICY, 'utf8') === fs.readFileSync(path.join(__dirname, 'seo', 'crawl-policy.js'), 'utf8'),
      'cabinet-photo-server/utils/crawl-policy.js differs from scripts/seo/crawl-policy.js (they must be identical)');
  }
  check(JSON.stringify(crawlPolicy.PUBLIC_PATHS.slice().sort()) === JSON.stringify(site.PUBLIC_ROUTES.map((r) => r.path).sort()),
    'crawl-policy.js PUBLIC_PATHS differs from PUBLIC_ROUTES in src/seo/site.js');

  // sitemap.xml: exactly the prerendered pages, each with its alternates
  const sitemap = fs.existsSync(path.join(BUILD, 'sitemap.xml')) ? fs.readFileSync(path.join(BUILD, 'sitemap.xml'), 'utf8') : '';
  const locs = all(sitemap, /<loc>([^<]+)<\/loc>/g).map((m) => decode(m[1])).sort();
  const expectedLocs = site.LANGUAGES.flatMap((lang) => site.PUBLIC_ROUTES.map((r) => site.canonicalUrl(r, lang))).sort();
  check(JSON.stringify(locs) === JSON.stringify(expectedLocs), `sitemap.xml lists ${locs.length} URLs, expected ${expectedLocs.length}`);
  check((sitemap.match(/<xhtml:link rel="alternate"/g) || []).length === expectedLocs.length * 3, 'sitemap.xml: 3 alternates per URL');
  check(!/<lastmod>/.test(sitemap), 'build/sitemap.xml should carry no lastmod (only the backend knows real dates)');

  // llms.txt
  for (const [rel, lang] of [['llms.txt', 'en'], ['es/llms.txt', 'es']]) {
    const file = path.join(BUILD, rel);
    if (!check(fs.existsSync(file), `${rel} missing`)) continue;
    const text = fs.readFileSync(file, 'utf8');
    check(text.startsWith(`# ${site.SITE_NAME}\n`), `${rel}: must start with "# ${site.SITE_NAME}"`);
    [site.BUSINESS.phones.english.display, site.BUSINESS.phones.spanish.display, site.BUSINESS.email, site.formatAddress()].forEach((fact) =>
      check(text.includes(fact), `${rel}: missing ${fact}`));
    site.PUBLIC_ROUTES.forEach((r) => check(text.includes(`(${site.canonicalUrl(r, lang)})`), `${rel}: no link to ${site.canonicalUrl(r, lang)}`));
    check(!/\bundefined\b|\{[a-zA-Z0-9_]+\}/.test(text), `${rel}: undefined or placeholder`);
    check(!(text.match(keyPattern) || []).length, `${rel}: raw translation keys`);
  }
  const full = path.join(BUILD, 'llms-full.txt');
  if (check(fs.existsSync(full), 'llms-full.txt missing')) {
    const text = fs.readFileSync(full, 'utf8');
    check(!/\bundefined\b/.test(text) && !(text.match(keyPattern) || []).length, 'llms-full.txt: undefined or raw keys');
    expectedLocs.forEach((u) => check(text.includes(`URL: ${u}\n`), `llms-full.txt: no section for ${u}`));
  }

  // The structured-data hours must match what the Contact page says
  const hourKeys = ['contact.hours.weekdays', 'contact.hours.saturday'];
  hourKeys.forEach((key, i) => {
    const parsed = hoursFromText(translations.en[key]);
    const spec = site.BUSINESS.hours[i];
    check(parsed && spec && parsed[0] === spec.opens && parsed[1] === spec.closes,
      `BUSINESS.hours[${i}] (${spec && spec.opens}-${spec && spec.closes}) does not match ${key} "${translations.en[key]}"`);
  });

  // Escaping sanity: the home page title in the file is HTML-escaped
  const home = fs.readFileSync(path.join(BUILD, 'index.html'), 'utf8');
  check(home.includes(`<title>${escapeHtml(site.formatTitle(translations.en['seo.home.title']))}</title>`), 'build/index.html is not the English home page');

  if (warnings.length) {
    console.log(`check-prerender: ${warnings.length} warnings (not failures):`);
    warnings.forEach((w) => console.log(`  ~ ${w}`));
  }
  if (failures.length) {
    console.error(`check-prerender: ${failures.length} of ${checks} checks failed:`);
    failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }
  console.log(`check-prerender: all ${checks} checks passed (${site.PUBLIC_ROUTES.length} pages x ${site.LANGUAGES.length} languages)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
