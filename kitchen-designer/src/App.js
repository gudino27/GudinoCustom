import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import './App.css';
import { LanguageProvider } from './contexts/LanguageContext';
import { PricingProvider } from './contexts/PricingContext';

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
            <Suspense fallback={
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100vh',
              backgroundColor: '#1f2937',
              color: 'white',
              fontSize: '24px'
            }}>
              Loading...
            </div>
          }>
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
            </Routes>
          </Suspense>
        </Router>
      </PricingProvider>
    </LanguageProvider>
    </HelmetProvider>
  );
}

// Export the main App component as default
export default App;
