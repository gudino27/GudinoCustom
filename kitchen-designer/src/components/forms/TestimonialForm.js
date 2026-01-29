import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Upload, X, Image as ImageIcon, Copy, ExternalLink, Check } from 'lucide-react';
import Navigation from '../ui/Navigation';
import Footer from '../ui/Footer';
import '../css/testimonial-form.css';


const GOOGLE_PLACE_ID = 'ChIJRVHpJoQjmFQRV5JD2IPKyI4';

const TestimonialForm = () => {
    const { token } = useParams();
    const navigate = useNavigate();
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

    const API_BASE = process.env.REACT_APP_API_URL || 'https://api.gudinocustom.com';

    useEffect(() => {
        validateToken();
    }, [token]);

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
            setError(`You can only upload up to ${maxFiles} photos.`);
            return;
        }

        const validFiles = files.filter(file => {
            if (!file.type.startsWith('image/')) {
                setError('Please only upload image files.');
                return false;
            }
            if (file.size > maxFileSize) {
                setError('Each file must be less than 10MB.');
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
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
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
            } else {
                const errorData = await response.json();
                setError(errorData.error || 'Failed to submit testimonial');
            }
        } catch (error) {
            console.error('Error submitting testimonial:', error);
            setError('Failed to submit testimonial. Please try again.');
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

    if (isValidToken === null) {
        return (
            <>
                <Navigation />
                <div className="testimonial-container">
                    <div className="loading-spinner"></div>
                    <p>Validating access...</p>
                </div>
            </>
        );
    }

    if (!isValidToken) {
        return (
            <>
                <Navigation />
                <div className="testimonial-container">
                    <div className="error-card">
                        <h2>Invalid or Expired Link</h2>
                        <p>This testimonial link is not valid or has expired. Please contact Gudino Custom Woodworking for a new link.</p>
                        <button onClick={() => navigate('/')} className="btn-primary">
                            Return Home
                        </button>
                    </div>
                </div>
            </>
        );
    }

    // Copy review text to clipboard
    const handleCopyReview = async () => {
        try {
            await navigator.clipboard.writeText(formData.message);
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
        } catch (err) {
            console.error('Failed to copy:', err);
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
                <Navigation />
                <div className="testimonial-container">
                    <div className="success-card success-card-wide">
                        <div className="success-icon">✓</div>
                        <h2>Thank You!</h2>
                        <p>Your testimonial has been submitted successfully!</p>

                        {showGooglePrompt ? (
                            <div className="google-review-section">
                                <div className="google-review-prompt">
                                    <h3>Help us reach more customers!</h3>
                                    <p>Would you mind sharing this review on Google? It only takes a minute and helps other homeowners find us.</p>
                                </div>

                                <div className="google-review-split">
                                    {/* Left side - Review text */}
                                    <div className="review-text-panel">
                                        <div className="panel-header">
                                            <span>Your Review</span>
                                            <button
                                                onClick={handleCopyReview}
                                                className="copy-btn"
                                                title="Copy to clipboard"
                                            >
                                                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                                {copied ? 'Copied!' : 'Copy'}
                                            </button>
                                        </div>
                                        <div className="review-text-content">
                                            <div className="review-stars">
                                                {'★'.repeat(formData.rating)}{'☆'.repeat(5 - formData.rating)}
                                            </div>
                                            <p>{formData.message}</p>
                                        </div>
                                    </div>

                                    {/* Right side - Google action */}
                                    <div className="google-action-panel">
                                        <div className="google-logo">
                                            <svg viewBox="0 0 24 24" width="48" height="48">
                                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                            </svg>
                                        </div>
                                        <h4>Share on Google</h4>
                                        <p className="google-instructions">
                                            Click below to open Google Reviews. Your review text has been copied - just paste it!
                                        </p>
                                        <button
                                            onClick={handleCopyAndOpen}
                                            className="btn-google"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                            Copy & Open Google Reviews
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setShowGooglePrompt(false)}
                                    className="btn-secondary skip-btn"
                                >
                                    No thanks, I'm done
                                </button>
                            </div>
                        ) : (
                            <div className="final-thanks">
                                <p>We appreciate your feedback!</p>
                                <button onClick={() => navigate('/')} className="btn-primary">
                                    Return Home
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Navigation />
            <div className="testimonial-container">
                <div className="testimonial-form-card">
                    <h2>Share Your Experience</h2>
                    <p className="form-description">
                        We'd love to hear about your experience with Gudino Custom Woodworking.
                        Your testimonial helps other homeowners discover our services.
                    </p>

                    <form onSubmit={handleSubmit} className="testimonial-form">
                        <div className="form-group">
                            <label htmlFor="client_name">Your Name</label>
                            <input
                                type="text"
                                id="client_name"
                                name="client_name"
                                value={formData.client_name}
                                onChange={handleChange}
                                required
                                placeholder="Enter your full name"
                                readOnly
                                disabled
                                style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed' }}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="project_type">Project Type</label>
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

                        <div className="form-group">
                            <label htmlFor="rating">Rating</label>
                            <div className="rating-container">
                                {[1, 2, 3, 4, 5].map(star => (
                                    <button
                                        key={star}
                                        type="button"
                                        className={`star ${formData.rating >= star ? 'active' : ''}`}
                                        onClick={() => setFormData(prev => ({ ...prev, rating: star }))}
                                    >
                                        ★
                                    </button>
                                ))}
                                <span className="rating-text">({formData.rating} star{formData.rating !== 1 ? 's' : ''})</span>
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="message">Your Testimonial</label>
                            <textarea
                                id="message"
                                name="message"
                                value={formData.message}
                                onChange={handleChange}
                                required
                                rows="5"
                                placeholder="Tell us about your experience with our carpentry services..."
                            />
                        </div>

                        <div className="form-group">
                            <label>Photos of Your Project (Optional)</label>
                            <p className="form-help-text">
                                Share photos of your completed cabinets or project. Up to 5 photos, 10MB each.
                            </p>

                            <div className="photo-upload-area">
                                <input
                                    type="file"
                                    id="photos"
                                    multiple
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="file-input-hidden"
                                />
                                <label htmlFor="photos" className="file-upload-label">
                                    <Upload className="upload-icon" />
                                    <span>Click to upload photos or drag and drop </span>
                                    <span className="file-upload-subtitle">
                                        PNG, JPG, WebP up to 10MB each
                                    </span>
                                </label>
                            </div>

                            {previewUrls.length > 0 && (
                                <div className="photo-previews">
                                    {previewUrls.map((url, index) => (
                                        <div key={index} className="photo-preview">
                                            <img src={url} alt={`Preview ${index + 1}`} />
                                            <button
                                                type="button"
                                                onClick={() => removeFile(index)}
                                                className="remove-photo-btn"
                                                aria-label="Remove photo"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="error-message">
                                {error}
                            </div>
                        )}

                        <button type="submit" disabled={loading} className="btn-primary">
                            {loading ? (
                                <div className="submit-progress">
                                    <div className="loading-spinner"></div>
                                    {selectedFiles.length > 0 && uploadProgress > 0 ?
                                        `Uploading... ${uploadProgress}%` :
                                        'Submitting...'
                                    }
                                </div>
                            ) : (
                                'Submit Testimonial'
                            )}
                        </button>
                    </form>
                </div>
            </div>
            <Footer />
        </>
    );
};

export default TestimonialForm;
