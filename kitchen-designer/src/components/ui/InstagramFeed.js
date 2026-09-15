import React, { useState, useEffect, useRef } from 'react';
import { Instagram, AlertCircle } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

const API_BASE = process.env.REACT_APP_API_URL || 'https://api.gudinocustom.com';

/**
 * InstagramFeed - Display grid of Instagram posts using iframe embeds
 *
 * Features:
 * - Fetches Instagram posts from backend (supports manual URL input)
 * - Renders posts using Instagram's iframe embed format
 * - Responsive grid layout
 * - Loading and error states
 * - Configurable post limit
 * - Link to full Instagram profile
 * - Lazy loading with Intersection Observer (loads only when visible)
 *
 * Note: We use iframe embeds (/embed/) instead of embed.js to avoid
 * tracking prevention issues and Invariant Violation errors
 */
const InstagramFeed = ({ limit = 6, showTitle = true, className = '' }) => {
  const { t } = useLanguage();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false); // Start false - only load when visible
  const [error, setError] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef(null);

  // Instagram profile URL
  const INSTAGRAM_PROFILE_URL = 'https://www.instagram.com/gudinocustomwoodworking?igsh=MWNqZjhyaWtjOGhcg==';

  // Intersection Observer for lazy loading - only load when section is visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isVisible) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      {
        root: null,
        rootMargin: '200px', // Start loading 200px before visible
        threshold: 0.01
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [isVisible]);

  // Only load posts when component becomes visible
  useEffect(() => {
    if (isVisible) {
      loadPosts();
    }
  }, [isVisible]);

  const loadPosts = async () => {
    setLoading(true);
    setError('');

    try {
      // First try to fetch oEmbed posts (from manual URL input)
      let response = await fetch(`${API_BASE}/api/instagram/oembed-posts`);
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          // Sort by display_order, then by timestamp (newest first)
          const sortedPosts = data.sort((a, b) => {
            if (a.display_order !== b.display_order) {
              return (a.display_order || 0) - (b.display_order || 0);
            }
            return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
          });
          setPosts(sortedPosts.slice(0, limit));
          setLoading(false);
          return;
        }
      }

      // Fall back to old posts endpoint if no oEmbed posts
      response = await fetch(`${API_BASE}/api/instagram/posts`);
      
      if (response.ok) {
        const data = await response.json();
        const sortedPosts = data.sort((a, b) => {
          if (a.display_order !== b.display_order) {
            return (a.display_order || 0) - (b.display_order || 0);
          }
          return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
        });
        setPosts(sortedPosts.slice(0, limit));
      } else {
        // No posts from either source - that's OK, just show nothing
        setPosts([]);
      }
    } catch (err) {
      console.error('Error loading Instagram posts:', err);
      // Don't show error to user, just don't display the section
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  // Don't render anything if visible and there are no posts and not loading
  if (isVisible && !loading && posts.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`instagram-feed ${className}`}
      style={{
        padding: '4rem 1rem',
        minHeight: isVisible ? 'auto' : '400px' // Reserve space before loading
      }}
    >
      {/* Placeholder skeleton shown before content is loaded */}
      {!isVisible && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '300px',
          color: '#f3f4f6'
        }}>
          <div style={{ textAlign: 'center' }}>
            <Instagram size={48} style={{ opacity: 0.3 }} />
            <p style={{ marginTop: '1rem', fontSize: '0.875rem' }}>{t('instagram.feed')}</p>
          </div>
        </div>
      )}

      {isVisible && (
      <div style={{ maxWidth: 'auto', margin: '0 auto' }}>
        
        {/* Header Card */}
       

        {/* Loading State */}
        {loading && (
          <div 
            style={{ 
              textAlign: 'center', 
              padding: '4rem 2rem',
              background: 'white',
              borderRadius: '20px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
            }}
          >
            <div
              style={{
                display: 'inline-block',
                width: '56px',
                height: '56px',
                border: '4px solid #F3F4F6',
                borderTop: '4px solid #E11D48',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}
            />
            <p style={{ marginTop: '1.5rem', color: '#6B7280', fontSize: '1.125rem' }}>
              {t('instagram.loading')}
            </p>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div
            style={{
              padding: '2rem',
              background: 'white',
              borderRadius: '16px',
              border: '1px solid #FEE2E2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              color: '#991B1B'
            }}
          >
            <AlertCircle size={24} />
            <span style={{ fontSize: '1.125rem' }}>{error}</span>
          </div>
        )}

        {/* Posts Grid */}
        {!loading && posts.length > 0 && (
          <>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '1.5rem'
              }}
            >
              {posts.map((post, index) => (
                <div
                  key={post.id}
                  style={{
                    background: 'transparent',
                    overflow: 'hidden',
                    cursor: 'pointer'
                  }}
                  
                >
                  {/* If we have oEmbed HTML, use it */}
                  {post.html ? (
                    <div 
                      dangerouslySetInnerHTML={{ __html: post.html }}
                      style={{ 
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: '0.5rem'
                      }}
                    />
                  ) : post.media_url ? (
                    /* Fall back to direct media display if we have media_url */
                    <div>
                      <a
                        href={post.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'block', position: 'relative' }}
                      >
                        {post.media_type === 'VIDEO'  ? (
                          <video
                            src={post.media_url}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover'
                            }}
                            muted
                            loop
                            playsInline
                            onMouseOver={(e) => e.currentTarget.play()}
                            onMouseOut={(e) => {
                              e.currentTarget.pause();
                              e.currentTarget.currentTime = 0;
                            }}
                          />
                        ) : (
                          <img
                            src={post.media_url}
                            alt={post.caption || t('instagram.postN', { n: index + 1 })}
                            style={{
                              height: '100%',
                              width: '100%',
                              objectFit: 'cover'
                            }}
                            loading="lazy"
                          />
                        )}
                        
                        {/* Overlay gradient */}
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: '100px',
                            background: 'linear-gradient(transparent, rgba(0,0,0,0.5))',
                            pointerEvents: 'none'
                          }}
                        />
                        
                        {/* Instagram badge */}
                        <div
                          style={{
                            position: 'absolute',
                            top: '16px',
                            right: '16px',
                            background: 'linear-gradient(135deg, #833AB4, #FD1D1D)',
                            borderRadius: '12px',
                            padding: '10px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                          }}
                        >
                          <Instagram size={22} color="white" />
                        </div>
                        
                        {/* View on Instagram hint */}
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '16px',
                            left: '16px',
                            color: 'white',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}
                        >
                          <span>{t('instagram.viewOnInstagram')}</span>
                          <span className="sr-only">{t('a11y.opensInNewTab')}</span>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
                            <path d="M7 17L17 7M17 7H7M17 7V17"/>
                          </svg>
                        </div>
                      </a>
                      
                      {/* Caption */}
                      {post.caption && (
                        <div style={{ padding: '1.25rem' }}>
                          <p
                            style={{
                              fontSize: '0.9rem',
                              color: '#374151',
                              lineHeight: '1.6',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              margin: 0
                            }}
                          >
                            {post.caption}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* For manually added posts without media, use iframe embed */
                    <div style={{ 
                      overflow: 'hidden', 
                      borderRadius: '12px',
                      width: '400px',
                      maxWidth: '100%'
                    }}>
                      <iframe
                        src={`${post.permalink}embed/`}
                        style={{
                          width: '100%',
                          height: '50vh',
                          border: 'none',
                          background: 'white',
                        }}
                        scrolling="no"
                        allowtransparency="true"
                        allow="encrypted-media; fullscreen"
                        allowFullScreen
                        title={t('instagram.postN', { n: index + 1 })}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* See More Button */}
            <div style={{ textAlign: 'center', marginTop: '3rem' }}>
              <a
                href={INSTAGRAM_PROFILE_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '1rem 2.5rem',
                  background: 'white',
                  border: '2px solid #E5E7EB',
                  color: '#374151',
                  textDecoration: 'none',
                  borderRadius: '50px',
                  fontWeight: '600',
                  fontSize: '1rem',
                  transition: 'transform 0.3s ease, border-color 0.3s ease, color 0.3s ease',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#E11D48';
                  e.currentTarget.style.color = '#E11D48';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(225,29,72,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#E5E7EB';
                  e.currentTarget.style.color = '#374151';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                }}
              >
                {t('instagram.viewMore')}
                <span className="sr-only">{t('a11y.opensInNewTab')}</span>
                <Instagram size={20} />
              </a>
            </div>
          </>
        )}
      </div>
      )}
    </div>
  );
};

export default InstagramFeed;
