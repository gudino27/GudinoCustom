// Static content of every public page, for scripts/prerender.js.
//
// Each page mirrors what its React component shows, in the same order and with
// the same translation keys, so crawlers that do not run JavaScript read what a
// visitor sees. Dynamic parts (portfolio photos, team members, testimonials,
// the PDF viewer, form fields) are left out. When you change a page's visible
// text in src/components, change it here too; scripts/check-prerender.js checks
// every key used here exists in both languages.
//
// A page is a list of blocks:
//   ['h1' | 'h2' | 'h3', text]
//   ['p', inline]                  inline = string or array of parts:
//   ['ul', [inline, ...]]            string | { a: href, text } | { strong } | { em }
//
// ctx: { t, lang, lp (localized path), site (src/seo/site.js exports) }

const item = (title, ...lines) => [{ strong: title }, ' ', lines.filter(Boolean).join(' ')];

const PAGES = {
  '/': ({ t, lp, site }) => [
    ['h1', t('home.companyName')],
    ['p', t('home.tagline')],
    ['p', t('home.heroDescription')],
    ['p', t('home.quote1')],
    ['p', t('home.quote2')],
    ['h2', t('home.unlimitedScope')],
    ['p', t('home.scopeDescription')],
    ['p', [{ a: lp('/contact'), text: t('home.contactUs') }]],
    ['h2', t('home.ourCreations')],
    ['p', t('home.creationsDescription')],
    ...site.SERVICES.flatMap((s) => [['h3', t(s.name)], ['p', t(s.description)]]),
    ['p', [{ a: lp('/portfolio'), text: t('home.viewPortfolio') }]],
    ['h2', t('home.makeItYourself')],
    ['p', t('home.designDescription')],
    ['p', [{ a: lp('/design'), text: t('home.useDesigner') }]],
    ['h2', t('home.knowMore')],
    ['p', t('home.knowMoreDescription')],
    ['p', [{ a: lp('/about'), text: t('home.aboutUs') }]]
  ],

  '/portfolio': ({ t }) => [
    ['h1', t('portfolio.heading')],
    ['p', t('portfolio.intro')]
  ],

  '/design': ({ t, lp }) => [
    ['h1', t('designer.setupHeading')],
    ['p', t('designer.designYourRoom', { room: t('designer.kitchen') })],
    ['h2', t('choice.quickQuote.title')],
    ['p', t('choice.quickQuote.description')],
    ['ul', [1, 2, 3, 4].map((n) => t(`choice.quickQuote.feature${n}`))],
    ['p', [{ a: lp('/quick-quote'), text: t('choice.quickQuote.button') }]],
    ['p', t('choice.unsure')]
  ],

  '/about': ({ t }) => [
    ['h1', t('about.heroTitle')],
    ['p', t('about.heroSubtitle')],
    ['h2', t('about.companyTitle')],
    ['p', t('about.companyDescription')],
    ['h2', t('about.teamTitle')],
    ['p', t('about.teamSubtitle')],
    ['h2', t('about.testimonialsTitle')],
    ['p', t('about.testimonialsSubtitle')]
  ],

  '/contact': ({ t, lp, site }) => {
    const { BUSINESS } = site;
    const address = site.formatAddress();
    const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
    return [
      ['h1', t('contact.heroTitle')],
      ['p', t('contact.heroSubtitle')],
      ['p', [t('contact.faqPrompt'), ' ', { a: lp('/faq'), text: t('contact.faqLink') }]],
      ['h2', t('contact.callUs')],
      ['p', [`${t('contact.languageLabel.english')}: `, { a: `tel:${BUSINESS.phones.english.tel}`, text: BUSINESS.phones.english.display }]],
      ['p', [`${t('contact.languageLabel.spanish')}: `, { a: `tel:${BUSINESS.phones.spanish.tel}`, text: BUSINESS.phones.spanish.display }]],
      ['h2', t('contact.emailUs')],
      ['p', [{ a: `mailto:${BUSINESS.email}`, text: BUSINESS.email }]],
      ['h2', t('contact.visitUs')],
      ['p', address],
      ['p', [{ a: directions, text: t('contact.getDirections') }]],
      ['h2', t('contact.businessHours')],
      ['p', t('contact.hours.weekdays')],
      ['p', t('contact.hours.saturday')],
      ['p', t('contact.hours.sunday')],
      ['h2', t('contact.mapTitle')],
      ['p', t('contact.mapSubtitle')]
    ];
  },

  '/faq': ({ t, lp, site }) => [
    ['h1', t('faq.heading')],
    ['p', [{ em: t('faq.intro') }]],
    ...site.faqEntries(t).flatMap((f) => [['h2', f.question], ['p', f.answer]]),
    ['h2', t('faq.moreTitle')],
    ['p', t('faq.moreText')],
    ['ul', [
      [{ a: lp('/contact'), text: t('nav.contact') }],
      [{ a: lp('/book-appointment'), text: t('nav.bookAppointment') }],
      [{ a: lp('/quick-quote'), text: t('quickQuote.pageTitle') }],
      [{ a: lp('/cabinet-care'), text: t('footer.cabinetCare') }]
    ]]
  ],

  '/cabinet-care': ({ t }) => {
    const c = (k) => t(`cabinetCare.${k}`);
    return [
      ['h1', c('title')],
      ['p', [{ em: c('intro') }]],
      ['h2', c('maintenance.title')],
      ['p', c('maintenance.intro')],
      ['h2', c('attention.title')],
      ['ul', ['sink', 'oven', 'appliances', 'trash', 'dishwasher', 'cooktop']
        .map((k) => item(c(`attention.${k}.title`), c(`attention.${k}.content`)))],
      ['p', [{ strong: c('attention.important') }]],
      ['h2', c('guidelines.title')],
      ['ul', [
        item(c('guidelines.routine.title'), ...[1, 2, 3, 4, 5].map((n) => c(`guidelines.routine.item${n}`))),
        item(c('guidelines.periodic.title'), ...[1, 2, 3, 4].map((n) => c(`guidelines.periodic.item${n}`)))
      ]],
      ['p', [{ strong: c('guidelines.important') }]],
      ['h2', c('environment.title')],
      ['ul', ['humidity', 'sunlight', 'temperature']
        .map((k) => item(c(`environment.${k}.title`), ...[1, 2, 3].map((n) => c(`environment.${k}.item${n}`))))],
      ['p', [{ strong: c('environment.important') }]],
      ['h2', c('cleaning.title')],
      ['p', c('cleaning.intro')],
      ['ul', [
        item(c('cleaning.routine.title'), c('cleaning.routine.item1'), c('cleaning.routine.item2')),
        item(c('cleaning.grease.title'), c('cleaning.grease.content'), c('cleaning.grease.recommendation'), c('cleaning.grease.aftercare'))
      ]],
      ['p', c('cleaning.woodGrain')],
      ['h2', c('avoid.title')],
      ['p', c('avoid.intro')],
      ['ul', [
        item(c('avoid.harsh.title'), c('avoid.harsh.item1'), c('avoid.harsh.item2'), c('avoid.harsh.examples')),
        item(c('avoid.waxes.title'), ...[1, 2, 3, 4].map((n) => c(`avoid.waxes.item${n}`)), c('avoid.waxes.examples')),
        item(c('avoid.abrasives.title'), c('avoid.abrasives.item1'), c('avoid.abrasives.item2'), c('avoid.abrasives.examples')),
        item(c('avoid.sponges.title'), c('avoid.sponges.item1'), c('avoid.sponges.item2'))
      ]],
      ['h2', c('specialty.title')],
      ['ul', [
        item(c('specialty.glass.title'), ...[1, 2, 3].map((n) => c(`specialty.glass.item${n}`))),
        item(c('specialty.maple.title'), c('specialty.maple.item1'), c('specialty.maple.item2'), c('specialty.maple.item3'),
          c('specialty.maple.item4'), c('specialty.maple.product'), c('specialty.maple.item5')),
        item(c('specialty.bread.title'), ...[1, 2, 3, 4].map((n) => c(`specialty.bread.item${n}`)))
      ]],
      ['h2', c('warranty.title')],
      ['ul', [
        item(c('warranty.who.title'), ...[1, 2, 3, 4].map((n) => c(`warranty.who.item${n}`))),
        item(c('warranty.what.title'), c('warranty.what.item1'), c('warranty.what.company'), c('warranty.what.item2'), c('warranty.what.item3')),
        item(c('warranty.willDo.title'), ...[1, 2, 3].map((n) => c(`warranty.willDo.item${n}`)))
      ]],
      ['h2', c('lifetime.title')],
      ['ul', [item(c('lifetime.effect.title'), ...[1, 2, 3, 4, 5, 6, 7].map((n) => c(`lifetime.effect.item${n}`)))]],
      ['h2', c('notCovered.title')],
      ['ul', [
        item(c('notCovered.hairline.title'), ...[1, 2, 3].map((n) => c(`notCovered.hairline.item${n}`))),
        item(c('notCovered.mellowing.title'), c('notCovered.mellowing.item1'), c('notCovered.mellowing.item2')),
        item(c('notCovered.installation.title'), ...[1, 2, 3, 4, 5].map((n) => c(`notCovered.installation.item${n}`)))
      ]],
      ['h2', c('void.title')],
      ['p', [c('void.intro1'), c('void.intro2'), c('void.intro3')].join(' ')],
      ['ul', ['water', 'chips', 'modifications', 'storage', 'appliance']
        .map((k) => item(c(`void.${k}.title`), c(`void.${k}.item1`), c(`void.${k}.item2`)))],
      ['h2', c('exceptions.title')],
      ['ul', ['electronic', 'specialty', 'products']
        .map((k) => item(c(`exceptions.${k}.title`), c(`exceptions.${k}.item1`), c(`exceptions.${k}.item2`)))],
      ['p', [{ a: '/documents/Cabinet_Care,Cleaning&Warranty_Guide.pdf', text: c('downloadGuide') }]]
    ];
  },

  '/why-choose-us': ({ t }) => {
    const w = (k) => t(`whyChooseUs.${k}`);
    const section = (key, items, withProblems) => [
      ['h2', w(`${key}.title`)],
      ...(withProblems ? [['p', [{ strong: w(`${key}.problems`) }]]] : []),
      ['p', w(`${key}.description`)],
      ['ul', items.map((k) => item(w(`${key}.${k}.title`), w(`${key}.${k}.description`)))],
      ['p', [{ strong: w(`${key}.callToAction`) }, ' ', w(`${key}.callToActionText`)]]
    ];
    return [
      ['h1', w('title')],
      ['p', [{ em: w('subtitle') }]],
      ...section('setsApart', ['inHouse', 'perfectFit', 'builtToLast', 'directCommunication', 'betterScheduling', 'quality'], false),
      ...section('bigBox', ['measurements', 'delays', 'damaged', 'quality', 'support'], true),
      ...section('installation', ['notLevel', 'poorAttachment', 'misaligned', 'support', 'gaps', 'appliances'], true)
    ];
  },

  '/hardware-catalog': ({ t }) => [
    ['h1', t('hardware.heading')],
    ['p', [{ a: '/documents/GUDINO-CWW-Handle-Catalog.pdf', text: t('hardware.downloadFull') }]],
    ['p', [{ strong: t('hardware.assistTitle') }, ' ', t('hardware.assistText')]]
  ],

  '/book-appointment': ({ t }) => [
    ['h1', t('appointments.title')],
    ['p', t('appointments.subtitle')],
    ['h2', t('appointments.selectType')],
    ['ul', ['consultation', 'measurement', 'estimate', 'followup']
      .map((k) => item(t(`appointments.type.${k}`), t(`appointments.typeDesc.${k}`)))]
  ],

  '/quick-quote': ({ t }) => [
    ['h1', t('quickQuote.heading')],
    ['p', t('quickQuote.intro')],
    ['p', t('quickQuote.photosHelp')]
  ]
};

// The four policy pages share one component (SmsCompliance): the page title,
// its opening statement and links between the policies.
const policyPage = ({ t, lp, route }) => [
  ['h1', t(route.title)],
  ['p', t(route.description)],
  ['ul', [
    [{ a: lp('/privacy'), text: t('sms.tabs.website') }],
    [{ a: lp('/sms-consent-verification'), text: t('sms.tabs.consent') }],
    [{ a: lp('/sms-terms'), text: t('sms.tabs.terms') }],
    [{ a: lp('/sms-privacy'), text: t('sms.tabs.privacy') }]
  ]]
];
['/privacy', '/sms-consent-verification', '/sms-terms', '/sms-privacy'].forEach((p) => {
  PAGES[p] = policyPage;
});

// Header and footer around every page (mirrors Navigation and Footer)
const NAV = [
  ['/portfolio', 'nav.portfolio'],
  ['/design', 'nav.design'],
  ['/about', 'nav.about'],
  ['/contact', 'nav.contact'],
  ['/cabinet-care', 'footer.cabinetCare'],
  ['/hardware-catalog', 'nav.hardwareCatalog'],
  ['/why-choose-us', 'nav.whyChooseUs'],
  ['/book-appointment', 'nav.bookAppointment'],
  ['/faq', 'nav.faq']
];

const FOOTER_LINKS = [
  ['/sms-consent-verification', 'footer.smsConsent'],
  ['/sms-terms', 'footer.terms'],
  ['/privacy', 'footer.privacy'],
  ['/cabinet-care', 'footer.cabinetCare'],
  ['/hardware-catalog', 'footer.hardwareCatalog'],
  ['/faq', 'nav.faq']
];

module.exports = { PAGES, NAV, FOOTER_LINKS };
