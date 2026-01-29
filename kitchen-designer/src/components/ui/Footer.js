import React from 'react';
import { Link } from 'react-router-dom';
import '../css/footer.css';
import { useLanguage } from '../../contexts/LanguageContext';

const Footer = () => {
  const { t } = useLanguage();

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
          <Link to="/sms-consent-verification" className="footer-link">
            {t('footer.smsConsent')}
          </Link>
          <span className="footer-separator">|</span>
          <Link to="/sms-terms" className="footer-link">
            {t('footer.terms')}
          </Link>
          <span className="footer-separator">|</span>
          <Link to="/privacy" className="footer-link">
            {t('footer.privacy')}
          </Link>
          <span className="footer-separator">|</span>
          <Link to="/cabinet-Care" className="footer-link">
            {t('footer.cabinetCare')}
          </Link>
          <span className="footer-separator">|</span>
          <Link to="/hardware-catalog" className="footer-link">
            Hardware Catalog
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