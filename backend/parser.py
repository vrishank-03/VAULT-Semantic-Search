# backend/parser.py

import os
import tempfile
import logging
import uvicorn
from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import List

# [FIX] The function is named 'partition', not 'partition_auto'
from unstructured.partition.auto import partition

# --- Pydantic Data Models ---
class Chunk(BaseModel):
    """
    A single processed chunk of text with its metadata.
    """
    text: str
    page_number: int
    type: str 

class ParseResponse(BaseModel):
    """
    The successful response object containing all extracted chunks.
    """
    chunks: List[Chunk]
    filename: str

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO, format='[%(levelname)s] [ParserAPI] %(message)s')
logger = logging.getLogger(__name__)

# --- FastAPI App Initialization ---
app = FastAPI(
    title="VAULT Enterprise Parsing Service",
    description="A high-performance API for document parsing, layout analysis, and OCR.",
    version="1.0.0"
)

# --- API Endpoints ---

@app.get("/health")
async def health_check():
    """
    A simple endpoint to confirm the parsing server is running.
    """
    return {"status": "ok", "service": "ParserAPI"}

@app.post("/parse", response_model=ParseResponse)
async def parse_document(file: UploadFile = File(...)):
    """
    Parses an uploaded document (PDF, DOCX, PPTX, etc.) using 'unstructured'.
    It performs layout analysis and OCR to extract clean, logical chunks.
    """
    
    temp_file_path = ""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=file.filename) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        logger.info(f"File '{file.filename}' saved to temp path: {temp_file_path}")
    except Exception as e:
        logger.error(f"Failed to save temporary file: {e}")
        raise HTTPException(status_code=500, detail="Failed to save temporary file.")

    # 2. Process the file with 'unstructured'
    try:
        logger.info(f"Parsing document with unstructured (strategy='auto')...")
        
        # [FIX] The function call is 'partition'
        elements = partition(
            filename=temp_file_path,
            strategy="auto",
        )
        
        logger.info(f"Successfully partitioned document into {len(elements)} elements.")

        # 3. Convert elements into clean chunks
        response_chunks: List[Chunk] = []
        for el in elements:
            if not el.text or len(el.text.strip()) < 20:
                continue
            
            response_chunks.append(Chunk(
                text=el.text.strip(),
                page_number=el.metadata.page_number or 1, 
                type=el.category
            ))

        if not response_chunks:
            logger.warn("Document was parsed but 0 valid chunks were extracted.")
        
        return ParseResponse(
            chunks=response_chunks,
            filename=file.filename
        )

    except Exception as e:
        logger.error(f"Failed to parse document '{file.filename}': {e}")
        raise HTTPException(status_code=500, detail=f"Parsing failed: {e}")
        
    finally:
        # 4. CRITICAL: Always clean up the temporary file
        if temp_file_path and os.path.exists(temp_file_path):
            os.unlink(temp_file_path)
            logger.info(f"Cleaned up temporary file: {temp_file_path}")

# --- Main execution ---
if __name__ == "__main__":
    logger.info("Starting Uvicorn server on http://127.0.0.1:8002")
    uvicorn.run(app, host="127.0.0.1", port=8002, log_level="info")