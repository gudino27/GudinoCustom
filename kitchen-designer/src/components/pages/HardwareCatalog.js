import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import "../css/sms-compliance.css";
import "../css/hardware-catalog.css";
import "../css/home.css";
import Navigation from "../ui/Navigation";
import Footer from "../ui/Footer";
import SEO from "../ui/SEO";
import { useLanguage } from "../../contexts/LanguageContext";
import { Download, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@5.7.284/build/pdf.worker.min.mjs`;

// The text layer is positioned in percentages of the PDF page, so it only needs
// to know how many CSS pixels one PDF unit is worth at the page's current size.
const syncTextLayerScale = (pageEl) => {
  if (!pageEl) return;
  const baseWidth = Number(pageEl.dataset.baseWidth);
  const width = pageEl.getBoundingClientRect().width;
  if (baseWidth > 0 && width > 0) {
    pageEl.style.setProperty('--total-scale-factor', String(width / baseWidth));
  }
};

const HardwareCatalog = () => {
  const { t } = useLanguage();
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageCount, setPageCount] = useState(0);

  // Set scale based on screen size for better mobile visibility
  const getInitialScale = () => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 640) return 2.2; // Mobile - larger scale for readability
      if (window.innerWidth < 1024) return 2.0; // Tablet
      return 1.8; // Desktop
    }
    return 1.8;
  };

  const [scale, setScale] = useState(getInitialScale());
  const [loading, setLoading] = useState(true);
  const [canvasRefs, setCanvasRefs] = useState([]);
  const [textLayerRefs, setTextLayerRefs] = useState([]);
  const [renderTasks, setRenderTasks] = useState({});
  const renderedTextLayers = useRef(new Set());

  useEffect(() => {
    // Load PDF document
    const loadPdf = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument('/documents/GUDINO-CWW-Handle-Catalog.pdf');
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setPageCount(pdf.numPages);

        // Create canvas and text-layer refs for all pages
        const refs = Array(pdf.numPages).fill(null).map(() => React.createRef());
        setCanvasRefs(refs);
        setTextLayerRefs(Array(pdf.numPages).fill(null).map(() => React.createRef()));

        setLoading(false);
      } catch (error) {
        console.error('Error loading PDF:', error);
        setLoading(false);
      }
    };

    loadPdf();

    return () => {
      // drops the off-screen canvases pdf.js uses to measure text
      pdfjsLib.TextLayer.cleanup();
    };
  }, []);

  // Adjust scale on window resize
  useEffect(() => {
    const handleResize = () => {
      setScale(getInitialScale());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const renderAll = async () => {
      if (!pdfDoc || canvasRefs.length === 0) return;

      for (let i = 1; i <= pageCount; i++) {
        await renderPage(i, canvasRefs[i - 1]);
      }
    };

    renderAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc, scale, canvasRefs, pageCount]);

  // Real text over each page, so the catalog can be read by a screen reader,
  // searched and selected instead of being pixels only (WCAG 1.1.1 / 1.4.5)
  useEffect(() => {
    if (!pdfDoc || textLayerRefs.length === 0) return undefined;

    let cancelled = false;
    const renderTextLayers = async () => {
      for (let num = 1; num <= pageCount; num++) {
        if (cancelled) return;
        const container = textLayerRefs[num - 1]?.current;
        if (!container || renderedTextLayers.current.has(num)) continue;
        renderedTextLayers.current.add(num);
        try {
          const page = await pdfDoc.getPage(num);
          // page 1 is forced upright to match the canvas below it
          const viewport = page.getViewport(num === 1 ? { scale: 1, rotation: 0 } : { scale: 1 });
          const textContent = await page.getTextContent({ includeMarkedContent: true });
          const textLayer = new pdfjsLib.TextLayer({
            textContentSource: textContent,
            container,
            viewport
          });
          await textLayer.render();
          syncTextLayerScale(container.parentElement);
        } catch (error) {
          renderedTextLayers.current.delete(num);
          console.error('Error rendering text layer:', error);
        }
      }
    };

    renderTextLayers();
    return () => { cancelled = true; };
  }, [pdfDoc, pageCount, textLayerRefs]);

  // Keep the text layer lined up with the canvas as the page is resized
  useEffect(() => {
    if (canvasRefs.length === 0 || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver((entries) => {
      entries.forEach((entry) => syncTextLayerScale(entry.target));
    });
    canvasRefs.forEach((ref) => {
      const pageEl = ref.current?.parentElement;
      if (pageEl) observer.observe(pageEl);
    });

    return () => observer.disconnect();
  }, [canvasRefs]);

  const renderPage = async (num, canvasRef) => {
    if (!pdfDoc || !canvasRef || !canvasRef.current) return;

    // Cancel any existing render task for this page
    if (renderTasks[num]) {
      renderTasks[num].cancel();
    }

    try {
      const page = await pdfDoc.getPage(num);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      // Get page rotation - for first page only, force 0 rotation to fix desktop issue
      // For other pages, use natural rotation
      const pageRotation = num === 1 ? 0 : undefined;
      const viewportOptions = { scale };
      if (pageRotation !== undefined) {
        viewportOptions.rotation = pageRotation;
      }

      const viewport = page.getViewport(viewportOptions);

      // Set canvas dimensions
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Clear canvas before rendering
      context.clearRect(0, 0, canvas.width, canvas.height);

      const pageEl = canvas.parentElement;
      if (pageEl) {
        pageEl.dataset.baseWidth = String(viewport.width / viewport.scale);
        syncTextLayerScale(pageEl);
      }

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      // Store the render task so we can cancel it if needed
      const renderTask = page.render(renderContext);
      setRenderTasks(prev => ({ ...prev, [num]: renderTask }));

      await renderTask.promise;

      // Clear the task after successful render
      setRenderTasks(prev => {
        const newTasks = { ...prev };
        delete newTasks[num];
        return newTasks;
      });
    } catch (error) {
      if (error.name !== 'RenderingCancelledException') {
        console.error('Error rendering page:', error);
      }
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = '/documents/GUDINO-CWW-Handle-Catalog.pdf';
    link.download = 'GUDINO-Hardware-Catalog.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenNewTab = () => {
    window.open('/documents/GUDINO-CWW-Handle-Catalog.pdf', '_blank');
  };

  const zoomIn = () => {
    setScale(Math.min(scale + 0.25, 3));
  };

  const zoomOut = () => {
    setScale(Math.max(scale - 0.25, 0.5));
  };

  return (
    <>
      <SEO
        title={t('seo.hardware.title')}
        description="Browse our exclusive collection of premium cabinet handles and pulls. From modern Skyline to classic Heritage collections, find the perfect hardware for your custom cabinets."
        keywords="cabinet hardware, cabinet pulls, cabinet handles, kitchen hardware, bathroom hardware, premium hardware, cabinet knobs"
        canonical="https://gudinocustom.com/hardware-catalog"
      />
      <div className="catalog-page" style={{ background: "rgb(110,110,110)", minHeight: "100vh", paddingTop: "80px" }}>
        <Navigation />

        <main id="main-content" tabIndex={-1} className="catalog-container" style={{
          maxWidth: "1600px",
          margin: "0 auto",
          padding: "0 1rem"
        }}>
          <h1 className="catalog-heading">{t('hardware.heading')}</h1>

          {/* PDF Scrollable Viewer */}
          <div
            className="pdf-scroll-container"
            tabIndex={0}
            role="region"
            aria-label={t('hardware.region')}
            style={{
              background: "transparent",
              borderRadius: "0.5rem",
              overflow: "auto",
              marginBottom: "2rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "1.5rem",
              padding: "1rem 0",
              maxHeight: "calc(100vh - 100px)"
            }}
          >
            {loading ? (
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "4rem",
                color: "#ffffff"
              }}>
                <div style={{
                  width: "50px",
                  height: "50px",
                  border: "4px solid rgba(255, 255, 255, 0.3)",
                  borderTopColor: "#3b82f6",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                  marginBottom: "1rem"
                }}></div>
                <p>{t('hardware.loading')}</p>
              </div>
            ) : pdfDoc ? (
              <>
                {canvasRefs.map((ref, index) => (
                  <div
                    key={index}
                    className="pdf-page"
                    role="group"
                    aria-label={t('hardware.pageLabel', { n: index + 1, total: pageCount })}
                  >
                    <canvas
                      ref={ref}
                      className="pdf-page-canvas"
                      aria-hidden="true"
                    />
                    <div ref={textLayerRefs[index]} className="textLayer" />
                  </div>
                ))}
              </>
            ) : (
              <div role="alert" style={{
                padding: "2rem",
                textAlign: "center",
                color: "#ffffff",
                background: "rgba(0, 0, 0, 0.5)",
                borderRadius: "0.5rem"
              }}>
                <p style={{ fontWeight: "600", marginBottom: "1rem" }}>
                  {t('hardware.loadFailed')}
                </p>
                <p style={{ marginBottom: "2rem" }}>
                  {t('hardware.tryDownload')}
                </p>
                <button
                  type="button"
                  onClick={handleDownload}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.75rem 1.5rem",
                    backgroundColor: "#047857",
                    color: "white",
                    border: "none",
                    borderRadius: "0.5rem",
                    fontSize: "0.875rem",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  <Download size={18} />
                  {t('hardware.downloadPdf')}
                </button>
              </div>
            )}
          </div>

          {/* Download Button */}
          <div className="feature-button" style={{ textAlign: "center", marginBottom: "2rem" }}>
            <button
              type="button"
              onClick={handleDownload}
              className="cta-button"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.75rem",
              }}
            >
              <Download size={24} />
              {t('hardware.downloadFull')}
            </button>
          </div>

          {/* Info Box */}
          <div style={{
            textAlign: "center",
            marginBottom: "2rem",
            padding: "1rem",
            background: "rgba(0, 0, 0, 0.4)",
            borderRadius: "0.5rem",
            border: "1px solid rgba(0, 0, 0, 0.3)",
            color: "white"
          }}>
            <p style={{ margin: 0, fontSize: "0.95rem" }}>
              <strong>{t('hardware.assistTitle')}</strong><br />
              {t('hardware.assistText')}
            </p>
          </div>
        </main>

        <div style={{ height: "2vh" }}></div>
      </div>
      <Footer />
    </>
  );
};

export default HardwareCatalog;
