import React, { useState, useEffect } from 'react';
import Navigation from '../ui/Navigation';
import Footer from '../ui/Footer';
import SEO from '../ui/SEO';
import { announce } from '../ui/LiveRegion';
import { useLanguage } from '../../contexts/LanguageContext';
import '../css/contact.css';
import { useAnalytics } from '../../hooks/useAnalytics';

const Contact = () => {
  // Analytics tracking
  useAnalytics('/contact');

  // Language context
  const { t } = useLanguage();

  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  const [isContentLoaded, setIsContentLoaded] = useState(false);

  useEffect(() => {
    // Simulate map loading
    const timer = setTimeout(() => setIsMapLoaded(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  const contactInfo = {
    phone: {
      english: "(509) 515-4090",
      englishTel: "+15095154090",
      spanish: "(509) 831-9816",
      spanishTel: "+15098319816"
    },
    email: "Info@gudinocustom.com",
    address: "70 Ray Rd, Sunnyside, WA 98944",
    hours: {
      weekdays: t('contact.hours.weekdays'),
      saturday: t('contact.hours.saturday'),
      sunday: t('contact.hours.sunday')
    }
  };

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(contactInfo.address)}`;

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    // the toast is only visual, so screen readers get it through the live region
    announce(message);
    setTimeout(() => {
      setToast({ show: false, message: '', type: '' });
    }, 3000);
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast(t('contact.copied', { item: label }));
    }).catch((err) => {
      console.error('Failed to copy:', err);
      showToast(t('contact.copyFailed'), 'error');
    });
  };

  const handleGetDirections = () => {
    const address = encodeURIComponent(contactInfo.address);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);

    let mapsUrl;

    if (isIOS) {
      // Use Apple Maps on iOS devices
      mapsUrl = `maps://maps.apple.com/?address=${address}`;
    } else if (isAndroid) {
      // Use Google Maps on Android devices
      mapsUrl = `google.navigation:q=${address}`;
    } else {
      // Use Google Maps in browser for desktop
      mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${address}`;
    }

    window.open(mapsUrl, '_blank');
    showToast(t('contact.openingMaps'));
  };

  return (
    <>
      <SEO
        title={t('seo.contact.title')}
        description="Contact Gudino Custom for a free consultation and quote on your kitchen remodeling, bathroom renovation, or custom cabinet project in Washington. Call or email us today."
        keywords="contact carpenter, free quote, consultation, kitchen remodel estimate, cabinet installation quote, Washington contractor"
        canonical="https://gudinocustom.com/contact"
      />
      <Navigation />

      <main id="main-content" tabIndex={-1} className="contact-container">
        {/* Language Selector */}
        <div className="contact-hero">
          <div className="contact-hero-content">
            <h1 className="hero-title">{t('contact.heroTitle')}</h1>
            <p className="hero-subtitle">
              {t('contact.heroSubtitle')}
            </p>
          </div>
        </div>
        <div className="contact-content">
          <div className="contact-grid">

            {/* Contact Information Cards */}
            <div className="contact-cards">

              {/* Phone Card */}
              <div
                className={`contact-card phone-card ${hoveredCard === 'phone' ? 'hovered' : ''}`}
                onMouseEnter={() => setHoveredCard('phone')}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div className="card-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                  </svg>
                </div>
                <div className="card-content">
                  <h2>{t('contact.callUs')}</h2>
                  <div className="phone-options">
                    <div className="phone-option">
                      <span className="language-label">{t('contact.languageLabel.english')}</span>
                      <div className="contact-detail-row">
                        <p className="contact-detail">{contactInfo.phone.english}</p>
                        <button
                          type="button"
                          className="copy-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(contactInfo.phone.english, t('contact.phoneNumber'));
                          }}
                          aria-label={t('contact.copyPhoneEnglish')}
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true" focusable="false">
                            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                          </svg>
                        </button>
                      </div>
                      <a
                        className="card-action"
                        href={`tel:${contactInfo.phone.englishTel}`}
                        onClick={() => showToast(t('contact.openingDialer'))}
                      >
                        {t('contact.clickToCall')}
                      </a>
                    </div>
                    <div className="phone-option">
                      <span className="language-label">{t('contact.languageLabel.spanish')}</span>
                      <div className="contact-detail-row">
                        <p className="contact-detail">{contactInfo.phone.spanish}</p>
                        <button
                          type="button"
                          className="copy-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(contactInfo.phone.spanish, t('contact.phoneNumber'));
                          }}
                          aria-label={t('contact.copyPhoneSpanish')}
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true" focusable="false">
                            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                          </svg>
                        </button>
                      </div>
                      <a
                        className="card-action"
                        href={`tel:${contactInfo.phone.spanishTel}`}
                        onClick={() => showToast(t('contact.openingDialer'))}
                      >
                        {t('contact.clickToCall')}
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Email Card */}
              <div
                className={`contact-card email-card ${hoveredCard === 'email' ? 'hovered' : ''}`}
                onMouseEnter={() => setHoveredCard('email')}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div className="card-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                  </svg>
                </div>
                <div className="card-content">
                  <h2>{t('contact.emailUs')}</h2>
                  <div className="contact-detail-row">
                    <p className="contact-detail">{contactInfo.email}</p>
                    <button
                      type="button"
                      className="copy-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(contactInfo.email, t('contact.emailAddress'));
                      }}
                      aria-label={t('contact.copyEmail')}
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true" focusable="false">
                        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                      </svg>
                    </button>
                  </div>
                  <a
                    className="card-action"
                    href={`mailto:${contactInfo.email}`}
                    onClick={() => showToast(t('contact.openingEmail'))}
                  >
                    {t('contact.clickToEmail')}
                  </a>
                </div>
              </div>

              {/* Location Card */}
              <div
                className={`contact-card location-card ${hoveredCard === 'location' ? 'hovered' : ''}`}
                onMouseEnter={() => setHoveredCard('location')}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div className="card-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                  </svg>
                </div>
                <div className="card-content">
                  <h2>{t('contact.visitUs')}</h2>
                  <p className="contact-detail">{contactInfo.address}</p>
                  <a
                    className="card-action"
                    href={directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('contact.getDirections')}
                    <span className="sr-only"> {t('a11y.opensInNewTab')}</span>
                  </a>
                </div>
              </div>

              {/* Hours Card */}
              <div
                className={`contact-card hours-card ${hoveredCard === 'hours' ? 'hovered' : ''}`}
                onMouseEnter={() => setHoveredCard('hours')}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div className="card-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
                    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" />
                    <path d="M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                  </svg>
                </div>
                <div className="card-content">
                  <h2>{t('contact.businessHours')}</h2>
                  <div className="hours-list">
                    <p>{contactInfo.hours.weekdays}</p>
                    <p>{contactInfo.hours.saturday}</p>
                    <p>{contactInfo.hours.sunday}</p>
                  </div>
                </div>
              </div>

            </div>

            {/* Map Section */}
            <div className="map-section">
              <div className="map-header">
                <h2>{t('contact.mapTitle')}</h2>
                <p>{t('contact.mapSubtitle')}</p>
              </div>

              <div className="map-container">
                {!isMapLoaded ? (
                  <div className="map-loading">
                    <div className="map-loading-spinner"></div>
                    <p>{t('contact.loadingMap')}</p>
                  </div>
                ) : (
                  <>
                    <div className="interactive-map">
                      <iframe
                        src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2756.6001221157585!2d-119.9602535231462!3d46.297917871099834!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x549822f175b48609%3A0x30cb35096d65324b!2s70%20Ray%20Rd%2C%20Sunnyside%2C%20WA%2098944!5e0!3m2!1sen!2sus!4v1753657799291!5m2!1sen!2sus"
                        width="100%"
                        height="400"
                        style={{ border: 0, borderRadius: '15px' }}
                        allowFullScreen=""
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        title={t('contact.mapFrameTitle')}
                      ></iframe>
                    </div>
                    <button type="button" className="directions-button" onClick={handleGetDirections}>
                      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true" focusable="false">
                        <path d="M21.71 11.29l-9-9c-.39-.39-1.02-.39-1.41 0l-9 9c-.39.39-.39 1.02 0 1.41l9 9c.39.39 1.02.39 1.41 0l9-9c.39-.38.39-1.01 0-1.41zM14 14.5V12h-4v3H8v-4c0-.55.45-1 1-1h5V7.5l3.5 3.5-3.5 3.5z"/>
                      </svg>
                      <span>{t('contact.getDirectionsButton')}</span>
                      <span className="sr-only">{t('a11y.opensInNewTab')}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

          </div>



        </div>

        {/* Toast Notification */}
        {toast.show && (
          <div className={`toast-notification ${toast.type}`}>
            <div className="toast-content">
              <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24" aria-hidden="true" focusable="false">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
              </svg>
              <span>{toast.message}</span>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
};

export default Contact;
