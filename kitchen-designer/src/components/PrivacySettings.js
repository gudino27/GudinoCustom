import React, { useState, useEffect } from 'react';
import Footer from './ui/Footer';
import SEO from './ui/SEO';
import { announce } from './ui/LiveRegion';
import './css/sms-compliance.css';
import { useLanguage } from '../contexts/LanguageContext';

const PrivacySettings = () => {
  const { t } = useLanguage();
  const [isOptedOut, setIsOptedOut] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Check current opt-out status on mount
  useEffect(() => {
    const optOut = localStorage.getItem('analytics_opt_out');
    setIsOptedOut(optOut === 'true');
  }, []);

  const savePreference = () => {
    setShowSuccess(true);
    // the box below is only visual, so say it out loud too (WCAG 4.1.3)
    announce(t('privacySettings.preferenceSaved'));
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleOptOut = () => {
    localStorage.setItem('analytics_opt_out', 'true');
    setIsOptedOut(true);
    savePreference();
  };

  const handleOptIn = () => {
    localStorage.removeItem('analytics_opt_out');
    setIsOptedOut(false);
    savePreference();
  };

  return (
    <>
      <SEO
        title={t('privacySettings.title')}
        description={t('privacySettings.optOutDescription')}
        keywords="privacy settings, analytics opt out, do not track, data deletion, Gudino Custom Woodworking"
        canonical="https://gudinocustom.com/privacy-settings"
      />
      <main id="main-content" tabIndex={-1} className="sms-compliance-container" style={{ minHeight: '100vh', paddingTop: '80px' }}>
        <div className="sms-content">
          <h1 className="sms-header">{t('privacySettings.title')}</h1>

          <h2 className="sms-section-header">{t('privacySettings.currentStatus')}</h2>
          <div className={`sms-highlight-box ${isOptedOut ? 'opt-out-active' : 'opt-in-active'}`}>
            <strong>{t('privacySettings.analyticsTracking')}:</strong> {isOptedOut ? t('privacySettings.disabled') : t('privacySettings.enabled')}
          </div>

          {showSuccess && (
            <div className="sms-highlight-box" style={{ backgroundColor: '#d4edda', borderColor: '#c3e6cb', color: '#155724', marginTop: '20px' }}>
              {t('privacySettings.preferenceSaved')}
            </div>
          )}

          <h2 className="sms-section-header">{t('privacySettings.whatWeTrack')}</h2>
          <p>{t('privacySettings.trackingIntro')}</p>
          <ul className="sms-list">
            <li>{t('privacySettings.trackingPages')}</li>
            <li>{t('privacySettings.trackingTime')}</li>
            <li>{t('privacySettings.trackingLocation')}</li>
            <li>{t('privacySettings.trackingDevice')}</li>
          </ul>

          <h2 className="sms-section-header">{t('privacySettings.yourOptions')}</h2>

          <div style={{ display: 'flex', gap: '20px', marginTop: '20px', flexWrap: 'wrap' }}>
            <button
              onClick={handleOptOut}
              disabled={isOptedOut}
              style={{
                padding: '15px 30px',
                backgroundColor: isOptedOut ? '#6c757d' : '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                fontSize: '16px',
                cursor: isOptedOut ? 'not-allowed' : 'pointer',
                opacity: isOptedOut ? 0.6 : 1,
              }}
            >
              {isOptedOut ? t('privacySettings.alreadyOptedOut') : t('privacySettings.optOutButton')}
            </button>

            <button
              onClick={handleOptIn}
              disabled={!isOptedOut}
              style={{
                padding: '15px 30px',
                backgroundColor: !isOptedOut ? '#6c757d' : '#1e7e34',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                fontSize: '16px',
                cursor: !isOptedOut ? 'not-allowed' : 'pointer',
                opacity: !isOptedOut ? 0.6 : 1,
              }}
            >
              {!isOptedOut ? t('privacySettings.alreadyOptedIn') : t('privacySettings.optInButton')}
            </button>
          </div>

          <h2 className="sms-section-header" style={{ marginTop: '40px' }}>{t('privacySettings.howOptOut')}</h2>
          <p>
            {t('privacySettings.optOutDescription')}
          </p>
          <p>
            <strong>{t('privacySettings.optOutImportant')}</strong>
          </p>

          <h2 className="sms-section-header">{t('privacySettings.dntTitle')}</h2>
          <p>
            {t('privacySettings.dntDescription')}
          </p>
          <p>
            {t('privacySettings.dntStatus')} <strong>{navigator.doNotTrack === '1' ? t('privacySettings.dntEnabled') : t('privacySettings.dntNotEnabled')}</strong>
          </p>

          <h2 className="sms-section-header">{t('privacySettings.deletionTitle')}</h2>
          <p>
            {t('privacySettings.deletionDescription')}
          </p>
          <ul className="sms-list">
            <li><strong>{t('privacySettings.deletionEmail')}</strong></li>
            <li><strong>{t('privacySettings.deletionPhone')}</strong></li>
            <li><strong>{t('privacySettings.deletionResponseTime')}</strong></li>
          </ul>

          <h2 className="sms-section-header">{t('privacySettings.dataRetentionTitle')}</h2>
          <p>{t('privacySettings.dataRetentionDescription')}</p>

          <h2 className="sms-section-header">{t('privacySettings.otherOptionsTitle')}</h2>
          <p>
            <a href="/privacy" style={{ color: '#bfdbfe', textDecoration: 'underline' }}>
              {t('privacySettings.viewPrivacyPolicy')}
            </a>
          </p>
          <p>
            <a href="/contact" style={{ color: '#bfdbfe', textDecoration: 'underline' }}>
              {t('privacySettings.contactPrivacy')}
            </a>
          </p>

          <div style={{ marginTop: '40px', padding: '20px', backgroundColor: '#5f6061', borderRadius: '5px' }}>
            <strong>{t('privacySettings.note')}</strong>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default PrivacySettings;
