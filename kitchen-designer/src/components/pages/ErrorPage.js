import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useLanguage } from '../../contexts/LanguageContext';
import Navigation from '../ui/Navigation';
import Footer from '../ui/Footer';
import '../css/error-page.css';

// Three shapes of failure, one page:
//   notFound - the URL does not match a route (catch-all)
//   noAccess - the route exists but this visitor may not open it
//   error    - something threw; rendered by ErrorBoundary
const VARIANTS = {
  notFound: { code: '404', key: 'notFound', showHome: true, showBack: true },
  noAccess: { code: '403', key: 'noAccess', showHome: true, showContact: true },
  error: { code: '', key: 'error', showHome: true, showReload: true },
};

export default function ErrorPage({ variant = 'notFound', detail = null }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const cfg = VARIANTS[variant] || VARIANTS.notFound;
  const k = cfg.key;

  return (
    <>
      <Helmet>
        <title>{`${t(`error.${k}.title`)} | Gudino Custom Woodworking`}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <Navigation />
      {/* Class names are prefixed because page CSS is global here: plain
          .error-message / .error-card are also defined by about.css and
          testimonial-form.css and would make this page unreadable */}
      <main className="error-page" id="main-content" tabIndex={-1}>
        <div className="error-page__card">
          {/* decorative: the heading already says what happened */}
          {cfg.code ? <div className="error-page__code" aria-hidden="true">{cfg.code}</div> : null}
          <h1 className="error-page__title">{t(`error.${k}.title`)}</h1>
          <p className="error-page__message">{t(`error.${k}.message`)}</p>

          {detail ? <p className="error-page__detail">{detail}</p> : null}

          <div className="error-page__actions">
            {cfg.showHome ? (
              <Link to="/" className="error-page__button error-page__button--primary">
                {t('error.action.home')}
              </Link>
            ) : null}
            {cfg.showBack ? (
              <button type="button" className="error-page__button" onClick={() => navigate(-1)}>
                {t('error.action.back')}
              </button>
            ) : null}
            {cfg.showReload ? (
              <button type="button" className="error-page__button" onClick={() => window.location.reload()}>
                {t('error.action.reload')}
              </button>
            ) : null}
            {cfg.showContact ? (
              <Link to="/contact" className="error-page__button">
                {t('error.action.contact')}
              </Link>
            ) : null}
          </div>

          <p className="error-page__help">
            {t('error.help')}{' '}
            <Link to="/contact">{t('error.helpLink')}</Link>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
