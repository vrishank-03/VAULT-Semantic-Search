import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.js`;

function PdfViewer({ fileUrl, onClose }) {
  // --- LOG 3 ---
  console.log(`[PdfViewer.js] Component mounted. Received fileUrl prop: ${fileUrl}`);
  
  const [numPages, setNumPages] = useState(null);

  function onDocumentLoadSuccess({ numPages }) {
    // --- LOG 4 ---
    console.log(`[PdfViewer.js] PDF loaded successfully! It has ${numPages} pages.`);
    setNumPages(numPages);
  }

  function onDocumentLoadError(error) {
    // --- LOG 5 ---
    console.error(`[PdfViewer.js] PDF.js Document Error: ${error.message}`);
  }

  return (
    <div className="pdf-viewer-overlay">
      <div className="pdf-viewer-container">
        <button onClick={onClose} className="close-button">×</button>
        <Document
          file={{ url: fileUrl }}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
        >
          {Array.from(new Array(numPages), (el, index) => (
            <Page
              key={`page_${index + 1}`}
              pageNumber={index + 1}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          ))}
        </Document>
      </div>
    </div>
  );
}

export default PdfViewer;