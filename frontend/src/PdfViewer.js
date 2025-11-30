// frontend/src/PdfViewer.js
// --------------------------------------------------------
// [STYLE] Enterprise "Zinc" Theme - Sleek, Dark Mode Native
// [FEATURE] Added Zoom, Rotate, Download, and "Back to Library" controls
// --------------------------------------------------------

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
  FiX, FiLoader, FiZoomIn, FiZoomOut, FiRotateCw,
  FiDownload, FiChevronLeft, FiGrid, FiMaximize
} from 'react-icons/fi';
import { motion } from 'framer-motion';

// Import required CSS for React-PDF
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url,
).toString();

function PdfViewer({ fileUrl, highlight, onClose, onReturnToLibrary }) {
  const [numPages, setNumPages] = useState(null);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isFitToWidth, setIsFitToWidth] = useState(true);

  const contentRef = useRef(null);
  const pdfFile = useMemo(() => ({ url: fileUrl }), [fileUrl]);

  // --- RESIZE OBSERVER (Responsive) ---
  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
  }

  // --- CONTROLS ---
  const handleZoomIn = () => {
    setIsFitToWidth(false);
    setScale(prev => Math.min(prev + 0.2, 3.0));
  };

  const handleZoomOut = () => {
    setIsFitToWidth(false);
    setScale(prev => Math.max(prev - 0.2, 0.5));
  };

  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  const handleFitWidth = () => {
    setIsFitToWidth(true);
    setScale(1.0);
  };

  // --- SCROLL TO HIGHLIGHT ---
  useEffect(() => {
    if (numPages && highlight && highlight.pageNumber && contentRef.current) {
      setTimeout(() => {
        const pageElement = contentRef.current.querySelector(
          `.react-pdf__Page[data-page-number="${highlight.pageNumber}"]`
        );
        if (pageElement) {
          pageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500); // Slight delay to ensure render
    }
  }, [numPages, highlight]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="w-full max-w-6xl h-[92vh] bg-white dark:bg-[#0f0f11] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-zinc-200 dark:border-zinc-800"
    >

      {/* --- HEADER / TOOLBAR --- */}
      <div className="flex-shrink-0 h-16 px-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white/50 dark:bg-[#111]/90 backdrop-blur-md z-10">

        {/* Left: Navigation */}
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
            title="Close Viewer"
          >
            <FiChevronLeft size={20} />
            <span className="text-sm font-medium">Back</span>
          </button>

          {/* Optional: Return to Library Button if prop provided */}
          {onReturnToLibrary && (
            <>
              <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-700" />
              <button
                onClick={() => { onClose(); onReturnToLibrary(); }}
                className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
              >
                <FiGrid size={18} />
                <span className="text-sm font-medium">Library</span>
              </button>
            </>
          )}
        </div>

        {/* Center: Controls */}
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <button onClick={handleZoomOut} className="p-2 rounded hover:bg-white dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-all" title="Zoom Out">
            <FiZoomOut size={16} />
          </button>
          <span className="text-xs font-mono w-12 text-center text-zinc-500">
            {isFitToWidth ? 'AUTO' : `${Math.round(scale * 100)}%`}
          </span>
          <button onClick={handleZoomIn} className="p-2 rounded hover:bg-white dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-all" title="Zoom In">
            <FiZoomIn size={16} />
          </button>
          <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-1" />
          <button onClick={handleFitWidth} className="p-2 rounded hover:bg-white dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-all" title="Fit Width">
            <FiMaximize size={16} />
          </button>
          <button onClick={handleRotate} className="p-2 rounded hover:bg-white dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-all" title="Rotate">
            <FiRotateCw size={16} />
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <a
            href={fileUrl}
            download
            className="p-2 text-zinc-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 transition-colors"
            title="Download PDF"
          >
            <FiDownload size={20} />
          </a>
          <button
            onClick={onClose}
            className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-red-100 dark:hover:bg-red-900/30 text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 rounded-full transition-colors"
          >
            <FiX size={20} />
          </button>
        </div>
      </div>

      {/* --- CONTENT AREA --- */}
      <div className="flex-grow overflow-y-auto bg-zinc-50 dark:bg-[#0a0a0a] relative" ref={contentRef}>
        <div className="min-h-full flex justify-center p-8">
          <Document
            file={pdfFile}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={console.error}
            loading={
              <div className="flex flex-col items-center justify-center h-64 text-zinc-400 space-y-4">
                <FiLoader className="animate-spin" size={32} />
                <span className="text-sm font-medium">Rendering secure document...</span>
              </div>
            }
            className="outline-none"
          >
            <div className="space-y-6">
              {Array.from(new Array(numPages), (el, index) => (
                <div key={`page_wrapper_${index + 1}`} className="relative shadow-lg dark:shadow-black/50 transition-shadow">
                  <Page
                    key={`page_${index + 1}`}
                    pageNumber={index + 1}
                    width={isFitToWidth ? (containerWidth - 64) : undefined}
                    scale={isFitToWidth ? 1.0 : scale}
                    rotate={rotation}
                    className="bg-white"
                    renderAnnotationLayer={true}
                    renderTextLayer={true}
                  />
                  {/* Page Number Indicator */}
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-zinc-400 font-mono">
                    Page {index + 1}
                  </div>
                </div>
              ))}
            </div>
          </Document>
        </div>
      </div>
    </motion.div>
  );
}

export default PdfViewer;