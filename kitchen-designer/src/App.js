import { lazy, Suspense, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import './App.css';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { PricingProvider } from './contexts/PricingContext';
import ErrorBoundary from './components/ui/ErrorBoundary';
import LiveRegion from './components/ui/LiveRegion';

// Lazy load all route components for better performance
const Home = lazy(() => import('./components/pages/Home'));
const Portfolio = lazy(() => import('./components/pages/portfolio'));
const KitchenDesigner = lazy(() => import('./components/pages/desinger'));
const About = lazy(() => import('./components/pages/About'));
const Contact = lazy(() => import('./components/pages/Contact'));
const AdminPanel = lazy(() => import('./components/admin/AdminPanel'));
const PasswordReset = lazy(() => import('./components/admin/PasswordReset'));
const Registration = lazy(() => import('./components/auth/Registration'));
const TestimonialForm = lazy(() => import('./components/forms/TestimonialForm'));
const QuickContactForm = lazy(() => import('./components/forms/QuickContactForm'));
const InvoiceViewer = lazy(() => import('./components/invoice/InvoiceViewer'));
const ReceiptViewer = lazy(() => import('./components/invoice/ReceiptViewer'));
const ProjectTimeline = lazy(() => import('./components/project/ProjectTimeline'));
const SmsCompliance = lazy(() => import('./components/SmsCompliance'));
const PrivacySettings = lazy(() => import('./components/PrivacySettings'));
const CabinetCare = lazy(() => import('./components/pages/CabinetCare'));
const HardwareCatalog = lazy(() => import('./components/pages/HardwareCatalog'));
const WhyChooseUs = lazy(() => import('./components/pages/WhyChooseUs'));
const AppointmentBooking = lazy(() => import('./components/pages/AppointmentBooking'));
const AppointmentCancel = lazy(() => import('./components/pages/AppointmentCancel'));
const VirtualShowroom = lazy(() => import('./components/showroom/VirtualShowroom'));
const InstagramEmbed = lazy(() => import('./components/pages/InstagramEmbed'));
const ErrorPage = lazy(() => import('./components/pages/ErrorPage'));

// Each page renders its own <Navigation>, so after a route change the clicked
// link is unmounted and focus falls back to <body>. Send it to the new page's
// <main> instead, and reset the scroll position (WCAG 2.4.3).
function RouteChangeFocus() {
  const { pathname } = useLocation();
  const lastPathname = useRef(pathname);

  useEffect(() => {
    if (lastPathname.current === pathname) return undefined; // initial render
    lastPathname.current = pathname;
    window.scrollTo(0, 0);

    const focusMain = () => {
      const main = document.getElementById('main-content');
      if (!main) return false;
      const active = document.activeElement;
      // the visitor already moved focus somewhere: leave it alone
      if (active && active !== document.body && active !== main) return true;
      if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
      main.focus({ preventScroll: true });
      return true;
    };

    if (focusMain()) return undefined;

    // The page is still loading its content; wait briefly for <main> to appear.
    const observer = new MutationObserver(() => {
      if (focusMain()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = setTimeout(() => observer.disconnect(), 3000);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [pathname]);

  return null;
}

// ErrorBoundary keeps hasError once set, so after one render error every route
// showed the error page until a reload. Re-keying it per pathname remounts a
// fresh boundary when the visitor navigates away.
function RouteErrorBoundary({ children }) {
  const { pathname } = useLocation();
  return <ErrorBoundary key={pathname}>{children}</ErrorBoundary>;
}

// Inside LanguageProvider, so the fallback text follows the site language
function PageLoading() {
  const { t } = useLanguage();

  return (
    <div
      role="status"
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#1f2937',
        color: 'white',
        fontSize: '24px'
      }}
    >
      {t('a11y.loading')}
    </div>
  );
}
// -----------------------------
// Top-Level App Component
// Main application component that handles routing between different sections
// Uses React Router to navigate between design tool, admin panel, and photo gallery
// -----------------------------
function App() {
  return (
    <HelmetProvider>
      <LanguageProvider>
        <PricingProvider>
          <Router>
            <RouteChangeFocus />
            <RouteErrorBoundary>
          <Suspense fallback={<PageLoading />}>
            <Routes>

              {/* React components */}
              <Route path="/" element={<Home />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/design" element={<KitchenDesigner />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/admin" element={<AdminPanel />} />
              <Route path="/reset-password" element={<PasswordReset />} />
              <Route path="/register/:token" element={<Registration />} />
              <Route path="/testimonial/:token" element={<TestimonialForm />} />
              <Route path="/quick-quote" element={<QuickContactForm />} />
              <Route path="/invoice/:token/payment/:paymentId" element={<ReceiptViewer />} />
              <Route path="/invoice/:token" element={<InvoiceViewer />} />
              <Route path="/project/:token" element={<ProjectTimeline />} />
              <Route path="/sms-consent-verification" element={<SmsCompliance defaultTab="consent" />} />
              <Route path="/sms-terms" element={<SmsCompliance defaultTab="terms" />} />
              <Route path="/sms-privacy" element={<SmsCompliance defaultTab="privacy" />} />
              <Route path="/privacy" element={<SmsCompliance defaultTab="website" />} />
              <Route path="/opt-out" element={<PrivacySettings />} />
              <Route path="/privacy-settings" element={<PrivacySettings />} />
              <Route path="/cabinet-care" element={<CabinetCare />} />
              <Route path="/hardware-catalog" element={<HardwareCatalog />} />
              <Route path="/why-choose-us" element={<WhyChooseUs />} />
              <Route path="/book-appointment" element={<AppointmentBooking />} />
              <Route path="/appointment/cancel/:token" element={<AppointmentCancel />} />
              <Route path="/showroom" element={<VirtualShowroom />} />
              <Route path="/instagram-embed" element={<InstagramEmbed />} />

              {/* Restricted area, reachable directly or by redirect */}
              <Route path="/no-access" element={<ErrorPage variant="noAccess" />} />
              {/* Catch-all: nginx already falls back to index.html, so an
                  unknown path lands here rather than on a CDN 404 page */}
              <Route path="*" element={<ErrorPage variant="notFound" />} />
            </Routes>
          </Suspense>
          </RouteErrorBoundary>
          {/* outside the boundary, so announcements survive a render error */}
          <LiveRegion />
        </Router>
      </PricingProvider>
    </LanguageProvider>
    </HelmetProvider>
  );
}

// Export the main App component as default
export default App;
