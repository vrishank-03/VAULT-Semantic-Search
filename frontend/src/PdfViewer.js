import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { FiX, FiLoader } from 'react-icons/fi';

// Import the required CSS
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure the worker source
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url,
).toString();

function PdfViewer({ fileUrl, highlight, onClose }) {
  const [numPages, setNumPages] = useState(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const contentRef = useRef(null);

  // --- FIX APPLIED HERE ---
  // We memoize the file object. This prevents the <Document> component from
  // re-fetching the PDF on every re-render of this component, which was causing the infinite loop.
  const pdfFile = useMemo(() => ({ url: fileUrl }), [fileUrl]);

  // This effect sets the width of the PDF pages to fit the container.
  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) {
        setContainerWidth(entry.contentRect.width - 5);
      }
    });
    observer.observe(element);
    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, []);

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
  }

  // Effect to scroll to a highlight.
  useEffect(() => {
    if (numPages && highlight && highlight.pageNumber && contentRef.current) {
      const pageElement = contentRef.current.querySelector(`.react-pdf__Page[data-page-number="${highlight.pageNumber}"]`);
      if (pageElement) {
        pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [numPages, highlight]);

  // Highlight rendering logic.
  const renderHighlight = (page) => {
    if (!highlight || !highlight.position || highlight.pageNumber !== page.pageNumber) {
      return null;
    }
    const viewport = page.getViewport({ scale: 1 });
    const y = viewport.height - highlight.position.y - highlight.position.height;
    return (
      <div
        className="absolute bg-yellow-400/40 pointer-events-none"
        style={{
          left: `${(highlight.position.x / viewport.width) * 100}%`,
          top: `${(y / viewport.height) * 100}%`,
          width: `${(highlight.position.width / viewport.width) * 100}%`,
          height: `${(highlight.position.height / viewport.height) * 100}%`,
        }}
      />
    );
  };

  return (
    <div className="w-full max-w-4xl h-[90vh] bg-white dark:bg-gray-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
      
      {/* Sticky Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Document Viewer</h2>
        <button 
          onClick={onClose} 
          className="p-2 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
          aria-label="Close document viewer"
        >
          <FiX size={24} />
        </button>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-grow overflow-y-auto p-4 bg-gray-100 dark:bg-gray-900" ref={contentRef}>
        <Document
          file={pdfFile} // --- USING THE MEMOIZED FILE OBJECT HERE ---
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={console.error}
          loading={
            <div className="flex justify-center items-center h-full text-gray-500 dark:text-gray-400">
              <FiLoader className="animate-spin mr-2" />
              Loading document...
            </div>
          }
        >
          <div className="space-y-4">
            {Array.from(new Array(numPages), (el, index) => (
              <div key={`page_wrapper_${index + 1}`} className="flex justify-center">
                <Page
                  key={`page_${index + 1}`}
                  pageNumber={index + 1}
                  width={containerWidth ? containerWidth : undefined}
                  customTextRenderer={({ page }) => renderHighlight(page)}
                  className="shadow-md"
                />
              </div>
            ))}
          </div>
        </Document>
      </div>
    </div>
  );
}

export default PdfViewer;