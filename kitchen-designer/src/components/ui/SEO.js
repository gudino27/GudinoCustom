import { Helmet } from 'react-helmet-async';

/**
 * SEO Component
 * Provides dynamic meta tags for each page to improve search engine optimization
 * and social media sharing
 */
const SITE_NAME = 'Gudino Custom Woodworking';

const SEO = ({
  title,
  description,
  keywords,
  ogImage = 'https://gudinocustom.com/O.png',
  canonical
}) => {
  // Pages pass translated titles, some of which already name the business
  // ("Por Qué Elegir Gudino Custom Woodworking"), so only add the suffix when
  // it is missing - and never render "undefined | ..." when a page omits it.
  const pageTitle = typeof title === 'string' ? title.trim() : '';
  const fullTitle = !pageTitle
    ? SITE_NAME
    : pageTitle.toLowerCase().includes(SITE_NAME.toLowerCase())
      ? pageTitle
      : `${pageTitle} | ${SITE_NAME}`;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />

      {/* Canonical URL */}
      {canonical && <link rel="canonical" href={canonical} />}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  );
};

export default SEO;
