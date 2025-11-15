# backend/embedder.py

import sys
import json
import logging
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
from sentence_transformers import SentenceTransformer

# --- Setup ---
# Set up basic logging
logging.basicConfig(level=logging.INFO, format='[%(levelname)s] [EmbedderAPI] %(message)s')

# --- Data Model ---
# This defines the expected JSON input for our API
class EmbeddingRequest(BaseModel):
    chunks: List[str]

# --- Load Model (Once at Startup) ---
logging.info("Loading sentence-transformer model 'all-MiniLM-L6-v2'...")
model = SentenceTransformer('all-MiniLM-L6-v2')
logging.info("Model loaded successfully. Ready to serve.")

# --- Create FastAPI App ---
app = FastAPI()

# --- API Endpoint ---
@app.post("/embed")
async def create_embeddings(request: EmbeddingRequest):
    """
    Receives a list of text chunks and returns their embeddings.
    """
    try:
        chunks = request.chunks
        
        # This is your robust safeguard from before
        cleaned_chunks = [
            str(chunk) for chunk in chunks 
            if chunk and isinstance(chunk, str) and chunk.strip()
        ]
        
        if not cleaned_chunks:
            logging.warning("Received no valid text chunks. Returning empty list.")
            return {"embeddings": []}

        logging.info(f"Encoding {len(cleaned_chunks)} chunks...")
        embeddings = model.encode(cleaned_chunks)
        embeddings_list = [e.tolist() for e in embeddings]
        logging.info("Encoding complete.")
        
        return {"embeddings": embeddings_list}
        
    except Exception as e:
        logging.error(f"An error occurred during embedding: {e}")
        # Send a 500 Internal Server Error back to the client
        raise HTTPException(status_code=500, detail=str(e))

# --- Health Check Endpoint ---
@app.get("/health")
async def health_check():
    """
    A simple endpoint to check if the server is running.
    """
    return {"status": "ok"}

# --- Main execution ---
if __name__ == "__main__":
    # We run the server on port 8001 to avoid conflicts with
    # ChromaDB (8000) and the Node.js server (5000).
    logging.info("Starting Uvicorn server on http://127.0.0.1:8001")
    uvicorn.run(app, host="127.0.0.1", port=8001)