import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, CheckCircle } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import Navigation from '../ui/Navigation';
import Footer from '../ui/Footer';
import SEO from '../ui/SEO';
import { announce } from '../ui/LiveRegion';
import '../css/testimonial-form.css';

// Accepts anything that looks like name@domain.tld; the server validates properly.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const QuickContactForm = ({ onBack }) => {
  const navigate = useNavigate();
  const { currentLanguage, t } = useLanguage();

  const [formData, setFormData] = useState({
    client_name: '',
    client_email: '',
    client_phone: '',
    project_type: '',
    room_dimensions: '',
    budget_range: '',
    preferred_materials: '',
    preferred_colors: '',
    message: '',
  });

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  // field name -> translation key of the message (kept as keys so the list
  // follows a language switch)
  const [fieldErrors, setFieldErrors] = useState({});

  const successHeadingRef = useRef(null);
  const errorSummaryRef = useRef(null);
  const fileInputRef = useRef(null);

  const API_BASE = process.env.REACT_APP_API_URL || 'https://api.gudinocustom.com';

  const errorKeys = Object.keys(fieldErrors);
  const hasSummary = errorKeys.length > 0 || Boolean(error);

  const successMessage = t('quickQuote.successText');

  // The confirmation replaces the form, so move focus to its heading (WCAG 2.4.3)
  useEffect(() => {
    if (submitted) {
      successHeadingRef.current?.focus({ preventScroll: true });
    }
  }, [submitted]);

  // Send focus to the error summary whenever a submit attempt fails
  useEffect(() => {
    if (Object.keys(fieldErrors).length > 0) {
      errorSummaryRef.current?.focus();
    }
  }, [fieldErrors]);

  const focusField = (event, id) => {
    event.preventDefault();
    document.getElementById(id)?.focus();
  };

  // Budget range options
  const budgetRanges = {
    en: [
      { value: '', label: 'Select a range...' },
      { value: 'under_5k', label: 'Under $5,000' },
      { value: '5k_10k', label: '$5,000 - $10,000' },
      { value: '10k_25k', label: '$10,000 - $25,000' },
      { value: '25k_50k', label: '$25,000 - $50,000' },
      { value: 'over_50k', label: 'Over $50,000' },
      { value: 'not_sure', label: 'Not sure yet' },
    ],
    es: [
      { value: '', label: 'Seleccione un rango...' },
      { value: 'under_5k', label: 'Menos de $5,000' },
      { value: '5k_10k', label: '$5,000 - $10,000' },
      { value: '10k_25k', label: '$10,000 - $25,000' },
      { value: '25k_50k', label: '$25,000 - $50,000' },
      { value: 'over_50k', label: 'Más de $50,000' },
      { value: 'not_sure', label: 'No estoy seguro todavía' },
    ],
  };

  // Project type options
  const projectTypes = {
    en: [
      { value: '', label: 'Select project type...' },
      { value: 'new-construction', label: 'New Construction' },
      { value: 'remodel', label: 'Remodel' },
      { value: 'addition', label: 'Addition' },
    ],
    es: [
      { value: '', label: 'Seleccione tipo de proyecto...' },
      { value: 'new-construction', label: 'Nueva Construcción' },
      { value: 'remodel', label: 'Remodelación' },
      { value: 'addition', label: 'Adición' },
    ],
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const maxFiles = 5;
    const maxFileSize = 10 * 1024 * 1024; // 10MB

    if (selectedFiles.length + files.length > maxFiles) {
      setError(t('forms.error.maxPhotos', { max: maxFiles }));
      return;
    }

    const validFiles = files.filter((file) => {
      if (!file.type.startsWith('image/')) {
        setError(t('forms.error.imagesOnly'));
        return false;
      }
      if (file.size > maxFileSize) {
        setError(t('forms.error.fileTooBig'));
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setSelectedFiles((prev) => [...prev, ...validFiles]);

    // Create preview URLs
    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrls((prev) => [...prev, e.target.result]);
      };
      reader.readAsDataURL(file);
    });

    setError('');
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
    // the button that was pressed is gone, so put focus somewhere sensible
    setTimeout(() => fileInputRef.current?.focus(), 0);
  };

  const validate = () => {
    const errors = {};
    if (!formData.client_name.trim()) {
      errors.client_name = 'forms.error.nameRequired';
    }
    if (!formData.client_email.trim()) {
      errors.client_email = 'forms.error.emailRequired';
    } else if (!EMAIL_PATTERN.test(formData.client_email.trim())) {
      errors.client_email = 'forms.error.emailInvalid';
    }
    if (!formData.client_phone.trim()) {
      errors.client_phone = 'forms.error.phoneRequired';
    }
    if (!formData.project_type) {
      errors.project_type = 'forms.error.projectTypeRequired';
    }
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate required fields; messages are shown per field plus in a summary
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setLoading(true);

    try {
      const formDataWithFiles = new FormData();
      formDataWithFiles.append('client_name', formData.client_name);
      formDataWithFiles.append('client_email', formData.client_email);
      formDataWithFiles.append('client_phone', formData.client_phone);
      formDataWithFiles.append('client_language', currentLanguage);
      formDataWithFiles.append('project_type', formData.project_type);
      formDataWithFiles.append('room_dimensions', formData.room_dimensions);
      formDataWithFiles.append('budget_range', formData.budget_range);
      formDataWithFiles.append('preferred_materials', formData.preferred_materials);
      formDataWithFiles.append('preferred_colors', formData.preferred_colors);
      formDataWithFiles.append('message', formData.message);

      // Add photos
      selectedFiles.forEach((file) => {
        formDataWithFiles.append('photos', file);
      });

      const response = await fetch(`${API_BASE}/api/contact/quick-quote`, {
        method: 'POST',
        body: formDataWithFiles,
      });

      if (response.ok) {
        setSubmitted(true);
        announce(successMessage);
        // Scroll to top to show success message
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const errorData = await response.json();
        setError(errorData.error || t('quickQuote.error.submitFailed'));
      }
    } catch (error) {
      console.error('Error submitting quote request:', error);
      setError(t('quickQuote.error.submitFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", background: "rgb(110,110,110)" }}>
        <SEO title={t('quickQuote.pageTitle')} description={t('choice.quickQuote.description')} />
        <Navigation />
        <main id="main-content" tabIndex={-1} className="testimonial-container">
          <div className="testimonial-form-card">
            <CheckCircle className="success-icon" />
            <h1 ref={successHeadingRef} tabIndex={-1}>
              {t('quickQuote.successTitle')}
            </h1>
            <p>{successMessage}</p>
            <p className="text-sm text-gray-600 mt-4">
              {t('quickQuote.successEmail')}
            </p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="btn-primary mt-4"
            >
              {t('appointments.backToHome')}
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "rgb(110,110,110)", paddingBottom: "2rem" }}>
      <SEO title={t('quickQuote.pageTitle')} description={t('choice.quickQuote.description')} />
      <Navigation />
      <div style={{ height: "2vh" }}></div>
      <main id="main-content" tabIndex={-1} className="testimonial-container">
        <div className="testimonial-form-card">
          <h1 className="testimonial-form-title text-4xl mb-6">
            {t('quickQuote.heading')}
          </h1>
          <p className="text-lg text-gray-600 mb-10">
            {t('quickQuote.intro')}
          </p>

          <p className="form-required-legend">{t('a11y.requiredLegend')}</p>

          {/* Kept in the DOM while empty so screen readers pick up the alert */}
          <div
            ref={errorSummaryRef}
            role="alert"
            tabIndex={-1}
            className={hasSummary ? 'error-message' : undefined}
            style={hasSummary ? { marginBottom: '1.5rem' } : undefined}
          >
            {errorKeys.length > 0 && (
              <>
                <p>{t('forms.errorSummary', { count: errorKeys.length })}</p>
                <ul className="error-summary-list">
                  {errorKeys.map((field) => (
                    <li key={field}>
                      <a href={`#${field}`} onClick={(e) => focusField(e, field)}>
                        {t(fieldErrors[field])}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {error && <p>{error}</p>}
          </div>

          <form onSubmit={handleSubmit} className="testimonial-form" noValidate>
            {/* Contact Information */}
            <div className="form-section mb-10">
              <h2 className="section-title text-2xl my-6">
                <strong style={{color:'black' ,important: true}}>
                  {t('quickQuote.contactSection')}
                </strong>
              </h2>

              <div className="form-group mb-6">
                <label htmlFor="client_name" className="form-label text-base mb-2 block">
                  {t('quickQuote.name')} <span aria-hidden="true">*</span>
                </label>
                <input
                  type="text"
                  id="client_name"
                  name="client_name"
                  value={formData.client_name}
                  onChange={handleInputChange}
                  className="form-input text-base py-3"
                  required
                  autoComplete="name"
                  aria-invalid={fieldErrors.client_name ? 'true' : undefined}
                  aria-describedby={fieldErrors.client_name ? 'client_name-error' : undefined}
                  placeholder={t('appointments.namePlaceholder')}
                />
                {fieldErrors.client_name && (
                  <p className="field-error" id="client_name-error">{t(fieldErrors.client_name)}</p>
                )}
              </div>

              <div className="form-group mb-6">
                <label htmlFor="client_email" className="form-label text-base mb-2 block">
                  {t('quickQuote.email')} <span aria-hidden="true">*</span>
                </label>
                <input
                  type="email"
                  id="client_email"
                  name="client_email"
                  value={formData.client_email}
                  onChange={handleInputChange}
                  className="form-input text-base py-3"
                  required
                  autoComplete="email"
                  aria-invalid={fieldErrors.client_email ? 'true' : undefined}
                  aria-describedby={fieldErrors.client_email ? 'client_email-error' : undefined}
                  placeholder={t('appointments.emailPlaceholder')}
                />
                {fieldErrors.client_email && (
                  <p className="field-error" id="client_email-error">{t(fieldErrors.client_email)}</p>
                )}
              </div>

              <div className="form-group mb-6">
                <label htmlFor="client_phone" className="form-label text-base mb-2 block">
                  {t('quickQuote.phone')} <span aria-hidden="true">*</span>
                </label>
                <input
                  type="tel"
                  id="client_phone"
                  name="client_phone"
                  value={formData.client_phone}
                  onChange={handleInputChange}
                  required
                  autoComplete="tel"
                  className="form-input text-base py-3"
                  aria-invalid={fieldErrors.client_phone ? 'true' : undefined}
                  aria-describedby={
                    fieldErrors.client_phone ? 'client_phone-hint client_phone-error' : 'client_phone-hint'
                  }
                />
                <p className="form-hint" id="client_phone-hint">{t('forms.phoneHint')}</p>
                {fieldErrors.client_phone && (
                  <p className="field-error" id="client_phone-error">{t(fieldErrors.client_phone)}</p>
                )}
              </div>
            </div>

            {/* Project Details */}
            <div className="form-section mb-10">
              <h2 className="section-title text-2xl my-6">
                <strong style={{color:'black' ,important: true}}>
                  {t('quickQuote.projectSection')}
                  </strong>
              </h2>

              <div className="form-group mb-6">
                <label htmlFor="project_type" className="form-label text-base mb-2 block">
                  {t('quickQuote.projectType')} <span aria-hidden="true">*</span>
                </label>
                <select
                  id="project_type"
                  name="project_type"
                  value={formData.project_type}
                  onChange={handleInputChange}
                  className="form-input text-base py-3"
                  required
                  aria-invalid={fieldErrors.project_type ? 'true' : undefined}
                  aria-describedby={fieldErrors.project_type ? 'project_type-error' : undefined}
                >
                  {projectTypes[currentLanguage].map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {fieldErrors.project_type && (
                  <p className="field-error" id="project_type-error">{t(fieldErrors.project_type)}</p>
                )}
              </div>

              <div className="form-group mb-6">
                <label htmlFor="message" className="form-label text-base mb-2 block">
                  {t('quickQuote.message')}
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  className="form-input text-base py-3"
                  rows="6"
                  placeholder={t('quickQuote.messagePlaceholder')}
                />
              </div>
            </div>

            {/* Inspiration Photos */}
            <div className="form-group mb-10">
              <h2 className="section-title text-2xl my-6">
                <strong style={{color:'black' ,important: true}}>
                  {t('quickQuote.photosSection')}
                </strong>
              </h2>
              <p className="text-base text-gray-600 mb-6" id="photos-help">
                {t('quickQuote.photosHelp')}
              </p>

              <div className="photo-upload-area">
                <input
                  type="file"
                  id="photos"
                  ref={fileInputRef}
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  className="file-input-hidden"
                  aria-describedby="photos-help"
                  disabled={selectedFiles.length >= 5}
                />
                <label
                  htmlFor="photos"
                  className={`file-upload-label ${
                    selectedFiles.length >= 5 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <Upload className="upload-icon" />
                  <span>{t('forms.choosePhotos')}</span>
                  <span className="text-sm text-gray-600">
                    {t('quickQuote.photoCount', { n: selectedFiles.length })}
                  </span>
                </label>
              </div>

              {previewUrls.length > 0 && (
                <div className="photo-preview-grid">
                  {previewUrls.map((url, index) => (
                    <div key={index} className="photo-preview-item">
                      <img src={url} alt={t('forms.photoPreview', { n: index + 1 })} />
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="remove-photo-button"
                        aria-label={t('forms.removePhoto', { n: index + 1 })}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-actions mt-8">
              <button
                type="button"
                onClick={() => onBack ? onBack() : navigate('/')}
                className="btn-primary text-base py-3 px-6"
                disabled={loading}
              >
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn-primary text-base py-3 px-6 my-2" disabled={loading}>
                {loading ? t('quickQuote.submitting') : t('quickQuote.submit')}
              </button>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default QuickContactForm;
