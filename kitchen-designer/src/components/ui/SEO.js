import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  OG_LOCALE,
  SITE_NAME,
  alternateLinks,
  buildStructuredData,
  canonicalUrl,
  findPublicRoute,
  formatTitle,
  serializeJsonLd,
  splitLanguagePath
} from '../../seo/site';

/**
 * SEO Component
 * Sets the title, description, canonical URL, hreflang alternates, Open Graph /
 * Twitter tags and JSON-LD for the current page.
 *
 * Public pages (PUBLIC_ROUTES in src/seo/site.js) are also prerendered at build
 * time with exactly these tags (scripts/prerender.js). The prerendered tags
 * carry data-rh="true", so Helmet takes them over on the client instead of
 * duplicating them. For those pages the canonical, alternates and JSON-LD come
 * from the route table, keyed on the URL, so a crawler with or without
 * JavaScript reads the same thing.
 */
const DEFAULT_OG_IMAGE = 'https://gudinocustom.com/O.png';

const SEO = ({
  title,
  description,
  keywords,
  ogImage = DEFAULT_OG_IMAGE,
  canonical,
  noindex = false
}) => {
  const { pathname } = useLocation();
  const { t, currentLanguage } = useLanguage();

  const { basePath } = splitLanguagePath(pathname);
  const route = findPublicRoute(basePath);
  const lang = currentLanguage === 'es' ? 'es' : 'en';

  const fullTitle = formatTitle(title);
  const canonicalHref = route ? canonicalUrl(route, lang) : canonical;
  const alternates = route ? alternateLinks(route) : [];
  const jsonLd = route && !noindex ? serializeJsonLd(buildStructuredData({ route, lang, t })) : null;
  const otherLocale = lang === 'es' ? OG_LOCALE.en : OG_LOCALE.es;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      {keywords && <meta name="keywords" content={keywords} />}
      {noindex && <meta name="robots" content="noindex" />}

      {/* Canonical URL and language alternates */}
      {canonicalHref && <link rel="canonical" href={canonicalHref} />}
      {alternates.map((alt) => (
        <link key={alt.hreflang} rel="alternate" hrefLang={alt.hreflang} href={alt.href} />
      ))}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      {canonicalHref && <meta property="og:url" content={canonicalHref} />}
      <meta property="og:image" content={ogImage} />
      <meta property="og:locale" content={OG_LOCALE[lang]} />
      {route && <meta property="og:locale:alternate" content={otherLocale} />}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={ogImage} />

      {/* Structured data (schema.org) */}
      {jsonLd && <script type="application/ld+json">{jsonLd}</script>}
    </Helmet>
  );
};

export default SEO;
