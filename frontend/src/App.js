import React, { useState } from 'react';
import { testSystemPipeline } from './services/api';
import './App.css';

function App() {
  const [pipelineStatus, setPipelineStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleTestClick = async () => {
    setIsLoading(true);
    setPipelineStatus({ status: "Testing..." });
    const result = await testSystemPipeline();
    setPipelineStatus(result);
    setIsLoading(false);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>VAULT Walking Skeleton Test</h1>
        <p>Click the button to test the end-to-end system connection.</p>
        <button onClick={handleTestClick} disabled={isLoading}>
          {isLoading ? 'Testing in Progress...' : 'Test Pipeline'}
        </button>
        {pipelineStatus && (
          <pre>
            {JSON.stringify(pipelineStatus, null, 2)}
          </pre>
        )}
      </header>
    </div>
  );
}

export default App;