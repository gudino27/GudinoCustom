import React from 'react';
import { Link } from 'react-router-dom';
import '../css/footer.css';
import { useLanguage } from '../../contexts/LanguageContext';

const Footer = () => {
  const { t, localizedPath: lp } = useLanguage();

  return (
    <footer className="footer-glass">
      <div className="footer-container">
        <div className="footer-section">
          <div className="footer-text">
            {t('footer.smsMessage')}
          </div>
          <div className="footer-text">
            {t('footer.optOut')}
          </div>
        </div>
        
        <div className="footer-section">
          <Link to={lp("/sms-consent-verification")} className="footer-link">
            {t('footer.smsConsent')}
          </Link>
          <span className="footer-separator" aria-hidden="true">|</span>
          <Link to={lp("/sms-terms")} className="footer-link">
            {t('footer.terms')}
          </Link>
          <span className="footer-separator" aria-hidden="true">|</span>
          <Link to={lp("/privacy")} className="footer-link">
            {t('footer.privacy')}
          </Link>
          <span className="footer-separator" aria-hidden="true">|</span>
          <Link to={lp("/cabinet-care")} className="footer-link">
            {t('footer.cabinetCare')}
          </Link>
          <span className="footer-separator" aria-hidden="true">|</span>
          <Link to={lp("/hardware-catalog")} className="footer-link">
            {t('footer.hardwareCatalog')}
          </Link>
          <span className="footer-separator" aria-hidden="true">|</span>
          <Link to={lp("/faq")} className="footer-link">
            {t('nav.faq')}
          </Link>
        </div>
        
        
        <div className="footer-copyright">
          {t('footer.copyright', { year: new Date().getFullYear() })}
        </div>
      </div>
    </footer>
  );
};

export default Footer;