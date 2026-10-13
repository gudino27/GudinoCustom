// Site facts, public routes and structured data, shared by the React app
// (SEO.js, LanguageContext, Navigation) and the build step that prerenders
// every public page (scripts/prerender.js). The build loads this file on its
// own as an ES module, so it must stay free of imports and JSX.
//
// Only facts the site already publishes belong in BUSINESS: they are repeated
// in JSON-LD, llms.txt and the prerendered HTML that crawlers read.

export const SITE_URL = 'https://gudinocustom.com';
export const SITE_NAME = 'Gudino Custom Woodworking';
export const LANGUAGES = ['en', 'es'];
export const DEFAULT_LANGUAGE = 'en';
export const OG_LOCALE = { en: 'en_US', es: 'es_US' };

export const BUSINESS = {
  name: SITE_NAME,
  // websitePrivacy.commitment.content
  legalName: 'Gudino Custom Woodworking LLC',
  // footer copyright and the SMS policy pages
  alternateName: 'Gudino Custom Cabinets',
  // Contact page
  email: 'Info@gudinocustom.com',
  phones: {
    english: { display: '(509) 515-4090', tel: '+15095154090', schema: '+1-509-515-4090' },
    spanish: { display: '(509) 831-9816', tel: '+15098319816', schema: '+1-509-831-9816' }
  },
  address: {
    street: '70 Ray Rd',
    locality: 'Sunnyside',
    region: 'WA',
    postalCode: '98944',
    country: 'US'
  },
  // Contact page, contact.hours.* (scripts/check-prerender.js compares the two)
  hours: [
    { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '07:00', closes: '17:00' },
    { days: ['Saturday'], opens: '08:00', closes: '17:00' }
  ],
  // "throughout Washington" (home.heroDescription, seo.home.description)
  areaServed: 'Washington',
  // InstagramFeed follow link
  sameAs: ['https://www.instagram.com/gudinocustomwoodworking/'],
  logo: `${SITE_URL}/O.png`
};

export const formatAddress = () => {
  const a = BUSINESS.address;
  return `${a.street}, ${a.locality}, ${a.region} ${a.postalCode}`;
};

// Every public, indexable page. Each one is prerendered in both languages
// (/about and /es/about), listed in the sitemap with hreflang alternates and
// given a canonical URL. Anything not listed here (admin, token links, the
// showroom while it is hidden, settings pages) is served the noindex app shell.
// title / description / name are translation keys.
export const PUBLIC_ROUTES = [
  { path: '/', title: 'seo.home.title', description: 'seo.home.description', name: 'seo.breadcrumb.home' },
  { path: '/portfolio', title: 'seo.portfolio.title', description: 'seo.portfolio.description', name: 'nav.portfolio', pageType: 'CollectionPage' },
  { path: '/design', title: 'seo.design.title', description: 'seo.design.description', name: 'nav.design' },
  { path: '/about', title: 'seo.about.title', description: 'seo.about.description', name: 'nav.about', pageType: 'AboutPage' },
  { path: '/contact', title: 'seo.contact.title', description: 'seo.contact.description', name: 'nav.contact', pageType: 'ContactPage' },
  { path: '/faq', title: 'seo.faq.title', description: 'seo.faq.description', name: 'nav.faq', pageType: 'FAQPage' },
  { path: '/cabinet-care', title: 'seo.cabinetCare.title', description: 'seo.cabinetCare.description', name: 'footer.cabinetCare' },
  { path: '/why-choose-us', title: 'whyChooseUs.title', description: 'seo.whyChooseUs.description', name: 'nav.whyChooseUs' },
  { path: '/hardware-catalog', title: 'seo.hardware.title', description: 'seo.hardware.description', name: 'nav.hardwareCatalog' },
  { path: '/book-appointment', title: 'seo.booking.title', description: 'seo.booking.description', name: 'nav.bookAppointment' },
  { path: '/quick-quote', title: 'quickQuote.pageTitle', description: 'choice.quickQuote.description', name: 'quickQuote.pageTitle' },
  { path: '/privacy', title: 'websitePrivacy.header', description: 'websitePrivacy.commitment.content', name: 'sms.tabs.website' },
  { path: '/sms-consent-verification', title: 'smsCompliance.consent.header', description: 'smsCompliance.consent.policy.content', name: 'sms.tabs.consent' },
  { path: '/sms-terms', title: 'smsCompliance.terms.header', description: 'smsCompliance.terms.frequency.intro', name: 'sms.tabs.terms' },
  { path: '/sms-privacy', title: 'smsCompliance.privacy.header', description: 'smsCompliance.privacy.sharing.never', name: 'sms.tabs.privacy' }
];

// Services the home page describes (the "See What We Do" list)
export const SERVICES = [
  { id: 'kitchen-remodeling', name: 'home.workTypes.kitchen', description: 'home.workTypes.kitchenDesc' },
  { id: 'bathroom-renovations', name: 'home.workTypes.bathroom', description: 'home.workTypes.bathroomDesc' },
  { id: 'custom-carpentry', name: 'home.workTypes.carpentry', description: 'home.workTypes.carpentryDesc' },
  { id: 'cabinet-installation', name: 'home.workTypes.cabinets', description: 'home.workTypes.cabinetsDesc' },
  { id: 'home-remodeling', name: 'home.workTypes.remodeling', description: 'home.workTypes.remodelingDesc' },
  { id: 'commercial-projects', name: 'home.workTypes.commercial', description: 'home.workTypes.commercialDesc' },
  { id: 'insurance-work', name: 'home.workTypes.insurance', description: 'home.workTypes.insuranceDesc' }
];

// Questions answered on /faq (faq.<id>.q / faq.<id>.a). Every answer restates
// something the site already says elsewhere; see the comment in translations.js.
export const FAQ_IDS = [
  'services', 'area', 'spanish', 'quote', 'hours', 'process',
  'design', 'warranty', 'cleaning', 'bigBox', 'commercial'
];

// ---------------------------------------------------------------------------
// Paths and URLs
// ---------------------------------------------------------------------------

const ROUTE_BY_PATH = new Map(PUBLIC_ROUTES.map((r) => [r.path, r]));

// '/es/about/' -> { lang: 'es', basePath: '/about' }; '/about' -> { lang: null, ... }
export function splitLanguagePath(pathname) {
  let p = String(pathname || '/').replace(/\/{2,}/g, '/');
  if (p.length > 1) p = p.replace(/\/+$/, '');
  if (!p.startsWith('/')) p = `/${p}`;
  const lower = p.toLowerCase();
  if (lower === '/es') return { lang: 'es', basePath: '/' };
  if (lower.startsWith('/es/')) return { lang: 'es', basePath: p.slice(3) };
  return { lang: null, basePath: p };
}

export function findPublicRoute(basePath) {
  return ROUTE_BY_PATH.get(String(basePath || '/').toLowerCase()) || null;
}

// Public pages get a language prefix (/es/...); every other path is returned
// unchanged, so admin and token links keep working in both languages.
export function localizePath(path, lang) {
  const match = String(path || '/').match(/^([^?#]*)(.*)$/);
  const { basePath } = splitLanguagePath(match[1] || '/');
  const route = findPublicRoute(basePath);
  if (!route) return path;
  const localized = lang === 'es' ? (route.path === '/' ? '/es' : `/es${route.path}`) : route.path;
  return localized + match[2];
}

export const absoluteUrl = (path) => `${SITE_URL}${path}`;

export const canonicalUrl = (route, lang) => absoluteUrl(localizePath(route.path, lang));

export function alternateLinks(route) {
  return [
    { hreflang: 'en', href: canonicalUrl(route, 'en') },
    { hreflang: 'es', href: canonicalUrl(route, 'es') },
    { hreflang: 'x-default', href: canonicalUrl(route, DEFAULT_LANGUAGE) }
  ];
}

// Pages pass translated titles, some of which already name the business
// ("Por Qué Elegir Gudino Custom Woodworking"), so only add the suffix when it
// is missing, and never render "undefined | ..." when a page omits one.
export function formatTitle(title) {
  const pageTitle = typeof title === 'string' ? title.trim() : '';
  if (!pageTitle) return SITE_NAME;
  return pageTitle.toLowerCase().includes(SITE_NAME.toLowerCase())
    ? pageTitle
    : `${pageTitle} | ${SITE_NAME}`;
}

// JSON for a <script type="application/ld+json">: "<" is escaped so a string
// can never close the script element early.
export const serializeJsonLd = (data) => JSON.stringify(data).replace(/</g, '\\u003c');

// ---------------------------------------------------------------------------
// Structured data (schema.org JSON-LD)
// ---------------------------------------------------------------------------

const BUSINESS_ID = `${SITE_URL}/#business`;
const WEBSITE_ID = `${SITE_URL}/#website`;

function businessNode(t) {
  const a = BUSINESS.address;
  return {
    '@type': 'HomeAndConstructionBusiness',
    '@id': BUSINESS_ID,
    name: BUSINESS.name,
    legalName: BUSINESS.legalName,
    alternateName: BUSINESS.alternateName,
    description: t('home.heroDescription'),
    url: `${SITE_URL}/`,
    logo: BUSINESS.logo,
    image: BUSINESS.logo,
    telephone: BUSINESS.phones.english.schema,
    email: BUSINESS.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: a.street,
      addressLocality: a.locality,
      addressRegion: a.region,
      postalCode: a.postalCode,
      addressCountry: a.country
    },
    areaServed: { '@type': 'State', name: BUSINESS.areaServed },
    openingHoursSpecification: BUSINESS.hours.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: h.days,
      opens: h.opens,
      closes: h.closes
    })),
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        telephone: BUSINESS.phones.english.schema,
        email: BUSINESS.email,
        availableLanguage: ['English']
      },
      {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        telephone: BUSINESS.phones.spanish.schema,
        availableLanguage: ['Spanish']
      }
    ],
    knowsLanguage: ['en', 'es'],
    sameAs: BUSINESS.sameAs
  };
}

function serviceNodes(t) {
  return SERVICES.map((s) => ({
    '@type': 'Service',
    '@id': `${SITE_URL}/#service-${s.id}`,
    name: t(s.name),
    serviceType: t(s.name),
    description: t(s.description),
    provider: { '@id': BUSINESS_ID },
    areaServed: { '@type': 'State', name: BUSINESS.areaServed }
  }));
}

// Values interpolated into the FAQ answers, so the numbers and hours there
// always match the Contact page
export function faqVars(t) {
  return {
    phoneEnglish: BUSINESS.phones.english.display,
    phoneSpanish: BUSINESS.phones.spanish.display,
    email: BUSINESS.email,
    address: formatAddress(),
    weekdays: t('contact.hours.weekdays'),
    saturday: t('contact.hours.saturday'),
    sunday: t('contact.hours.sunday')
  };
}

// t is the app's translate function: t(key) or t(key, { name: value })
export function faqEntries(t) {
  const vars = faqVars(t);
  return FAQ_IDS.map((id) => ({ id, question: t(`faq.${id}.q`), answer: t(`faq.${id}.a`, vars) }));
}

// One @graph per page: the business, the website, the page itself, its
// breadcrumb, plus the services (home) or the questions (FAQ).
export function buildStructuredData({ route, lang, t }) {
  const url = canonicalUrl(route, lang);
  const isHome = route.path === '/';
  const page = {
    '@type': route.pageType || 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: formatTitle(t(route.title)),
    description: t(route.description),
    inLanguage: lang,
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': BUSINESS_ID }
  };

  const graph = [
    businessNode(t),
    {
      '@type': 'WebSite',
      '@id': WEBSITE_ID,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      inLanguage: LANGUAGES,
      publisher: { '@id': BUSINESS_ID }
    },
    page
  ];

  if (!isHome) {
    page.breadcrumb = { '@id': `${url}#breadcrumb` };
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: t('seo.breadcrumb.home'), item: canonicalUrl(PUBLIC_ROUTES[0], lang) },
        { '@type': 'ListItem', position: 2, name: t(route.name), item: url }
      ]
    });
  }

  if (isHome) graph.push(...serviceNodes(t));

  if (route.pageType === 'FAQPage') {
    page.mainEntity = faqEntries(t).map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer }
    }));
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}
