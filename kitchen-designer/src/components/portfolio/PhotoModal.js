import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

// PhotoModal Component
// Full-screen viewer for photos and videos, built on the native <dialog> so the
// rest of the page is inert, Tab stays inside, and Escape closes it.
const PhotoModal = ({
  isOpen,
  onClose,
  src,
  caption = '',
  isVideo,
  videoQualities
}) => {
  const { t } = useLanguage();
  const [selectedQuality, setSelectedQuality] = useState('720p');
  const [currentSrc, setCurrentSrc] = useState(src);
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const openerRef = useRef(null);

  // Update current src when src prop changes
  useEffect(() => {
    setCurrentSrc(src);
  }, [src]);

  // Open/close the dialog in step with the isOpen prop
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      openerRef.current = document.activeElement;
      dialog.showModal();
      if (closeButtonRef.current) closeButtonRef.current.focus();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Fires for Escape as well as our own close() calls
  const handleDialogClose = () => {
    const opener = openerRef.current;
    openerRef.current = null;
    onClose();
    // Send focus back to whatever opened the viewer
    if (opener && opener.isConnected && typeof opener.focus === 'function') {
      opener.focus();
    }
  };

  const requestClose = () => {
    const dialog = dialogRef.current;
    if (dialog && dialog.open) dialog.close();
  };

  const handleQualityChange = (e) => {
    const quality = e.target.value;
    setSelectedQuality(quality);
    if (videoQualities && videoQualities[quality]) {
      setCurrentSrc(videoQualities[quality]);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="modal active portfolio-viewer"
      aria-label={isVideo ? t('portfolio.videoViewer') : t('portfolio.viewer')}
      onClose={handleDialogClose}
      onClick={requestClose}
    >
      {isOpen && (
        <>
          <button
            type="button"
            ref={closeButtonRef}
            className="modal-close"
            onClick={requestClose}
            aria-label={t('a11y.close')}
          >
            <span aria-hidden="true">&times;</span>
          </button>
          {isVideo ? (
            <div onClick={(e) => e.stopPropagation()}>
              {/* Quality selector */}
              {videoQualities && (
                <div style={{
                  position: 'absolute',
                  top: '60px',
                  right: '20px',
                  zIndex: 10
                }}>
                  <select
                    value={selectedQuality}
                    onChange={handleQualityChange}
                    aria-label={t('portfolio.videoQuality')}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'rgba(0,0,0,0.8)',
                      color: 'white',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="720p">720p (HD)</option>
                    <option value="480p">480p (SD)</option>
                    <option value="360p">{`360p (${t('portfolio.qualityLow')})`}</option>
                  </select>
                </div>
              )}
              <video
                className="modal-content"
                controls
                autoPlay
                loop
                preload="metadata"
                aria-label={caption || t('portfolio.video')}
                style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }}
                key={currentSrc}
              >
                <source src={currentSrc} type="video/webm" />
                {t('video.unsupported')}
              </video>
            </div>
          ) : (
            <img className="modal-content" src={currentSrc} alt={caption || t('portfolio.photo')} />
          )}
        </>
      )}
    </dialog>
  );
};

export default PhotoModal;
