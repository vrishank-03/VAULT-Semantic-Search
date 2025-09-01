import React, { useState, useEffect, useRef } from 'react';
import { uploadDocument, search } from './services/api';
import './App.css';
import PdfViewer from './PdfViewer';

// Helper to get initial messages from localStorage
const getInitialMessages = () => {
  const savedMessages = localStorage.getItem('vault_chat_history');
  if (savedMessages) {
    return JSON.parse(savedMessages);
  }
  return [{ sender: 'ai', text: 'Welcome to VAULT. Upload a document or ask me a question about your existing documents.' }];
};


function App() {
  // Load messages from localStorage on initial render
  const [messages, setMessages] = useState(getInitialMessages);
  const [input, setInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [viewingPdf, setViewingPdf] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Effect to scroll to bottom and save to localStorage whenever messages change
  useEffect(() => {
    scrollToBottom();
    // Save the entire conversation to localStorage
    localStorage.setItem('vault_chat_history', JSON.stringify(messages));
  }, [messages]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!input.trim() || isSearching) return;

    const userMessage = { sender: 'user', text: input };
    const currentHistory = [...messages, userMessage];

    setMessages([...currentHistory, { sender: 'ai', text: 'Thinking...', isLoading: true }]);
    setInput('');
    setIsSearching(true);

    try {
      const results = await search(input, currentHistory);
      const aiResponse = { 
        sender: 'ai', 
        text: results.answer,
        results: results 
      };
      setMessages(prev => [...prev.slice(0, -1), aiResponse]);
    } catch (error) {
      const errorText = error.error || 'Sorry, I encountered an error. Please try again.';
      const errorResponse = { sender: 'ai', text: errorText };
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

  const handleSourceClick = (source) => {
    setViewingPdf({ id: source.metadata.documentId });
  };

  // Function to start a new chat
  const handleNewChat = () => {
    localStorage.removeItem('vault_chat_history');
    setMessages([{ sender: 'ai', text: 'New chat started. Upload a document or ask a question.' }]);
  };

  return (
    <div className="App">
      {/* New Chat Button */}
      <button onClick={handleNewChat} className="new-chat-button">New Chat</button>

      <div className="chat-container">
        <div className="messages">
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.sender}`}>
              <div className="message-bubble">
                {msg.isLoading ? <div className="loader"></div> : <p>{msg.text}</p>}
                {msg.results && (
                  <div className="results">
                    <details>
                      <summary>Show Sources</summary>
                      {msg.results.sources.map((source, i) => (
                        <div key={i} className="result-item">
                          <p>
                            <strong 
                              onClick={() => handleSourceClick(source)}
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

      {viewingPdf && (
        <PdfViewer 
          fileUrl={`http://localhost:5000/api/documents/${viewingPdf.id}`} 
          onClose={() => setViewingPdf(null)} 
        />
      )}
    </div>
  );
}

export default App;