import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Upload, X, Copy, ExternalLink, Check } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import Navigation from '../ui/Navigation';
import Footer from '../ui/Footer';
import SEO from '../ui/SEO';
import { announce } from '../ui/LiveRegion';
import '../css/testimonial-form.css';


const GOOGLE_PLACE_ID = 'ChIJRVHpJoQjmFQRV5JD2IPKyI4';

const TestimonialForm = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [formData, setFormData] = useState({
        client_name: '',
        message: '',
        rating: 5,
        project_type: ''
    });
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [previewUrls, setPreviewUrls] = useState([]);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isValidToken, setIsValidToken] = useState(null);
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    const [showGooglePrompt, setShowGooglePrompt] = useState(true);
    const [copied, setCopied] = useState(false);
    // field name -> translation key of the message (kept as keys so the list
    // follows a language switch)
    const [fieldErrors, setFieldErrors] = useState({});

    const successHeadingRef = useRef(null);
    const finalThanksRef = useRef(null);
    const errorSummaryRef = useRef(null);
    const fileInputRef = useRef(null);

    const API_BASE = process.env.REACT_APP_API_URL || 'https://api.gudinocustom.com';

    const errorKeys = Object.keys(fieldErrors);
    const hasSummary = errorKeys.length > 0 || Boolean(error);

    useEffect(() => {
        validateToken();
    }, [token]);

    // The confirmation replaces the form, so move focus to its heading (WCAG 2.4.3)
    useEffect(() => {
        if (submitted) {
            successHeadingRef.current?.focus();
        }
    }, [submitted]);

    // Same when the Google prompt is dismissed and the closing message takes its place
    useEffect(() => {
        if (!showGooglePrompt) {
            finalThanksRef.current?.focus();
        }
    }, [showGooglePrompt]);

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

    const validateToken = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/testimonials/validate-token/${token}`);
            if (response.ok) {
                const data = await response.json();
                setIsValidToken(data.valid);

                // Auto-populate form fields from token data
                if (data.valid && data.client_name && data.project_type) {
                    setFormData(prev => ({
                        ...prev,
                        client_name: data.client_name,
                        project_type: data.project_type
                    }));

                    // Track the link open
                    try {
                        await fetch(`${API_BASE}/api/testimonials/track-open`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ token }),
                        });
                    } catch (trackError) {
                        // Silently fail tracking - don't block the form
                        console.error('Tracking error:', trackError);
                    }
                }
            } else {
                setIsValidToken(false);
            }
        } catch (error) {
            console.error('Error validating token:', error);
            setIsValidToken(false);
        }
    };

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        const maxFiles = 5;
        const maxFileSize = 10 * 1024 * 1024; // 10MB

        if (selectedFiles.length + files.length > maxFiles) {
            setError(t('forms.error.maxPhotos', { max: maxFiles }));
            return;
        }

        const validFiles = files.filter(file => {
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

        setSelectedFiles(prev => [...prev, ...validFiles]);

        // Create preview URLs
        validFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                setPreviewUrls(prev => [...prev, e.target.result]);
            };
            reader.readAsDataURL(file);
        });

        setError('');
    };

    const removeFile = (index) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
        setPreviewUrls(prev => prev.filter((_, i) => i !== index));
        // the button that was pressed is gone, so put focus somewhere sensible
        setTimeout(() => fileInputRef.current?.focus(), 0);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const errors = {};
        if (!formData.message.trim()) {
            errors.message = 'testimonial.error.messageRequired';
        }
        setFieldErrors(errors);
        if (Object.keys(errors).length > 0) {
            return;
        }

        setLoading(true);
        setUploadProgress(0);

        try {
            const formDataWithFiles = new FormData();
            formDataWithFiles.append('client_name', formData.client_name);
            formDataWithFiles.append('message', formData.message);
            formDataWithFiles.append('rating', formData.rating);
            formDataWithFiles.append('project_type', formData.project_type);
            formDataWithFiles.append('token', token);

            // Add photos
            selectedFiles.forEach((file, index) => {
                formDataWithFiles.append('photos', file);
            });

            const response = await fetch(`${API_BASE}/api/testimonials/submit`, {
                method: 'POST',
                body: formDataWithFiles,
                onUploadProgress: (progressEvent) => {
                    const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(progress);
                }
            });

            if (response.ok) {
                setSubmitted(true);
                announce(t('testimonial.thanksText'));
            } else {
                const errorData = await response.json();
                setError(errorData.error || t('testimonial.error.submitFailed'));
            }
        } catch (error) {
            console.error('Error submitting testimonial:', error);
            setError(t('testimonial.error.submitFailed'));
        } finally {
            setLoading(false);
            setUploadProgress(0);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const seo = <SEO title={t('testimonial.pageTitle')} description={t('testimonial.intro')} />;

    if (isValidToken === null) {
        return (
            <>
                {seo}
                <Navigation />
                <main id="main-content" tabIndex={-1} className="testimonial-container">
                    <h1 className="sr-only">{t('testimonial.heading')}</h1>
                    <div className="loading-spinner" aria-hidden="true"></div>
                    <p>{t('testimonial.validating')}</p>
                </main>
            </>
        );
    }

    if (!isValidToken) {
        return (
            <>
                {seo}
                <Navigation />
                <main id="main-content" tabIndex={-1} className="testimonial-container">
                    <div className="error-card">
                        <h1>{t('testimonial.invalidTitle')}</h1>
                        <p>{t('testimonial.invalidText')}</p>
                        <button type="button" onClick={() => navigate('/')} className="btn-primary">
                            {t('appointments.backToHome')}
                        </button>
                    </div>
                </main>
            </>
        );
    }

    // Copy review text to clipboard
    const handleCopyReview = async () => {
        try {
            await navigator.clipboard.writeText(formData.message);
            setCopied(true);
            announce(t('testimonial.google.copiedAnnounce'));
            setTimeout(() => setCopied(false), 3000);
        } catch (err) {
            console.error('Failed to copy:', err);
            announce(t('testimonial.google.copyFailed'));
        }
    };

    // Open Google Reviews in new tab
    const handleOpenGoogleReviews = () => {
        const googleReviewUrl = `https://search.google.com/local/writereview?placeid=${GOOGLE_PLACE_ID}`;
        window.open(googleReviewUrl, '_blank', 'noopener,noreferrer');
    };

    // Copy and then open Google Reviews
    const handleCopyAndOpen = async () => {
        await handleCopyReview();
        handleOpenGoogleReviews();
    };

    if (submitted) {
        return (
            <>
                {seo}
                <Navigation />
                <main id="main-content" tabIndex={-1} className="testimonial-container">
                    <div className="success-card success-card-wide">
                        <div className="success-icon" aria-hidden="true">✓</div>
                        <h1 ref={successHeadingRef} tabIndex={-1}>{t('testimonial.thanksTitle')}</h1>
                        <p>{t('testimonial.thanksText')}</p>

                        {showGooglePrompt ? (
                            <div className="google-review-section">
                                <div className="google-review-prompt">
                                    <h2>{t('testimonial.google.promptTitle')}</h2>
                                    <p>{t('testimonial.google.promptText')}</p>
                                </div>

                                <div className="google-review-split">
                                    {/* Left side - Review text */}
                                    <div className="review-text-panel">
                                        <div className="panel-header">
                                            <span>{t('testimonial.google.yourReview')}</span>
                                            <button
                                                type="button"
                                                onClick={handleCopyReview}
                                                className="copy-btn"
                                                title={t('testimonial.google.copyToClipboard')}
                                            >
                                                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                                {copied ? t('testimonialManager.copied') : t('testimonial.google.copy')}
                                            </button>
                                        </div>
                                        <div className="review-text-content">
                                            <div
                                                className="review-stars"
                                                role="img"
                                                aria-label={t('testimonial.ratingValue', { n: formData.rating })}
                                            >
                                                <span aria-hidden="true">
                                                    {'★'.repeat(formData.rating)}{'☆'.repeat(5 - formData.rating)}
                                                </span>
                                            </div>
                                            <p>{formData.message}</p>
                                        </div>
                                    </div>

                                    {/* Right side - Google action */}
                                    <div className="google-action-panel">
                                        <div className="google-logo">
                                            <svg viewBox="0 0 24 24" width="48" height="48" aria-hidden="true" focusable="false">
                                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                            </svg>
                                        </div>
                                        <h3>{t('testimonial.google.title')}</h3>
                                        <p className="google-instructions">
                                            {t('testimonial.google.instructions')}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={handleCopyAndOpen}
                                            className="btn-google"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                            {t('testimonial.google.button')}
                                            <span className="sr-only">{t('a11y.opensInNewTab')}</span>
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setShowGooglePrompt(false)}
                                    className="btn-secondary skip-btn"
                                >
                                    {t('testimonial.google.skip')}
                                </button>
                            </div>
                        ) : (
                            <div className="final-thanks">
                                <p ref={finalThanksRef} tabIndex={-1}>{t('testimonial.finalThanks')}</p>
                                <button type="button" onClick={() => navigate('/')} className="btn-primary">
                                    {t('appointments.backToHome')}
                                </button>
                            </div>
                        )}
                    </div>
                </main>
            </>
        );
    }

    return (
        <>
            {seo}
            <Navigation />
            <main id="main-content" tabIndex={-1} className="testimonial-container">
                <div className="testimonial-form-card">
                    <h1>{t('testimonial.heading')}</h1>
                    <p className="form-description">
                        {t('testimonial.intro')}
                    </p>

                    <p className="form-required-legend">{t('a11y.requiredLegend')}</p>

                    {/* Kept in the DOM while empty so screen readers pick up the alert */}
                    <div
                        ref={errorSummaryRef}
                        role="alert"
                        tabIndex={-1}
                        className={hasSummary ? 'error-message' : undefined}
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
                        <div className="form-group">
                            <label htmlFor="client_name">{t('testimonial.name')}</label>
                            <input
                                type="text"
                                id="client_name"
                                name="client_name"
                                value={formData.client_name}
                                onChange={handleChange}
                                required
                                placeholder={t('appointments.namePlaceholder')}
                                readOnly
                                disabled
                                style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed' }}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="project_type">{t('testimonial.projectType')}</label>
                            <input
                                type="text"
                                id="project_type"
                                name="project_type"
                                value={formData.project_type}
                                readOnly
                                disabled
                                style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed' }}
                            />
                        </div>

                        <fieldset className="form-group">
                            <legend>{t('testimonial.rating')}</legend>
                            <div className="rating-container">
                                {[1, 2, 3, 4, 5].map(star => (
                                    <label
                                        key={star}
                                        className={`star ${formData.rating >= star ? 'active' : ''}`}
                                    >
                                        <input
                                            type="radio"
                                            name="rating"
                                            value={star}
                                            checked={formData.rating === star}
                                            onChange={() => setFormData(prev => ({ ...prev, rating: star }))}
                                            className="sr-only star-input"
                                        />
                                        <span className="star-glyph" aria-hidden="true">
                                            {formData.rating >= star ? '★' : '☆'}
                                        </span>
                                        <span className="sr-only">
                                            {star === 1 ? t('testimonial.starOne', { n: star }) : t('testimonial.starN', { n: star })}
                                        </span>
                                    </label>
                                ))}
                                {/* the radio group already exposes the value to assistive tech */}
                                <span className="rating-text" aria-hidden="true">
                                    ({formData.rating === 1
                                        ? t('testimonial.starOne', { n: formData.rating })
                                        : t('testimonial.starN', { n: formData.rating })})
                                </span>
                            </div>
                        </fieldset>

                        <div className="form-group">
                            <label htmlFor="message">
                                {t('testimonial.message')} <span aria-hidden="true">*</span>
                            </label>
                            <textarea
                                id="message"
                                name="message"
                                value={formData.message}
                                onChange={handleChange}
                                required
                                rows="5"
                                placeholder={t('testimonial.messagePlaceholder')}
                                aria-invalid={fieldErrors.message ? 'true' : undefined}
                                aria-describedby={fieldErrors.message ? 'message-error' : undefined}
                            />
                            {fieldErrors.message && (
                                <p className="field-error" id="message-error">{t(fieldErrors.message)}</p>
                            )}
                        </div>

                        <fieldset className="form-group">
                            <legend>{t('testimonial.photosLegend')}</legend>
                            <p className="form-help-text" id="photos-help">
                                {t('testimonial.photosHelp')}
                            </p>

                            <div className="photo-upload-area">
                                <input
                                    type="file"
                                    id="photos"
                                    ref={fileInputRef}
                                    multiple
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="file-input-hidden"
                                    aria-describedby="photos-help"
                                />
                                <label htmlFor="photos" className="file-upload-label">
                                    <Upload className="upload-icon" />
                                    <span>{t('forms.choosePhotos')}</span>
                                    <span className="file-upload-subtitle">
                                        {t('forms.photoTypes')}
                                    </span>
                                </label>
                            </div>

                            {previewUrls.length > 0 && (
                                <div className="photo-previews">
                                    {previewUrls.map((url, index) => (
                                        <div key={index} className="photo-preview">
                                            <img src={url} alt={t('forms.photoPreview', { n: index + 1 })} />
                                            <button
                                                type="button"
                                                onClick={() => removeFile(index)}
                                                className="remove-photo-btn"
                                                aria-label={t('forms.removePhoto', { n: index + 1 })}
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </fieldset>

                        <button type="submit" disabled={loading} className="btn-primary">
                            {loading ? (
                                <span className="submit-progress">
                                    <span className="loading-spinner" aria-hidden="true"></span>
                                    {selectedFiles.length > 0 && uploadProgress > 0 ?
                                        t('testimonial.uploading', { percent: uploadProgress }) :
                                        t('testimonial.submitting')
                                    }
                                </span>
                            ) : (
                                t('testimonial.submit')
                            )}
                        </button>
                    </form>
                </div>
            </main>
            <Footer />
        </>
    );
};

export default TestimonialForm;
