import { Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { Pause, Play } from 'lucide-react';
import Navigation from '../ui/Navigation';
import Footer from '../ui/Footer';
import SEO from '../ui/SEO';
import InstagramFeed from '../ui/InstagramFeed';
import KitchenBuildSection from '../ui/KitchenBuildSection';
import { useLanguage } from '../../contexts/LanguageContext';
import '../css/home.css';
import { useAnalytics } from '../../hooks/useAnalytics';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';

// Throttle utility for performance optimization
const throttle = (func, limit) => {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

const Home = () => {
  // Analytics tracking
  useAnalytics('/');

  // Language context
  const { t } = useLanguage();
  const prefersReducedMotion = usePrefersReducedMotion();

  const [isMobile, setIsMobile] = useState(false);
  const [isWorkTypesOpen, setIsWorkTypesOpen] = useState(false);
  const [visibleQuotes, setVisibleQuotes] = useState([]);
  const [videoLoaded, setVideoLoaded] = useState(false);
  // mirrors the hero video's own play/pause events (drives the toggle label)
  const [videoPaused, setVideoPaused] = useState(prefersReducedMotion);
  const videoRef = useRef(null);
  const visibleQuotesRef = useRef(visibleQuotes);

  const workTypes = [
    { title: t('home.workTypes.kitchen'), description: t('home.workTypes.kitchenDesc') },
    { title: t('home.workTypes.bathroom'), description: t('home.workTypes.bathroomDesc') },
    { title: t('home.workTypes.carpentry'), description: t('home.workTypes.carpentryDesc') },
    { title: t('home.workTypes.cabinets'), description: t('home.workTypes.cabinetsDesc') },
    { title: t('home.workTypes.remodeling'), description: t('home.workTypes.remodelingDesc') },
    { title: t('home.workTypes.commercial'), description: t('home.workTypes.commercialDesc') },
    { title: t('home.workTypes.insurance'), description: t('home.workTypes.insuranceDesc') }
  ];

  const toggleWorkTypes = () => {
    setIsWorkTypesOpen(!isWorkTypesOpen);
  };

  const toggleVideo = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play()?.catch(() => setVideoPaused(true));
    else video.pause();
  };

  // No autoplay under reduced motion (and stop it if the setting changes
  // mid-visit). Otherwise start it here too: a refused autoplay (iOS Low Power
  // Mode) rejects, so the toggle offers "play" instead of a dead "pause".
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (prefersReducedMotion) video.pause();
    else video.play()?.catch(() => setVideoPaused(true));
  }, [prefersReducedMotion]);

  // Keep ref in sync with state for use in throttled callback
  useEffect(() => {
    visibleQuotesRef.current = visibleQuotes;
  }, [visibleQuotes]);

  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    const handleScroll = () => {
      // Check which quotes are in view
      const quotes = document.querySelectorAll('.quote, .feature-content, .final-content');
      quotes.forEach((quote, index) => {
        const rect = quote.getBoundingClientRect();
        const isInView = rect.top < window.innerHeight * 0.8 && rect.bottom > 0;

        if (isInView && !visibleQuotesRef.current.includes(index)) {
          setVisibleQuotes(prev => [...prev, index]);
          quote.classList.add('animate-in');
        }
      });
    };

    // Throttle scroll handler to run at most every 100ms for better performance
    const throttledScroll = throttle(handleScroll, 100);

    checkIfMobile();
    handleScroll(); // Check on mount
    window.addEventListener('scroll', throttledScroll, { passive: true });
    window.addEventListener('resize', checkIfMobile);

    return () => {
      window.removeEventListener('scroll', throttledScroll);
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  // Parallax is measured from each section's own position, not the page's
  // scroll offset. The kitchen gaps make the page several screens tall, and an
  // offset of scrollY * rate slid the photos hundreds of pixels out of their
  // frames, opening strips where the kitchen canvas showed through. Written
  // straight to the DOM on each frame so scrolling does not re-render Home.
  useEffect(() => {
    let frame = 0;
    const apply = () => {
      frame = 0;
      const vh = window.innerHeight;
      const still = window.innerWidth <= 768 || prefersReducedMotion;
      document.querySelectorAll('[data-parallax]').forEach((el) => {
        if (still) {
          el.style.transform = 'none';
          return;
        }
        const host = el.parentElement.getBoundingClientRect();
        if (host.bottom < -vh || host.top > 2 * vh) return;
        const rate = parseFloat(el.dataset.parallax) || 0;
        // zero when the section is centred on screen; the images overhang
        // their frame by 10% top and bottom, so never shift past that
        const slack = host.height * 0.08;
        const shift = -(host.top + host.height / 2 - vh / 2) * rate;
        el.style.transform = `translateY(${Math.max(-slack, Math.min(slack, shift)).toFixed(1)}px)`;
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
    };
  }, [prefersReducedMotion]);

  return (
    <>
      <SEO
        title={t('seo.home.title')}
        description={t('seo.home.description')}
        keywords="carpenter, carpentry, kitchen remodeling, bathroom renovation, custom cabinets, cabinet maker, woodworking, Washington, Spokane"
        canonical="https://gudinocustom.com/"
      />
      <Navigation />

      <main id="main-content" className="home-main" tabIndex={-1}>
      {/* Hero Section with Video Background */}
      <div className="hero-section" style={{
        paddingBottom: isMobile ? '80px' : '250px',
        paddingTop: isMobile ? '80px' : '250px'
      }}>
        <div className="video-background">
          <video
            ref={videoRef}
            autoPlay={!prefersReducedMotion}
            muted
            loop
            playsInline
            aria-hidden="true"
            preload={isMobile ? "none" : "metadata"}
            poster="/home-page-images/hero-poster.jpg"
            onCanPlay={() => setVideoLoaded(true)}
            onPlay={() => setVideoPaused(false)}
            onPause={() => setVideoPaused(true)}
            onError={(e) => console.warn('Video failed to load:', e)}
            style={{ opacity: videoLoaded ? 1 : 0.7, transition: 'opacity 0.5s ease' }}
          >
            {/* Mobile-optimized video sources (smaller file size) */}
            {isMobile ? (
              <>
                <source src="/videos/woodworking-hero-mobile.webm" type="video/webm" />
                <source src="/videos/woodworking-hero-mobile.mp4" type="video/mp4" />
              </>
            ) : (
              <>
                <source src="/videos/woodworking-hero.webm" type="video/webm" />
                <source src="/videos/woodworking-hero.mp4" type="video/mp4" />
              </>
            )}
          </video>
        </div>
        {/* scrim: keeps the hero text readable whatever the video frame shows */}
        <div className="video-overlay" aria-hidden="true" />

        <button type="button" className="home-video-toggle" onClick={toggleVideo}>
          {videoPaused ? <Play size={16} /> : <Pause size={16} />}
          {videoPaused ? t('home.video.play') : t('home.video.pause')}
        </button>

        <div className="hero-content">
          <div className="hero-text">
            <h1 className="company-name">{t('home.companyName')}</h1>
            <p className="company-tagline">{t('home.tagline')}</p>
            <p className="hero-description">{t('home.heroDescription')}</p>
          </div>
        </div>

        <div className="curved-bottom"></div>

        {/* a mouse shortcut only: keyboard users scroll natively */}
        <div className="scroll-indicator" aria-hidden="true" onClick={() => {
          const targetPosition = window.innerHeight;
          if (prefersReducedMotion) {
            window.scrollTo(0, targetPosition);
            return;
          }
          const startPosition = window.pageYOffset;
          const distance = targetPosition - startPosition;
          const duration = 1500; // 1.5 seconds
          let start = null;

          const step = (timestamp) => {
            if (!start) start = timestamp;
            const progress = timestamp - start;
            const progressPercentage = Math.min(progress / duration, 1);

            // Easing function for smooth acceleration and deceleration
            const easeInOutCubic = progressPercentage < 0.5
              ? 4 * progressPercentage * progressPercentage * progressPercentage
              : 1 - Math.pow(-2 * progressPercentage + 2, 3) / 2;

            window.scrollTo(0, startPosition + distance * easeInOutCubic);

            if (progress < duration) {
              requestAnimationFrame(step);
            }
          };

          requestAnimationFrame(step);
        }}>
          <div className="scroll-arrow"></div>
        </div>
      </div>

      <KitchenBuildSection>

      <div className="home-container">

        {/* Content Sections with Parallax Effects. The kitchen canvas shows
            only through the .kitchen-gap spacers; everything between them sits
            in a solid .home-block so no seam can let it through. */}
        <div className="kitchen-gap" aria-hidden="true" />
        <div className="home-block">
        <section className="content-section">
          <div className="section-content" data-parallax="0.01">
            <div className="quote">
              {t('home.quote1')}
            </div>
          </div>
        </section>
        </div>

        <div className="kitchen-gap" aria-hidden="true" />

        <div className="home-block">
        <section className="image-section parallax-section">
          <div className="parallax-image zoomed-out" data-parallax="0.03">
            <picture>
              <source
                type="image/webp"
                srcSet="/home-page-images/kitchen-island-600.webp 600w, /home-page-images/kitchen-island-1200.webp 1200w, /home-page-images/kitchen-island.webp 1920w"
                sizes="100vw"
              />
              <img src="/home-page-images/kitchen-island.jpeg" alt="" loading="lazy" decoding="async" width="1920" height="1280" />
            </picture>
          </div>
        </section>

        <section className="content-section">
          <div className="section-content">
            <div className="quote">
              {t('home.quote2')}
            </div>
          </div>
        </section>
        </div>

        {/* the island's stage is longer: it also holds the finished room */}
        <div className="kitchen-gap kitchen-gap--finale" aria-hidden="true" />

        <div className="home-block">
        <section className="feature-section">
          <div className="feature-content">
            <div className="feature-header">
              <h2>{t('home.unlimitedScope')}</h2>
            </div>
            <div className="feature-description">
              {t('home.scopeDescription')}
            </div>
            <div className="feature-button">
              <Link to="/contact" className="cta-button">{t('home.contactUs')}</Link>
            </div>
          </div>
        </section>


        <section className="image-section parallax-section">
          <div className="parallax-image zoomed-out" data-parallax="0.015">
            <picture>
              <source
                type="image/webp"
                srcSet="/home-page-images/kitchen-600.webp 600w, /home-page-images/kitchen-1200.webp 1200w, /home-page-images/kitchen.webp 1920w"
                sizes="100vw"
              />
              <img src="/home-page-images/kitchen.jpg" alt="" loading="lazy" decoding="async" width="1920" height="1280" />
            </picture>
          </div>
        </section>

        <section className="feature-section">
          <div className="feature-content">
            <div className="feature-header">
              <h2>{t('home.ourCreations')}</h2>
            </div>
            <div className="feature-description">
              {t('home.creationsDescription')}
            </div>

            <div className="work-types-dropdown">
              <button
                type="button"
                className="dropdown-toggle"
                onClick={toggleWorkTypes}
                aria-expanded={isWorkTypesOpen}
                aria-controls="home-work-types"
              >
                <span>{t('home.seeWhatWeDo')}</span>
                <svg
                  className={`dropdown-arrow ${isWorkTypesOpen ? 'open' : ''}`}
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
                </svg>
              </button>

              {/* collapsed = visibility:hidden in home.css, so it is out of the
                  accessibility tree as well as out of sight */}
              <div id="home-work-types" className={`dropdown-content ${isWorkTypesOpen ? 'open' : ''}`}>
                <div className="work-types-grid">
                  {workTypes.map((workType, index) => (
                    <div key={index} className="work-type-item">
                      <h3>{workType.title}</h3>
                      <p>{workType.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="feature-button">
              <Link to="/portfolio" className="cta-button">{t('home.viewPortfolio')}</Link>
            </div>
          </div>
        </section>

        <section className="image-section parallax-section">
          <div className="parallax-image" data-parallax="0.01">
            <picture>
              <source
                type="image/webp"
                srcSet="/home-page-images/blueprint-600.webp 600w, /home-page-images/blueprint-1200.webp 1200w, /home-page-images/blueprint.webp 1920w"
                sizes="100vw"
              />
              <img src="/home-page-images/blueprint.jpg" alt="" loading="lazy" decoding="async" width="1920" height="1280" />
            </picture>
          </div>
        </section>

        <section className="feature-section">
          <div className="feature-content">
            <div className="feature-header">
              <h2>{t('home.makeItYourself')}</h2>
            </div>
            <div className="feature-description">
              {t('home.designDescription')}
            </div>
            <div className="feature-button">
              <Link to="/design" className="cta-button">{t('home.useDesigner')}</Link>
            </div>
          </div>
        </section>


        <section className="final-section">
          <div className="final-content">
            <div className="feature-header">
              <h2>{t('home.knowMore')}</h2>
            </div>
            <div className="feature-description">
              {t('home.knowMoreDescription')}
            </div>
            <div className="feature-button">
              <Link to="/about" className="cta-button">{t('home.aboutUs')}</Link>
            </div>
          </div>
        </section>
        </div>
      </div>
      </KitchenBuildSection>
      </main>
      <Footer />
    </>
  );
};

export default Home;