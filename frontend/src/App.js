  import React, { useState, useEffect, useRef } from 'react';
  import { uploadDocument, search } from './services/api';
  import './App.css';
  import PdfViewer from './PdfViewer';
  import ReactMarkdown from 'react-markdown';
  import { FiPaperclip } from "react-icons/fi";
  import Toast from './Toast';

  const getInitialMessages = () => {
    const savedMessages = localStorage.getItem('vault_chat_history');
    if (savedMessages) {
      return JSON.parse(savedMessages);
    }
    return [{ sender: 'ai', text: 'Welcome to VAULT. Upload a document or ask me a question about your existing documents.' }];
  };


  function App() {
    const [messages, setMessages] = useState(getInitialMessages);
    const [input, setInput] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [viewingPdf, setViewingPdf] = useState(null);
    const [toast, setToast] = useState(null);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
      scrollToBottom();
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
        const aiResponse = { sender: 'ai', text: results.answer, results: results };
        setMessages(prev => [...prev.slice(0, -1), aiResponse]);
      } catch (error) {
        const errorText = error.error || 'Sorry, I encountered an error.';
        const errorResponse = { sender: 'ai', text: errorText };
        setMessages(prev => [...prev.slice(0, -1), errorResponse]);
      } finally {
        setIsSearching(false);
      }
    };

// const handleFileUpload = async (e) => {
//     const files = Array.from(e.target.files);
//     if (files.length === 0) return;

//     setToast({ message: `Uploading ${files.length} document(s)...`, type: 'info' }); // Use 'info' type for neutral upload message

//     try {
//       const result = await uploadDocument(files); // Pass the array of files
//       // Professional success toast
//       setToast({ message: `Upload successful. ${result.documentIds.length} document(s) processed.`, type: 'success' });
//     } catch (error) {
//       // Professional error toast
//       setToast({ message: `Upload failed. Please try again.`, type: 'error' });
//       console.error("Upload error:", error); // Keep console error for debugging
//     }
//   };

const handleFileUpload = async (e) => {
    // --- LOG 1: FUNCTION TRIGGERED ---
    console.log("[App.js] STEP 1: handleFileUpload triggered by file input change.");
    
    const files = Array.from(e.target.files);
    
    // --- LOG 2: FILES CAPTURED ---
    console.log(`[App.js] STEP 2: Captured ${files.length} file(s) from the event.`, files);

    if (files.length === 0) {
      console.log("[App.js] No files were selected. Exiting function.");
      return;
    }

    setToast({ message: `Uploading ${files.length} document(s)...`, type: 'info' });

    try {
      // --- LOG 3: CALLING API SERVICE ---
      console.log("[App.js] STEP 3: Calling the uploadDocument API service with the captured files.");
      const result = await uploadDocument(files);
      
      // --- LOG 4: API SERVICE SUCCEEDED ---
      console.log("[App.js] STEP 4: uploadDocument service returned successfully. Result:", result);
      
      // Professional success toast
      setToast({ message: `Upload successful. ${result.documentIds.length} document(s) processed.`, type: 'success' });
    } catch (error) {
      // --- LOG 5: API SERVICE FAILED ---
      console.error("[App.js] STEP 5: Caught an error from the uploadDocument service.", error);
      
      // Professional error toast
      setToast({ message: `Upload failed. Please check the console for details.`, type: 'error' });
    }
  };

    const handleSourceClick = (source) => {
      setViewingPdf({ id: source.metadata.documentId });
    };

    const handleNewChat = () => {
      localStorage.removeItem('vault_chat_history');
      setMessages([{ sender: 'ai', text: 'New chat started. Upload a document or ask a question.' }]);
    };

    return (
      <div className="App">
              {toast && (
          <Toast 
            message={toast.message} 
            type={toast.type} 
            onClose={() => setToast(null)} 
          />
        )}

        <button onClick={handleNewChat} className="new-chat-button">New Chat</button>
        <div className="chat-container">
          <div className="messages">
            {messages.map((msg, index) => (
              <div key={index} className={`message ${msg.sender}`}>
                <div className="message-bubble">
                  {msg.isLoading ? (
                    <div className="loading-dots"><div></div><div></div><div></div></div>
                  ) : (
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  )}
                  {msg.results && (
                    <div className="results">
                      <details>
                        <summary>Show Sources</summary>
                        {msg.results.sources.map((source, i) => (
                          <div key={i} className="result-item">
                            <p>
                              <strong onClick={() => handleSourceClick(source)} className="source-link">
                                Source (Doc ID: {source.metadata.documentId})
                              </strong>
                            </p>
                            {/* THIS IS THE KEY CHANGE */}
                            <div className="document-text">
                              <ReactMarkdown>{`> ${source.text}`}</ReactMarkdown>
                            </div>
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
          <label htmlFor="file-upload" className="upload-button">
            <FiPaperclip size={22} />
          </label>
          <input id="file-upload" type="file" multiple onChange={handleFileUpload} style={{ display: 'none' }} accept=".pdf" />
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