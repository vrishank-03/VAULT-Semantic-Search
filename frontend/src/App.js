import React, { useState, useEffect, useRef } from 'react';
import { uploadDocument, search } from './services/api';
import './App.css';
import PdfViewer from './PdfViewer';

function App() {
  const [messages, setMessages] = useState([
    { sender: 'ai', text: 'Welcome to VAULT. Upload a document or ask me a question about your existing documents.' }
  ]);
  const [input, setInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const messagesEndRef = useRef(null);
  const [viewingPdf, setViewingPdf] = useState(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!input.trim() || isSearching) return;
    const userMessage = { sender: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsSearching(true);
    try {
      setMessages(prev => [...prev, { sender: 'ai', text: 'Thinking...', isLoading: true }]);
      const results = await search(input);
      const aiResponse = { sender: 'ai', results: results };
      setMessages(prev => [...prev.slice(0, -1), aiResponse]);
    } catch (error) {
      const errorResponse = { sender: 'ai', text: 'Sorry, I encountered an error. Please try again.' };
      setMessages(prev => [...prev.slice(0, -1), errorResponse]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setMessages(prev => [...prev, { sender: 'system', text: `Uploading ${file.name}...`, isLoading: true }]);
    try {
      const result = await uploadDocument(file);
      const successMessage = { sender: 'system', text: `✅ Successfully uploaded ${file.name}. Document ID: ${result.documentId}` };
      setMessages(prev => [...prev.slice(0, -1), successMessage]);
    } catch (error) {
      const errorMessage = { sender: 'system', text: `❌ Failed to upload ${file.name}.` };
      setMessages(prev => [...prev.slice(0, -1), errorMessage]);
    }
  };

  const handleSourceClick = (id) => {
    // --- LOG 1 ---
    console.log(`[App.js] Source link clicked. Setting PDF to view with ID: ${id}`);
    setViewingPdf({ id: id });
  };

  return (
    <div className="App">
      <div className="chat-container">
        <div className="messages">
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.sender}`}>
              <div className="message-bubble">
                {msg.isLoading ? <div className="loader"></div> : <p>{msg.text}</p>}
                {msg.results && (
                  <div className="results">
                    <p>{msg.results.answer}</p>
                    <details>
                      <summary>Show Sources</summary>
                      {msg.results.sources.map((source, i) => (
                        <div key={i} className="result-item">
                          <p>
                            <strong 
                              onClick={() => handleSourceClick(source.metadata.documentId)} 
                              style={{cursor: 'pointer', color: '#00aaff', textDecoration: 'underline'}}
                            >
                              Source (Doc ID: {source.metadata.documentId})
                            </strong>
                          </p>
                          <p className="document-text">"{source.text}"</p>
                        </div>
                      ))}
                    </details>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      <div className="input-form">
        <label htmlFor="file-upload" className="upload-button">📎</label>
        <input id="file-upload" type="file" onChange={handleFileUpload} style={{ display: 'none' }} accept=".pdf" />
        <form onSubmit={handleSearch} style={{ flexGrow: 1, display: 'flex' }}>
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question..." disabled={isSearching} />
          <button type="submit" disabled={isSearching || !input.trim()}>Send</button>
        </form>
      </div>

      {viewingPdf && (() => {
        const fileUrl = `http://localhost:5000/api/documents/${viewingPdf.id}`;
        // --- LOG 2 ---
        console.log(`[App.js] Rendering PdfViewer component with URL: ${fileUrl}`);
        return (
          <PdfViewer 
            fileUrl={fileUrl} 
            onClose={() => setViewingPdf(null)} 
          />
        );
      })()}
    </div>
  );
}

export default App;