# backend/parser.py
# --------------------------------------------------------
# [ROLE] Enterprise Document Processing Service (Microservice)
# [OPTIMIZATION] Implements "Small-to-Big" Hierarchical Chunking
# [COST_SAVING] Hybrid Local/Cloud pipeline with quality gating
# --------------------------------------------------------

import os
import logging
import uvicorn
import shutil
import uuid
import re
from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import List, Optional

# --- LOCAL ENGINE (Unstructured + Tesseract) ---
from unstructured.partition.auto import partition
from unstructured.partition.pdf import partition_pdf
from unstructured.partition.docx import partition_docx
from unstructured.documents.elements import Title, NarrativeText, ListItem

# --- CLOUD ENGINE (Azure Document Intelligence) ---
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.core.credentials import AzureKeyCredential

# --- CONFIGURATION ---
AZURE_ENDPOINT = os.environ.get("AZURE_FORM_ENDPOINT")
AZURE_KEY = os.environ.get("AZURE_FORM_KEY")

# --- DATA MODELS ---
class Chunk(BaseModel):
    id: str                 # Unique UUID
    text: str
    page_number: int
    metadata: dict = {}

class ParseResponse(BaseModel):
    chunks: List[Chunk]
    filename: str

# --- LOGGING SETUP ---
logging.basicConfig(level=logging.INFO, format='[%(levelname)s] [ParserAPI] %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="VAULT Enterprise Parser", version="6.0.0-Hierarchical")

# --- GLOBAL STATE ---
azure_client = None

# --- STARTUP SEQUENCE ---
@app.on_event("startup")
async def startup_checks():
    logger.info("--- [VAULT Parser v6.0 Startup] ---")
    
    # 1. Initialize Azure Client
    global azure_client
    if AZURE_ENDPOINT and AZURE_KEY:
        try:
            azure_client = DocumentIntelligenceClient(
                endpoint=AZURE_ENDPOINT, 
                credential=AzureKeyCredential(AZURE_KEY)
            )
            logger.info("✅ Azure Document Intelligence: READY")
        except Exception as e:
            logger.error(f"⚠️ Azure Configured but Init Failed: {e}")
    else:
        logger.warning("⚠️ Azure Document Intelligence: NOT CONFIGURED (Local Only)")

    # 2. Verify External Tools
    if shutil.which("tesseract"):
        logger.info("✅ Tesseract OCR: FOUND")
    else:
        logger.warning("⚠️ Tesseract OCR: NOT FOUND (Image-based PDFs will fail)")
        
    if shutil.which("pdfinfo"): # Poppler
        logger.info("✅ Poppler Utils: FOUND")
    
    logger.info("--- [Startup Complete] ---")

# --- CORE LOGIC: HIERARCHICAL CHUNKING ---
def hierarchical_chunking(elements, filename: str) -> List[Chunk]:
    """
    Transforms a flat list of Unstructured elements into a Hierarchical Tree.
    - Headers become 'Parent Chunks' (is_header=True)
    - Content becomes 'Child Chunks' (linked via parent_id)
    """
    chunks = []
    current_parent_id = None
    current_section_name = "Introduction" # Default section

    for el in elements:
        text = str(el).strip()
        
        # 1. Noise Filter (Ignore tiny artifacts)
        if len(text) < 5: 
            continue
            
        chunk_id = str(uuid.uuid4())
        page_num = getattr(el.metadata, "page_number", 1)

        # 2. Detect Hierarchy
        if isinstance(el, Title):
            # We found a Header -> Start a new 'Section'
            current_section_name = text
            current_parent_id = chunk_id
            
            chunks.append(Chunk(
                id=chunk_id,
                text=f"SECTION HEADER: {text}",
                page_number=page_num,
                metadata={
                    "source": filename,
                    "is_header": True,
                    "parent_id": None, # Headers have no parent
                    "section": current_section_name,
                    "type": "Title"
                }
            ))
            logger.debug(f"[HIERARCHY] New Section: '{text}' (ID: {chunk_id})")
        
        else:
            # We found Content -> Link to current Parent
            chunks.append(Chunk(
                id=chunk_id,
                text=text,
                page_number=page_num,
                metadata={
                    "source": filename,
                    "is_header": False,
                    "parent_id": current_parent_id, # <--- THE LINK
                    "section": current_section_name,
                    "type": "Content"
                }
            ))

    return chunks

# --- CORE LOGIC: QUALITY SCORING ---
def calculate_quality_score(local_chunks: List[Chunk], file_path: str) -> int:
    """
    Heuristic analysis to determine if local OCR succeeded or failed.
    Returns 0-100. <50 usually triggers Cloud Fallback.
    """
    if not local_chunks: return 0

    all_text = " ".join(c.text for c in local_chunks)
    total_chars = len(all_text)
    file_size = os.path.getsize(file_path)

    score = 100

    # Penalty 1: Empty Output
    if total_chars < 100: score -= 60
    
    # Penalty 2: Garbage Characters (OCR Noise)
    garbage_indicators = ["||||", "____", "....", ""]
    if any(g in all_text for g in garbage_indicators): score -= 30

    # Penalty 3: Low Alphanumeric Density (gibberish)
    if total_chars > 0:
        alnum_ratio = sum(c.isalnum() for c in all_text) / total_chars
        if alnum_ratio < 0.4: score -= 40
    
    return max(0, score)

# --- CORE LOGIC: AZURE FALLBACK ---
def parse_with_azure(file_path: str, filename: str) -> List[Chunk]:
    logger.info(f"[CLOUD] ☁️ Uploading to Azure Document Intelligence...")
    try:
        with open(file_path, "rb") as f:
            poller = azure_client.begin_analyze_document(
                "prebuilt-read", 
                analyze_request=f,
                content_type="application/octet-stream"
            )
        result = poller.result()
        
        # Azure returns structure differently, we map it to our format
        chunks = []
        for page in result.pages:
            lines = [line.content for line in page.lines]
            # Simple paragraph grouping for Azure results
            page_text = "\n".join(lines)
            
            if len(page_text) > 10:
                chunks.append(Chunk(
                    id=str(uuid.uuid4()),
                    text=page_text,
                    page_number=page.page_number,
                    metadata={
                        "source": filename, 
                        "engine": "azure_cloud",
                        "section": "Azure Extracted",
                        "is_header": False,
                        "parent_id": None
                    }
                ))
        return chunks
    except Exception as e:
        logger.error(f"[CLOUD] Azure Failed: {e}")
        raise e

# --- MAIN ENDPOINT ---
@app.post("/parse", response_model=ParseResponse)
async def parse_document(file: UploadFile = File(...)):
    temp_filename = f"temp_{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(os.getcwd(), temp_filename)
    
    try:
        # 1. Save Upload
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        logger.info(f"Processing: {file.filename} ({os.path.getsize(file_path)} bytes)")

        # 2. Attempt Local Parsing (Unstructured 'hi_res')
        # 'hi_res' is required for accurate Title detection
        try:
            if file.filename.lower().endswith(".pdf"):
                elements = partition_pdf(
                    filename=file_path, 
                    strategy="hi_res", 
                    infer_table_structure=True
                )
            elif file.filename.lower().endswith(".docx"):
                elements = partition_docx(filename=file_path)
            else:
                elements = partition(filename=file_path)
            
            # Apply Hierarchy Logic
            local_chunks = hierarchical_chunking(elements, file.filename)
            
        except Exception as e:
            logger.error(f"[LOCAL] Parsing failed: {e}")
            local_chunks = []

        # 3. Quality Gate
        score = calculate_quality_score(local_chunks, file_path)
        threshold = 50 # Strict threshold for Enterprise docs
        
        logger.info(f"[QUALITY] Score: {score}/100 (Threshold: {threshold})")

        final_chunks = local_chunks
        
        # 4. Fallback Logic
        if score < threshold and azure_client:
            logger.warning(f"[FALLBACK] Low quality detected. Engaging Azure...")
            try:
                final_chunks = parse_with_azure(file_path, file.filename)
                logger.info(f"[FALLBACK] Azure success: {len(final_chunks)} chunks.")
            except:
                logger.error("[FALLBACK] Azure failed. Reverting to local.")
        
        return ParseResponse(chunks=final_chunks, filename=file.filename)

    except Exception as e:
        logger.error(f"[FATAL] Request failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        # Cleanup temp file
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except: pass

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8002)