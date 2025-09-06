import React, { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// Import the required CSS for this specific version of react-pdf
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure the worker source correctly for this version
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url,
).toString();

function PdfViewer({ fileUrl, highlight, onClose }) {
  const [numPages, setNumPages] = useState(null);
  const containerRef = useRef(null);

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
  }
  
  // Effect to handle scrolling to the highlighted page once the document loads
  useEffect(() => {
    if (numPages && highlight && highlight.pageNumber && containerRef.current) {
      const pageElement = containerRef.current.querySelector(`.react-pdf__Page[data-page-number="${highlight.pageNumber}"]`);
      if (pageElement) {
        pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [numPages, highlight]);
  
  // Custom renderer function to draw the highlight box
  const renderHighlight = (page) => {
    if (!highlight || !highlight.position || highlight.pageNumber !== page.pageNumber) {
      return null;
    }
    
    // PDF coordinates start from the bottom-left, so we convert for CSS
    const viewport = page.getViewport({ scale: 1 });
    const y = viewport.height - highlight.position.y - highlight.position.height;

    return (
      <div 
        className="highlight-layer"
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
    <div className="pdf-viewer-overlay">
      <div className="pdf-viewer-container" ref={containerRef}>
        <button onClick={onClose} className="close-button">×</button>
        <Document
          file={{ url: fileUrl }}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={console.error}
        >
          {Array.from(new Array(numPages), (el, index) => (
            <Page
              key={`page_${index + 1}`}
              pageNumber={index + 1}
              // The text layer is enabled by default, allowing interaction.
              // We use customTextRenderer to add our highlight layer.
              customTextRenderer={({ page }) => renderHighlight(page)}
            />
          ))}
        </Document>
      </div>
    </div>
  );
}

export default PdfViewer;