import React, { useState, useEffect, useRef } from 'react';
import Navigation from '../ui/Navigation';
import Footer from '../ui/Footer';
import SEO from '../ui/SEO';
import { announce } from '../ui/LiveRegion';
import { useLanguage } from '../../contexts/LanguageContext';
import '../css/about.css';
import { useAnalytics } from '../../hooks/useAnalytics';

const About = () => {
    // Analytics tracking
    useAnalytics('/about');

    // Language context
    const { t, currentLanguage } = useLanguage();

    const [teamMembers, setTeamMembers] = useState([]);
    const [testimonials, setTestimonials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [testimonialsLoading, setTestimonialsLoading] = useState(true);
    const [error, setError] = useState(false);
    const [modalImage, setModalImage] = useState(null);
    const [modalImages, setModalImages] = useState([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);
    const [imageOrientations, setImageOrientations] = useState({}); // Track orientation for each image
    const viewerRef = useRef(null);

    // API base URL
    const API_BASE = process.env.REACT_APP_API_URL || 'https://api.gudinocustom.com';
    const icons = {
        user: (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
            </svg>
        ),
        mail: (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                <path d="m22 7-10 5L2 7"></path>
            </svg>
        ),
        phone: (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
            </svg>
        ),
        calendar: (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
        )
    };

    useEffect(() => {
        loadTeamMembers();
        loadTestimonials();
    }, []);

    const loadTeamMembers = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/employees`);

            if (!response.ok) {
                throw new Error('Failed to load team members');
            }

            const employees = await response.json();
            setTeamMembers(employees);
            setLoading(false);
        } catch (err) {
            console.error('Error loading team members:', err);
            setError(true);
            setLoading(false);
        }
    };

    const loadTestimonials = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/testimonials`);

            if (response.ok) {
                const testimonials = await response.json();
                // Only show visible testimonials on the public page
                const visibleTestimonials = testimonials.filter(t => t.is_visible !== false);
                setTestimonials(visibleTestimonials);
            }
            setTestimonialsLoading(false);
        } catch (err) {
            console.error('Error loading testimonials:', err);
            setTestimonialsLoading(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString(currentLanguage === 'es' ? 'es-US' : 'en-US', { year: 'numeric', month: 'long' });
    };

    const openImageModal = (photos, index) => {
        setModalImages(photos);
        setCurrentImageIndex(index);
        setModalImage(photos[index]);
    };

    const closeModal = () => {
        setModalImage(null);
        setModalImages([]);
        setCurrentImageIndex(0);
    };

    const navigateImage = (direction) => {
        const newIndex = direction === 'next'
            ? (currentImageIndex + 1) % modalImages.length
            : (currentImageIndex - 1 + modalImages.length) % modalImages.length;
        setCurrentImageIndex(newIndex);
        setModalImage(modalImages[newIndex]);
        announce(t('about.photoViewer', { n: newIndex + 1, total: modalImages.length }));
    };

    // Native <dialog> gives an inert background, Escape and focus return
    useEffect(() => {
        const dialog = viewerRef.current;
        if (!dialog) return;
        if (modalImage && !dialog.open) dialog.showModal();
        if (!modalImage && dialog.open) dialog.close();
    }, [modalImage]);

    const handleViewerKeyDown = (e) => {
        if (modalImages.length < 2) return;
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            navigateImage('prev');
        }
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            navigateImage('next');
        }
    };

    // Swipe gesture handlers for mobile
    const handleTouchStart = (e) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const handleTouchMove = (e) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const handleTouchEnd = () => {
        if (!touchStart || !touchEnd) return;

        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > 50;
        const isRightSwipe = distance < -50;

        if (isLeftSwipe && modalImages.length > 1) {
            navigateImage('next');
        }
        if (isRightSwipe && modalImages.length > 1) {
            navigateImage('prev');
        }
    };

    // Handle image load to detect orientation and set appropriate sizing
    const handleTestimonialImageLoad = (e, testimonialId, photoIndex) => {
        const img = e.target;
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        const aspectRatio = width / height;

        let orientation, containerClass;

        if (aspectRatio < 0.8) {
            orientation = "portrait";
            containerClass = "testimonial-photo-portrait";
        } else if (aspectRatio < 1.2) {
            orientation = "square";
            containerClass = "testimonial-photo-square";
        } else if (aspectRatio < 1.8) {
            orientation = "landscape";
            containerClass = "testimonial-photo-landscape";
        } else {
            orientation = "panoramic";
            containerClass = "testimonial-photo-panoramic";
        }

        // Store orientation info
        setImageOrientations(prev => ({
            ...prev,
            [`${testimonialId}-${photoIndex}`]: { orientation, containerClass }
        }));

        // Apply the class to the container
        const container = img.closest('.testimonial-photo');
        if (container) {
            container.className = `testimonial-photo ${containerClass}`;
        }

        // Mark image as loaded
        img.setAttribute('data-loaded', 'true');
    };

    return (
        <>
            <SEO
                title={t('seo.about.title')}
                description="Meet the craftsmen behind Gudino Custom. Family-owned carpentry business serving Washington since 2010. Expert kitchen and bathroom remodeling with dedication to quality."
                keywords="about us, carpentry team, master carpenters, family owned business, Washington contractors, craftsmen, woodworking experts"
                canonical="https://gudinocustom.com/about"
            />
            <Navigation />
            <main id="main-content" tabIndex={-1} className="about-page">
                {/* Hero Section */}
                <div className="about-hero">
                    <h1>{t('about.heroTitle')}</h1>
                    <p>{t('about.heroSubtitle')}</p>
                </div>
                {/* Company Info */}
                <div className="about-company-info">
                    <h2>{t('about.companyTitle')}</h2>
                    <p>{t('about.companyDescription')}</p>
                </div>
                {/* Team Section */}
                <div className="about-section-title">
                    <h2>{t('about.teamTitle')}</h2>
                    <p>{t('about.teamSubtitle')}</p>
                </div>
                <div id="teamGrid" className="team-grid">
                    {loading && (
                        <div className="about-loading">
                            <div className="about-loading-spinner"></div>
                            <p>{t('about.loadingTeam')}</p>
                        </div>
                    )}
                    {error && (
                        <div className="about-error" role="alert">{t('about.errorTeam')}</div>
                    )}
                    {!loading && !error && teamMembers.length === 0 && (
                        <p className="about-loading" style={{ color: 'white', fontSize: '1.2rem', fontWeight: 'bold' }}>
                            {t('about.noTeamMembers')}
                        </p>
                    )}
                    {!loading && !error && teamMembers.map((employee, index) => (
                        <div
                            key={employee.id || index}
                            className="team-member"
                            style={{ animationDelay: `${index * 0.1}s` }}
                        >
                            {employee.photo_url ? (
                                <img
                                    src={`${API_BASE}${employee.photo_url}`}
                                    alt={employee.name}
                                    className="member-photo"
                                />
                            ) : (
                                <div className="member-photo placeholder">
                                    {icons.user}
                                </div>
                            )}

                            <div className="member-info">
                                <h3 className="member-name">{employee.name}</h3>
                                <p className="member-position">{employee.position}</p>
                                {employee.bio && <p className="member-bio">{employee.bio}</p>}

                                <div className="member-contact">
                                    {employee.email && (
                                        <div className="about-contact-item">
                                            {icons.mail}
                                            <span>{employee.email}</span>
                                        </div>
                                    )}
                                    {employee.phone && (
                                        <div className="about-contact-item">
                                            {icons.phone}
                                            <span>{employee.phone}</span>
                                        </div>
                                    )}
                                </div>

                                {employee.joined_date && (
                                    <div className="joined-date">
                                        {icons.calendar}
                                        <span>{t('about.joined')} {formatDate(employee.joined_date)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Testimonials Section */}
                <div className="about-section-title">
                    <h2>{t('about.testimonialsTitle')}</h2>
                    <p>{t('about.testimonialsSubtitle')}</p>
                </div>

                {testimonialsLoading ? (
                    <div className="about-loading">
                        <div className="about-loading-spinner"></div>
                        <p>{t('about.loadingTestimonials')}</p>
                    </div>
                ) : testimonials.length > 0 ? (
                    <div className="testimonials-grid">
                        {testimonials.map((testimonial, index) => (
                            <div key={testimonial.id || index} className="testimonial-card" style={{ animationDelay: `${index * 0.1}s` }}>
                                <div className="testimonial-content">
                                    <div
                                        className="testimonial-stars"
                                        role="img"
                                        aria-label={t('about.rating', { n: testimonial.rating || 5 })}
                                    >
                                        <span aria-hidden="true">{'★'.repeat(testimonial.rating || 5)}</span>
                                    </div>
                                    <p className="testimonial-text">"{testimonial.message}"</p>

                                    {testimonial.photos && testimonial.photos.length > 0 && (
                                        <div className="testimonial-photos">
                                            {testimonial.photos.map((photo, photoIndex) => (
                                                <div
                                                    key={photoIndex}
                                                    className="testimonial-photo"
                                                >
                                                    <button
                                                        type="button"
                                                        className="testimonial-photo-btn"
                                                        onClick={() => openImageModal(testimonial.photos, photoIndex)}
                                                    >
                                                        <img
                                                            src={`${API_BASE}${photo.thumbnail_path || photo.file_path}`}
                                                            alt={t('about.enlargePhoto', { n: photoIndex + 1, total: testimonial.photos.length })}
                                                            onLoad={(e) => handleTestimonialImageLoad(e, testimonial.id, photoIndex)}
                                                        />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="testimonial-author">
                                        <strong>{testimonial.client_name}</strong>
                                        {testimonial.project_type && (
                                            <span className="project-type">{testimonial.project_type}</span>
                                        )}
                                        <span className="testimonial-date">
                                            {formatDate(testimonial.created_at)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="no-testimonials">
                        <p>{t('about.noTestimonials')}</p>
                    </div>
                )}
            </main>

            {/* Image viewer */}
            <dialog
                ref={viewerRef}
                className="about-viewer"
                aria-label={t('about.viewer')}
                onClose={closeModal}
                onKeyDown={handleViewerKeyDown}
                onClick={(e) => {
                    if (e.target === e.currentTarget) closeModal();
                }}
            >
                {modalImage && (
                    <>
                        {/* Close Button */}
                        <button
                            type="button"
                            className="about-viewer-btn about-viewer-close"
                            onClick={closeModal}
                            aria-label={t('a11y.close')}
                        >
                            <span aria-hidden="true">×</span>
                        </button>

                        {/* Navigation Buttons (only show if multiple images) */}
                        {modalImages.length > 1 && (
                            <>
                                <button
                                    type="button"
                                    className="about-viewer-btn about-viewer-prev"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigateImage('prev');
                                    }}
                                    aria-label={t('about.prevImage')}
                                >
                                    <span aria-hidden="true">‹</span>
                                </button>

                                <button
                                    type="button"
                                    className="about-viewer-btn about-viewer-next"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigateImage('next');
                                    }}
                                    aria-label={t('about.nextImage')}
                                >
                                    <span aria-hidden="true">›</span>
                                </button>
                            </>
                        )}

                        {/* Image Container */}
                        <div
                            className="about-viewer-figure"
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                        >
                            <img
                                src={`${API_BASE}${modalImage.file_path}`}
                                alt={t('about.photoViewer', { n: currentImageIndex + 1, total: modalImages.length })}
                            />
                            {/* Image Counter */}
                            {modalImages.length > 1 && (
                                <div className="about-viewer-counter" aria-hidden="true">
                                    {currentImageIndex + 1} / {modalImages.length}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </dialog>

        <Footer />
        </>
    );
};

export default About;
