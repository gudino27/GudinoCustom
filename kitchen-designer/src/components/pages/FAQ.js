import { Link } from 'react-router-dom';
import '../css/sms-compliance.css';
import Navigation from '../ui/Navigation';
import Footer from '../ui/Footer';
import SEO from '../ui/SEO';
import { useLanguage } from '../../contexts/LanguageContext';
import { faqEntries } from '../../seo/site';

// Frequently asked questions. Each answer sits in plain text right under its
// question heading, so search features and AI assistants can quote it; the
// same questions and answers are emitted as FAQPage JSON-LD by SEO.js and
// prerendered by scripts/prerender.js. Answers only restate facts published
// elsewhere on the site (see the translations block).
const linkStyle = { color: '#ffffff', textDecoration: 'underline' };

const FAQ = () => {
  const { t, localizedPath: lp } = useLanguage();
  const entries = faqEntries(t);

  return (
    <>
      <SEO title={t('seo.faq.title')} description={t('seo.faq.description')} />
      <div style={{ background: 'rgb(110,110,110)' }}>
        <Navigation />
        <div style={{ height: '1vh' }}></div>
        <main id="main-content" tabIndex={-1} className="sms-compliance-container">
          <div className="sms-content">
            <h1 className="sms-header">{t('faq.heading')}</h1>
            <p>
              <em>{t('faq.intro')}</em>
            </p>

            {entries.map((entry) => (
              <section key={entry.id} aria-labelledby={`faq-${entry.id}`}>
                <h2 id={`faq-${entry.id}`} className="sms-section-header">{entry.question}</h2>
                <p>{entry.answer}</p>
              </section>
            ))}

            <div className="sms-highlight-box">
              <h2 className="sms-section-header" style={{ marginTop: 0 }}>{t('faq.moreTitle')}</h2>
              <p>{t('faq.moreText')}</p>
              <ul className="sms-list">
                <li><Link to={lp('/contact')} style={linkStyle}>{t('nav.contact')}</Link></li>
                <li><Link to={lp('/book-appointment')} style={linkStyle}>{t('nav.bookAppointment')}</Link></li>
                <li><Link to={lp('/quick-quote')} style={linkStyle}>{t('quickQuote.pageTitle')}</Link></li>
                <li><Link to={lp('/cabinet-care')} style={linkStyle}>{t('footer.cabinetCare')}</Link></li>
              </ul>
            </div>
          </div>
        </main>
        <div style={{ height: '3vh' }}></div>
      </div>
      <Footer />
    </>
  );
};

export default FAQ;
