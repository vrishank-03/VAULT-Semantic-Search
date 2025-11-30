import os
import logging
import uvicorn
import shutil
import re
from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional

# [LOCAL ENGINE] Unstructured + Tesseract
from unstructured.partition.auto import partition
from unstructured.partition.docx import partition_docx
from unstructured.partition.pdf import partition_pdf

# [CLOUD ENGINE] Azure Document Intelligence
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.core.credentials import AzureKeyCredential

# --- Config & Models ---
class Chunk(BaseModel):
    text: str
    page_number: int
    metadata: dict = {}

class ParseResponse(BaseModel):
    chunks: List[Chunk]
    filename: str

logging.basicConfig(level=logging.INFO, format='[%(levelname)s] [ParserAPI] %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="VAULT Enterprise Parser", version="5.1.0")

# --- AZURE SETUP ---
AZURE_ENDPOINT = os.environ.get("AZURE_FORM_ENDPOINT")
AZURE_KEY = os.environ.get("AZURE_FORM_KEY")
azure_client = None

# --- STARTUP CHECKS ---
@app.on_event("startup")
async def startup_checks():
    logger.info("--- [Enterprise Parser v5.1 Startup] ---")
    
    # 1. Initialize Azure
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

    # 2. Check Poppler
    poppler_path = shutil.which("pdfinfo")
    if poppler_path:
        logger.info(f"✅ Poppler found: {poppler_path}")
    else:
        logger.critical("❌ Poppler NOT found. PDF processing will fail.")

    # 3. Check Tesseract
    tess_env = os.environ.get("TESSERACT_PATH_OVERRIDE", r"C:\Program Files\Tesseract-OCR")
    tess_exe = os.path.join(tess_env, "tesseract.exe")
    if shutil.which("tesseract") or os.path.exists(tess_exe):
        logger.info(f"✅ Tesseract OCR found.")
    else:
        logger.warning("⚠️ Tesseract NOT found. Scanned PDFs will be empty.")
    
    logger.info("--- [Startup Complete] ---")

# --- SCORING ENGINE ---
def calculate_quality_score(local_chunks: List[Chunk], file_path: str) -> int:
    """
    Returns a quality score (0-100).
    """
    if not local_chunks:
        return 0

    score = 100
    all_text = " ".join(chunk.text for chunk in local_chunks)
    total_chars = len(all_text)
    file_size = os.path.getsize(file_path)

    # 1. Penalty: Garbage/Empty
    if total_chars < 100:
        logger.warning(f"[SCORE] Penalizing: Almost empty ({total_chars} chars).")
        score -= 60

    # 2. Penalty: OCR Noise Patterns
    garbage_indicators = ["#####", "|||||", ".....", "____", "====="]
    if any(indicator in all_text for indicator in garbage_indicators):
        logger.warning("[SCORE] Penalizing: OCR noise artifacts detected.")
        score -= 30

    # 3. Penalty: Size vs Text Mismatch
    if file_size > 100 * 1024 and total_chars < 500:
        logger.warning(f"[SCORE] Penalizing: High file size ({file_size}b) but low text ({total_chars}).")
        score -= 40

    # 4. Penalty: Low Alphanumeric Density
    if total_chars > 0:
        alnum_ratio = sum(c.isalnum() for c in all_text) / total_chars
        if alnum_ratio < 0.4:
            logger.warning(f"[SCORE] Penalizing: Mostly symbols/noise (Density: {alnum_ratio:.2f}).")
            score -= 40

    return max(0, score)

# --- THRESHOLD INTELLIGENCE ---
def get_quality_threshold(filename: str) -> int:
    """
    Returns the score required to accept the local result.
    Images are treated more leniently than PDFs.
    """
    ext = filename.lower()
    if ext.endswith(('.jpg', '.jpeg', '.png', '.tiff', '.bmp')):
        return 30  # Be lenient with raw images (business cards, receipts)
    elif ext.endswith('.pdf'):
        return 50  # Strict standard for Documents
    else:
        return 50  # Default strict

# --- HELPER: Azure Parser ---
def parse_with_azure(file_path: str, filename: str) -> List[Chunk]:
    logger.info(f"[HYBRID] ☁️ Sending to Azure Document Intelligence...")
    try:
        with open(file_path, "rb") as f:
            poller = azure_client.begin_analyze_document(
                "prebuilt-read", 
                analyze_request=f,
                content_type="application/octet-stream"
            )
        result = poller.result()
        chunks = []
        for page in result.pages:
            lines = [line.content for line in page.lines]
            page_text = " ".join(lines)
            if len(page_text) > 5:
                chunks.append(Chunk(
                    text=page_text,
                    page_number=page.page_number,
                    metadata={"source": filename, "engine": "azure_cloud"}
                ))
        logger.info(f"[HYBRID] ☁️ Azure success: {len(chunks)} chunks.")
        return chunks
    except Exception as e:
        logger.error(f"[HYBRID] Azure failed: {str(e)}")
        raise e

# --- MAIN ROUTE ---
@app.post("/parse", response_model=ParseResponse)
async def parse_document(file: UploadFile = File(...)):
    temp_filename = f"temp_{file.filename}"
    file_path = os.path.join(os.getcwd(), temp_filename)

    try:
        # 1. Save File
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        logger.info(f"Processing file: {file.filename}")
        final_chunks = []
        used_engine = "local_tesseract"

        # 2. Try Local Parsing
        local_chunks = []
        try:
            if file.filename.lower().endswith(".pdf"):
                logger.info("[HYBRID] 🖥️ Attempting Local HI_RES strategy...")
                elements = partition_pdf(filename=file_path, strategy="hi_res", infer_table_structure=True)
            elif file.filename.lower().endswith(".docx"):
                elements = partition_docx(filename=file_path)
            else:
                elements = partition(filename=file_path)

            for el in elements:
                txt = str(el).strip()
                if len(txt) > 5:
                    local_chunks.append(Chunk(
                        text=txt,
                        page_number=getattr(el.metadata, "page_number", 1),
                        metadata={"source": file.filename, "engine": "local"}
                    ))
        except Exception as local_err:
            logger.error(f"[HYBRID] Local parsing crashed: {local_err}")

        # 3. The Quality Gate (Scoring + Threshold Logic)
        quality_score = calculate_quality_score(local_chunks, file_path)
        threshold = get_quality_threshold(file.filename)
        
        logger.info(f"[QUALITY] Score: {quality_score}/100 (Threshold: {threshold})")

        should_fallback = quality_score < threshold

        if should_fallback and azure_client:
            logger.warning(f"[HYBRID] ⚠️ Low Quality ({quality_score} < {threshold}). Triggering Cloud Fallback.")
            try:
                final_chunks = parse_with_azure(file_path, file.filename)
                used_engine = "azure_cloud"
            except Exception as azure_err:
                logger.error(f"[HYBRID] Azure fallback failed: {azure_err}")
                final_chunks = local_chunks # Fallback to local
        elif should_fallback and not azure_client:
            logger.warning("[HYBRID] ⚠️ Low Quality but Azure not configured. Returning poor results.")
            final_chunks = local_chunks
        else:
            final_chunks = local_chunks # Local was good!

        logger.info(f"✅ Success. Extracted {len(final_chunks)} chunks using {used_engine}.")
        return ParseResponse(chunks=final_chunks, filename=file.filename)

    finally:
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except: pass

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8002)