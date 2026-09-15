import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';
import { getMediaTitle } from './mediaTitle';

const API_BASE = process.env.REACT_APP_API_URL || "https://api.gudinocustom.com";

// VideoHeroSection Component
// Full-screen video player with thumbnail navigation
const VideoHeroSection = ({
  categoryVideos,
  currentVideoIndex,
  setCurrentVideoIndex,
  openModal,
  categoryName = ''
}) => {
  const { t } = useLanguage();
  const reduceMotion = usePrefersReducedMotion();
  // Nothing moves on its own for visitors who asked for reduced motion
  const [paused, setPaused] = useState(reduceMotion);
  const videoRef = useRef(null);

  const video = categoryVideos[currentVideoIndex];

  useEffect(() => {
    if (reduceMotion) setPaused(true);
  }, [reduceMotion]);

  // Keep the player in step with the pause/play button, including after the
  // element is replaced because another video was chosen
  useEffect(() => {
    const player = videoRef.current;
    if (!player) return;

    if (paused) {
      player.pause();
    } else {
      const started = player.play();
      if (started && typeof started.catch === 'function') {
        started.catch((error) => {
          // The browser refused to autoplay: show the play button instead
          if (error && error.name === 'NotAllowedError') setPaused(true);
        });
      }
    }
  }, [paused, video]);

  if (categoryVideos.length === 0) return null;
  if (!video) return null;

  // Parse video qualities from label field
  let qualities = null;
  try {
    if (video.label) {
      const parsed = JSON.parse(video.label);
      qualities = {};
      Object.keys(parsed).forEach(q => {
        qualities[q] = `${API_BASE}/photos/${video.category}/${parsed[q]}`;
      });
    }
  } catch (e) {
    // No qualities found, using original
  }

  // Determine video source with proper fallback chain
  let videoSrc = `${API_BASE}${video.url}`;
  let fallbackSrc = null;

  if (qualities) {
    if (qualities['720p']) {
      videoSrc = qualities['720p'];
      fallbackSrc = qualities['480p'] || qualities['360p'];
    } else if (qualities['480p']) {
      videoSrc = qualities['480p'];
      fallbackSrc = qualities['360p'];
    } else if (qualities['360p']) {
      videoSrc = qualities['360p'];
    }
  }

  const thumbnail = `${API_BASE}${video.thumbnail || video.url}`;
  const videoTitle = getMediaTitle(video) ||
    t('portfolio.videoFallback', { category: categoryName, n: currentVideoIndex + 1 });
  const openFullScreen = () => openModal(videoSrc, videoTitle, true, qualities);

  return (
    <div className="video-hero-fullscreen">
      <div className="video-hero-container">
        {/* Main Video Player */}
        <div className="video-player-wrapper">
          <video
            key={videoSrc}
            ref={videoRef}
            className="hero-video-player"
            autoPlay={!paused}
            loop
            muted
            playsInline
            poster={thumbnail}
            aria-label={videoTitle}
            onClick={openFullScreen}
            onError={(e) => {
              if (fallbackSrc && e.target.src !== fallbackSrc) {
                e.target.src = fallbackSrc;
              }
            }}
          >
            <source src={videoSrc} type="video/webm" />
            {fallbackSrc && <source src={fallbackSrc} type="video/webm" />}
            {t('video.unsupported')}
          </video>

          {/* Expand hint (shown on hover and on keyboard focus); the button below
              does the same job for everyone else */}
          <div className="video-expand-hint" aria-hidden="true">
            {t('video.expandHint')}
          </div>

          {/* Pause / play (WCAG 2.2.2) */}
          <button
            type="button"
            className="video-ctrl-btn video-ctrl-toggle"
            onClick={() => setPaused((prev) => !prev)}
            aria-label={paused ? t('video.play') : t('video.pause')}
          >
            {paused ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden="true" focusable="false">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden="true" focusable="false">
                <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
              </svg>
            )}
          </button>

          {/* Open the full-screen viewer without a mouse */}
          <button
            type="button"
            className="video-ctrl-btn video-ctrl-expand"
            onClick={openFullScreen}
            aria-haspopup="dialog"
            aria-label={t('portfolio.openFullScreen')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" aria-hidden="true" focusable="false">
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </svg>
          </button>

          {/* Navigation Buttons */}
          {categoryVideos.length > 1 && (
            <>
              <button
                type="button"
                className="video-nav-btn video-nav-prev"
                onClick={() => setCurrentVideoIndex((prev) =>
                  prev === 0 ? categoryVideos.length - 1 : prev - 1
                )}
                disabled={categoryVideos.length <= 1}
                aria-label={t('video.previous')}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white" aria-hidden="true" focusable="false">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
              </button>
              <button
                type="button"
                className="video-nav-btn video-nav-next"
                onClick={() => setCurrentVideoIndex((prev) =>
                  prev === categoryVideos.length - 1 ? 0 : prev + 1
                )}
                disabled={categoryVideos.length <= 1}
                aria-label={t('video.next')}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white" aria-hidden="true" focusable="false">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Thumbnail Navigation */}
        {categoryVideos.length > 1 && (
          <div className="video-thumbnails-nav">
            {categoryVideos.map((vid, idx) => {
              const thumbSrc = `${API_BASE}${vid.thumbnail || vid.url}`;
              const thumbTitle = getMediaTitle(vid) ||
                t('portfolio.videoFallback', { category: categoryName, n: idx + 1 });
              return (
                <button
                  key={vid.id || idx}
                  type="button"
                  className={`video-thumb ${idx === currentVideoIndex ? 'active' : ''}`}
                  aria-pressed={idx === currentVideoIndex}
                  aria-label={t('portfolio.playVideo', { title: thumbTitle })}
                  onClick={() => setCurrentVideoIndex(idx)}
                >
                  <img src={thumbSrc} alt="" loading="lazy" width="120" height="90" />
                  {idx === currentVideoIndex && (
                    <span className="video-thumb-active-indicator" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoHeroSection;
