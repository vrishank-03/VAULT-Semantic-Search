const fs = require('fs');
const pdf = require('pdf-parse');
const { getEmbeddings } = require('./ml_runner');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');

// NEW: A helper function to process text from a single page
async function processPageText(text, pageNumber, splitter) {
    // If a page has very little text, we can skip splitting it.
    if (text.length < 10) {
        return [];
    }
    const chunks = await splitter.splitText(text);
    // Return chunks with the page number attached
    return chunks.map(chunkText => ({
        text: chunkText,
        pageNumber: pageNumber
    }));
}

async function processDocument(filePath) {
    console.log(`[PROCESS_DOC] Starting processing for: ${filePath}`); // [BUG_5_FIX] Added log
    const dataBuffer = fs.readFileSync(filePath);

    // [BUG_5_FIX] Check for 0-byte file before parsing
    if (dataBuffer.length === 0) {
        console.warn(`[PROCESS_DOC_ERROR] Upload failed: File is 0 bytes. Path: ${filePath}`);
        throw new Error("CorruptedFileError");
    }

    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 100,
    });

    let allChunks = []; // This will hold chunks from all pages

    // 1. Use the 'pagerender' option to process the PDF page by page
    const options = {
        async pagerender(pageData) {
            const textContent = await pageData.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            const pageNumber = pageData.pageIndex + 1; // pageIndex is 0-based

            // [BUG_5_FIX] Log page-by-page processing
            // console.log(`[PROCESS_DOC] Processing text from page ${pageNumber}...`); // This is too noisy, let's keep it high-level

            const pageChunks = await processPageText(pageText, pageNumber, splitter);
            allChunks.push(...pageChunks);
        }
    };

    // --- [BUG_5_FIX] START: Add try...catch for pdf-parse ---
    try {
        // This will populate allChunks via the callback
        console.log(`[PROCESS_DOC] Calling pdf-parse for ${filePath}...`);
        await pdf(dataBuffer, options);
    } catch (err) {
        console.warn(`[PROCESS_DOC_ERROR] pdf-parse failed for ${filePath}. Error: ${err.message}`);
        
        // Check for password-protection error
        if (err.message && err.message.toLowerCase().includes('password')) {
            console.warn(`[PROCESS_DOC_ERROR] Detected password-protected PDF.`);
            throw new Error("PasswordProtectedError");
        }
        
        // Handle other parsing errors (e.g., corrupted file)
        console.warn(`[PROCESS_DOC_ERROR] Detected corrupted or unreadable PDF.`);
        throw new Error("CorruptedFileError");
    }
    // --- [BUG_5_FIX] END ---

    // [BUG_5_FIX] Check if the PDF was valid but contained no text
    if (allChunks.length === 0) {
        console.warn(`[PROCESS_DOC_ERROR] PDF processed successfully but 0 chunks were extracted (e.g., blank or image-only PDF).`);
        // Treat this as a corrupted/unusable file for the user.
        throw new Error("CorruptedFileError");
    }

    console.log(`[PROCESS_DOC] Document split into ${allChunks.length} chunks across all pages.`);
    
    // 2. Extract just the text for embedding
    const chunkTexts = allChunks.map(chunk => chunk.text);

    // 3. Get embeddings for each chunk
    console.log('[PROCESS_DOC] Requesting embeddings for all chunks...');
    const vectors = await getEmbeddings(chunkTexts);
    console.log('[PROCESS_DOC] Embeddings received.');

    // 4. Combine chunks (with page numbers) and their vectors
    const chunksWithVectors = allChunks.map((chunk, i) => ({
        ...chunk, // This includes 'text' and 'pageNumber'
        vector: vectors[i]
    }));

    console.log(`[PROCESS_DOC] Finished processing. Returning ${chunksWithVectors.length} chunks with vectors.`);
    return chunksWithVectors;
}

module.exports = { processDocument };