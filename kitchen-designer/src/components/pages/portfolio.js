import React, { useEffect, useState, useCallback, useMemo } from "react";
import "../css/portfolio.css";
import Navigation from "../ui/Navigation";
import Footer from "../ui/Footer";
import SEO from "../ui/SEO";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAnalytics } from "../../hooks/useAnalytics";
import BeforeAfterCarousel from "../ui/BeforeAfterCarousel";
import InstagramFeed from "../ui/InstagramFeed";

// Import portfolio components
import {
  CategorySelector,
  PageNavigation,
  Carousel3D,
  GridView,
  VideoHeroSection,
  PhotoModal
} from "../portfolio";

const API_BASE = process.env.REACT_APP_API_URL || "https://api.gudinocustom.com";

const Portfolio = () => {
  // Analytics tracking
  useAnalytics("/portfolio");

  // Language context
  const { t } = useLanguage();

  // State
  const [allPhotos, setAllPhotos] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [currentCategory, setCurrentCategory] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rotationAngle, setRotationAngle] = useState(0);
  const [categoryVideos, setCategoryVideos] = useState([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [allCategoryPhotos, setAllCategoryPhotos] = useState([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [savedPositions, setSavedPositions] = useState({});
  const [viewMode, setViewMode] = useState('grid');
  const [beforeAfterPairs, setBeforeAfterPairs] = useState([]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSrc, setModalSrc] = useState("");
  const [modalIsVideo, setModalIsVideo] = useState(false);
  const [modalVideoQualities, setModalVideoQualities] = useState(null);

  // Constants
  const radius = 350;
  const PHOTOS_PER_PAGE = 6;
  const TRANSITION_DURATION = 300;

  const categories = useMemo(
    () => ["kitchen", "bathroom", "livingroom", "laundryroom", "bedroom", "showcase"],
    []
  );

  // Function to get translated category name
  const getCategoryName = useCallback(
    (category) => {
      const key = `portfolio.${
        category === "livingroom" ? "livingRoom" :
        category === "laundryroom" ? "laundryRoom" : category
      }`;
      return t(key);
    },
    [t]
  );

  const getAuthToken = () =>
    localStorage.getItem("authToken") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("authToken") ||
    document.cookie.split("; ").find((row) => row.startsWith("authToken="))?.split("=")[1] ||
    null;

  // Load photos from API
  const loadPhotos = useCallback(async () => {
    try {
      const token = getAuthToken();
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(`${API_BASE}/api/photos`, {
        method: "GET",
        headers,
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setAllPhotos(data);
        localStorage.setItem("cabinetPhotos", JSON.stringify(data));
      } else {
        throw new Error("API not available");
      }
    } catch (error) {
      const saved = localStorage.getItem("cabinetPhotos");
      if (saved) {
        const data = JSON.parse(saved);
        setAllPhotos(data);
      }
    }
  }, []);

  // Select category
  const selectCategory = useCallback(
    (category, resetPosition = false) => {
      setCurrentCategory(category);
      setCurrentIndex(0);
      setRotationAngle(0);

      let filtered = allPhotos.filter((photo) => {
        const str = JSON.stringify(photo).toLowerCase();
        return str.includes(category.toLowerCase());
      });

      if (filtered.length === 0) {
        filtered = allPhotos.filter(
          (photo) =>
            (photo.category && photo.category.toLowerCase() === category.toLowerCase()) ||
            (photo.label && photo.label.toLowerCase().includes(category.toLowerCase())) ||
            (photo.title && photo.title.toLowerCase().includes(category.toLowerCase()))
        );
      }

      if (filtered.length === 0) {
        filtered = allPhotos.slice(0, Math.min(3, allPhotos.length));
      }

      // Separate videos from photos
      const videos = filtered.filter(item => item.mime_type && item.mime_type.startsWith('video/'));
      const photosOnly = filtered.filter(item => !item.mime_type || !item.mime_type.startsWith('video/'));

      // Group before/after photos by comparison_pair_id
      const pairs = [];
      const pairedIds = new Set();

      photosOnly.forEach(photo => {
        if (photo.comparison_pair_id && !pairedIds.has(photo.comparison_pair_id)) {
          const beforePhoto = photosOnly.find(p =>
            p.comparison_pair_id === photo.comparison_pair_id && p.photo_type === 'before'
          );
          const afterPhoto = photosOnly.find(p =>
            p.comparison_pair_id === photo.comparison_pair_id && p.photo_type === 'after'
          );

          if (beforePhoto && afterPhoto) {
            pairs.push({ before: beforePhoto, after: afterPhoto });
            pairedIds.add(photo.comparison_pair_id);
          }
        }
      });

      setBeforeAfterPairs(pairs);
      setAllCategoryPhotos(photosOnly);

      const pages = Math.ceil(photosOnly.length / PHOTOS_PER_PAGE);
      setTotalPages(pages);

      let targetPage = 0;
      if (!resetPosition && savedPositions[category] !== undefined && savedPositions[category] >= 0) {
        targetPage = Math.min(savedPositions[category], pages - 1);
      }
      setCurrentPage(targetPage);

      const startIndex = targetPage * PHOTOS_PER_PAGE;
      const endIndex = Math.min(startIndex + PHOTOS_PER_PAGE, photosOnly.length);
      const pagePhotos = photosOnly.slice(startIndex, endIndex);

      setPhotos(pagePhotos);
      setCategoryVideos(videos);
      setCurrentVideoIndex(0);
    },
    [allPhotos, savedPositions]
  );

  // Change page in carousel
  const changePage = useCallback(
    (newPage) => {
      if (newPage < 0 || newPage >= totalPages || isTransitioning) return;
      setIsTransitioning(true);

      const carousel = document.getElementById("carousel3d");
      if (carousel) {
        carousel.style.transform = `rotateY(${-rotationAngle}deg) scale(0.9)`;
      }

      setTimeout(() => {
        setCurrentPage(newPage);
        setCurrentIndex(0);
        setRotationAngle(0);

        const startIndex = newPage * PHOTOS_PER_PAGE;
        const endIndex = Math.min(startIndex + PHOTOS_PER_PAGE, allCategoryPhotos.length);
        const pagePhotos = allCategoryPhotos.slice(startIndex, endIndex);
        setPhotos(pagePhotos);

        setTimeout(() => {
          if (carousel) {
            carousel.style.transform = `rotateY(0deg) scale(1)`;
          }
          setIsTransitioning(false);
        }, 50);
      }, TRANSITION_DURATION);
    },
    [totalPages, allCategoryPhotos, rotationAngle, isTransitioning]
  );

  // Reset to beginning
  const resetToBeginning = useCallback(() => {
    if (currentCategory) {
      setIsTransitioning(true);
      const carousel = document.getElementById("carousel3d");
      if (carousel) {
        carousel.style.transform = `rotateY(${-rotationAngle}deg) translateY(-20px)`;
      }

      setTimeout(() => {
        const newPositions = { ...savedPositions };
        delete newPositions[currentCategory];
        setSavedPositions(newPositions);
        localStorage.setItem("portfolioPositions", JSON.stringify(newPositions));
        selectCategory(currentCategory, true);

        setTimeout(() => {
          if (carousel) {
            carousel.style.transform = "rotateY(0deg) translateY(0)";
          }
          setIsTransitioning(false);
        }, 50);
      }, TRANSITION_DURATION);
    }
  }, [currentCategory, savedPositions, selectCategory, rotationAngle]);

  // Rotate carousel
  const rotateCarousel = useCallback(
    (direction) => {
      if (photos.length === 0) return;
      const angleStep = 360 / photos.length;
      setRotationAngle((prev) => prev - direction * angleStep);
      setCurrentIndex((prev) => {
        let newIndex = prev + direction;
        if (newIndex < 0) return photos.length - 1;
        if (newIndex >= photos.length) return 0;
        return newIndex;
      });
    },
    [photos.length]
  );

  // Go to specific slide
  const goToSlide = useCallback(
    (index) => {
      if (photos.length === 0) return;
      const angleStep = 360 / photos.length;
      const targetAngle = index * angleStep;
      setRotationAngle((prev) => {
        let currentAngle = prev % 360;
        let diff = targetAngle - currentAngle;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        return currentAngle + diff;
      });
      setCurrentIndex(index);
    },
    [photos.length]
  );

  // Modal handlers
  const openModal = (src, caption, isVideo = false, videoQualities = null) => {
    setModalSrc(src);
    setModalIsVideo(isVideo);
    setModalVideoQualities(videoQualities);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalSrc("");
    setModalIsVideo(false);
    setModalVideoQualities(null);
  };

  // Handle image load for dynamic sizing
  const handleImageLoad = useCallback((e, i) => {
    const img = e.target;
    const photo = photos[i];
    if (!photo) return;

    const container = img.closest('.carousel-item-3d');
    if (!container) return;

    const carouselContainer = document.querySelector('.carousel-3d-container');
    const originalImgSrc = `${API_BASE}${photo.url}`;
    const originalImg = new Image();
    const angleStep = photos.length > 0 ? 360 / photos.length : 0;

    originalImg.onload = () => {
      const width = originalImg.naturalWidth;
      const height = originalImg.naturalHeight;
      const aspectRatio = width / height;

      const isMobile = window.innerWidth <= 768;
      const isSmallMobile = window.innerWidth <= 480;

      let boxWidth, boxHeight, orientation;

      if (aspectRatio < 0.8) {
        orientation = "portrait";
        if (isSmallMobile) { boxWidth = 100; boxHeight = 180; }
        else if (isMobile) { boxWidth = 120; boxHeight = 200; }
        else { boxWidth = 150; boxHeight = 250; }
      } else if (aspectRatio < 1.2) {
        orientation = "square";
        if (isSmallMobile) { boxWidth = 160; boxHeight = 160; }
        else if (isMobile) { boxWidth = 200; boxHeight = 200; }
        else { boxWidth = 300; boxHeight = 300; }
      } else if (aspectRatio < 1.8) {
        orientation = "landscape";
        if (isSmallMobile) { boxWidth = 240; boxHeight = 120; }
        else if (isMobile) { boxWidth = 280; boxHeight = 140; }
        else { boxWidth = 400; boxHeight = 200; }
      } else {
        orientation = "panoramic";
        if (isSmallMobile) { boxWidth = 260; boxHeight = 100; }
        else if (isMobile) { boxWidth = 320; boxHeight = 120; }
        else { boxWidth = 500; boxHeight = 180; }
      }

      const marginLeft = -(boxWidth / 2);
      const marginTop = -(boxHeight / 2);
      const itemAngle = angleStep * i;

      container.style.width = `${boxWidth}px`;
      container.style.height = `${boxHeight}px`;
      container.style.marginLeft = `${marginLeft}px`;
      container.style.marginTop = `${marginTop}px`;
      container.setAttribute("data-orientation", orientation);

      if (i === currentIndex && carouselContainer) {
        carouselContainer.setAttribute("data-active-orientation", orientation);
      }

      container.style.transform = `rotateY(${itemAngle}deg) translateZ(${radius}px)`;
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";
      img.style.objectPosition = "center";
    };

    originalImg.onerror = () => {
      container.setAttribute("data-orientation", "landscape");
      if (i === currentIndex && carouselContainer) {
        carouselContainer.setAttribute("data-active-orientation", "landscape");
      }
    };

    originalImg.src = originalImgSrc;
  }, [photos, currentIndex, radius]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isTransitioning) {
        if (e.key === "ArrowLeft") rotateCarousel(-1);
        if (e.key === "ArrowRight") rotateCarousel(1);
        if (e.key === "ArrowUp") changePage(currentPage - 1);
        if (e.key === "ArrowDown") changePage(currentPage + 1);
        if (e.key === "Home" && e.ctrlKey) resetToBeginning();
        if (e.key === "Escape") closeModal();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [rotateCarousel, changePage, currentPage, resetToBeginning, isTransitioning]);

  // Update carousel container orientation
  useEffect(() => {
    const carouselContainer = document.querySelector('.carousel-3d-container');
    const activeItem = document.querySelector('.carousel-item-3d.active');

    if (carouselContainer && activeItem) {
      const orientation = activeItem.getAttribute('data-orientation') || 'landscape';
      carouselContainer.setAttribute('data-active-orientation', orientation);
    }
  }, [currentIndex]);

  // Touch/swipe support
  useEffect(() => {
    const carouselContainer = document.getElementById("carousel3dContainer");
    if (!carouselContainer) return;

    let touchStartX = 0;
    let touchEndX = 0;
    let touchStartY = 0;
    let touchEndY = 0;

    const EDGE_THRESHOLD = 50;
    const MIN_SWIPE_DISTANCE = Math.max(50, Math.min(100, window.innerWidth * 0.15));
    const MAX_VERTICAL_DISTANCE = 100;

    const handleTouchStart = (e) => {
      if (isTransitioning) return;
      const touch = e.changedTouches[0];
      touchStartX = touch.screenX;
      touchStartY = touch.screenY;

      if (touchStartX < EDGE_THRESHOLD || touchStartX > window.innerWidth - EDGE_THRESHOLD) {
        return;
      }
    };

    const handleTouchMove = (e) => {
      if (isTransitioning) return;
      const touch = e.changedTouches[0];
      const currentX = touch.screenX;
      const currentY = touch.screenY;
      const deltaX = Math.abs(currentX - touchStartX);
      const deltaY = Math.abs(currentY - touchStartY);

      if (deltaX > deltaY && deltaX > 30) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e) => {
      if (isTransitioning) return;
      const touch = e.changedTouches[0];
      touchEndX = touch.screenX;
      touchEndY = touch.screenY;

      if (touchStartX < EDGE_THRESHOLD || touchStartX > window.innerWidth - EDGE_THRESHOLD ||
          touchEndX < EDGE_THRESHOLD || touchEndX > window.innerWidth - EDGE_THRESHOLD) {
        return;
      }

      const horizontalDistance = Math.abs(touchEndX - touchStartX);
      const verticalDistance = Math.abs(touchEndY - touchStartY);

      if (horizontalDistance > MIN_SWIPE_DISTANCE && verticalDistance < MAX_VERTICAL_DISTANCE) {
        if (touchEndX < touchStartX - MIN_SWIPE_DISTANCE) {
          rotateCarousel(1);
        } else if (touchEndX > touchStartX + MIN_SWIPE_DISTANCE) {
          rotateCarousel(-1);
        }
      }
    };

    carouselContainer.addEventListener("touchstart", handleTouchStart, { passive: false });
    carouselContainer.addEventListener("touchmove", handleTouchMove, { passive: false });
    carouselContainer.addEventListener("touchend", handleTouchEnd, { passive: false });

    return () => {
      carouselContainer.removeEventListener("touchstart", handleTouchStart);
      carouselContainer.removeEventListener("touchmove", handleTouchMove);
      carouselContainer.removeEventListener("touchend", handleTouchEnd);
    };
  }, [rotateCarousel, isTransitioning]);

  // Load photos on mount
  useEffect(() => {
    loadPhotos();
    const interval = setInterval(loadPhotos, 30000);
    return () => clearInterval(interval);
  }, [loadPhotos]);

  // Auto-select first available category when photos load
  useEffect(() => {
    if (allPhotos.length > 0 && !currentCategory) {
      for (let cat of categories) {
        const match = allPhotos.find(
          (p) =>
            (p.category && p.category.toLowerCase() === cat) ||
            (p.label && p.label.toLowerCase().includes(cat))
        );
        if (match) {
          selectCategory(cat);
          break;
        }
      }
    }
  }, [allPhotos, currentCategory, selectCategory, categories]);

  // Load saved positions
  useEffect(() => {
    const saved = localStorage.getItem("portfolioPositions");
    if (saved) {
      try {
        setSavedPositions(JSON.parse(saved));
      } catch (e) {
        // Ignore error
      }
    }
  }, []);

  // Save current position
  useEffect(() => {
    if (currentCategory) {
      const newPositions = { ...savedPositions, [currentCategory]: currentPage };
      setSavedPositions(newPositions);
      localStorage.setItem("portfolioPositions", JSON.stringify(newPositions));
    }
  }, [currentPage, currentCategory]);

  return (
    <>
      <SEO
        title="Portfolio - Kitchen & Bathroom Remodeling Projects"
        description="Browse our extensive portfolio of custom kitchen cabinets, bathroom vanities, and woodworking projects in Washington. Quality craftsmanship showcased."
        keywords="kitchen portfolio, bathroom remodeling gallery, custom cabinet photos, woodworking projects, before and after, Washington remodeling"
        canonical="https://gudinocustom.com/portfolio"
      />
      <Navigation />

      {/* Category Selection */}
      <CategorySelector
        categories={categories}
        currentCategory={currentCategory}
        selectCategory={selectCategory}
        getCategoryName={getCategoryName}
        viewMode={viewMode}
        setViewMode={setViewMode}
        beforeAfterPairs={beforeAfterPairs}
        t={t}
      />

      {/* Page Navigation (only for 3D view) */}
      {viewMode === "3d" && (
        <PageNavigation
          totalPages={totalPages}
          currentPage={currentPage}
          changePage={changePage}
          resetToBeginning={resetToBeginning}
          savedPositions={savedPositions}
          currentCategory={currentCategory}
          allCategoryPhotos={allCategoryPhotos}
          isTransitioning={isTransitioning}
          PHOTOS_PER_PAGE={PHOTOS_PER_PAGE}
        />
      )}

     
      {/*
      3D Carousel View
      {viewMode === "3d" && (
        <Carousel3D
          photos={photos}
          currentIndex={currentIndex}
          rotationAngle={rotationAngle}
          isTransitioning={isTransitioning}
          goToSlide={goToSlide}
          openModal={openModal}
          handleImageLoad={handleImageLoad}
          radius={radius}
        />
      )}
      */}


      {/* Before/After Carousel View */}
      {viewMode === "beforeAfter" && beforeAfterPairs.length > 0 && (
        <div
          className="before-after-section"
          style={{
            maxWidth: "1200px",
            margin: "3rem auto",
            padding: "0 1rem",
          }}
        >
          <BeforeAfterCarousel
            photoPairs={beforeAfterPairs}
            autoPlayInterval={5000}
          />
        </div>
      )}

      {/* Grid View */}
      {viewMode === "grid" && (
        <GridView photos={allCategoryPhotos} openModal={openModal} />
      )}

      {/* Video Hero Section */}
      {categoryVideos.length > 0 && currentCategory && (
        <VideoHeroSection
          categoryVideos={categoryVideos}
          currentVideoIndex={currentVideoIndex}
          setCurrentVideoIndex={setCurrentVideoIndex}
          openModal={openModal}
        />
      )}

      {/* Photo/Video Modal */}
      <PhotoModal
        isOpen={modalOpen}
        onClose={closeModal}
        src={modalSrc}
        isVideo={modalIsVideo}
        videoQualities={modalVideoQualities}
      />

      {/* Instagram Feed Section */}
      <InstagramFeed limit={6} showTitle={true} />

      <Footer />
    </>
  );
};

export default Portfolio;
