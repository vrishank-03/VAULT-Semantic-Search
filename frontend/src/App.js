import React, { useState } from 'react';
import { uploadDocument } from './services/api';
import './App.css';

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
    setMessage('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedFile) {
      setMessage('Please select a file first.');
      return;
    }

    setIsLoading(true);
    setMessage('Uploading and processing... This may take a moment.');

    try {
      const result = await uploadDocument(selectedFile);
      setMessage(`Success! Document processed. Document ID: ${result.documentId}, Chunks: ${result.chunks}`);
    } catch (error) {
      setMessage(`Error: ${error.error || 'Failed to upload.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Upload a Document to VAULT</h1>
        <form onSubmit={handleSubmit}>
          <input type="file" onChange={handleFileChange} accept=".pdf" />
          <button type="submit" disabled={isLoading || !selectedFile}>
            {isLoading ? 'Processing...' : 'Upload'}
          </button>
        </form>
        {message && (
          <p className="message">{message}</p>
        )}
      </header>
    </div>
  );
}

export default App;