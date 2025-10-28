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
    const dataBuffer = fs.readFileSync(filePath);

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

            console.log(`Processing text from page ${pageNumber}...`);

            const pageChunks = await processPageText(pageText, pageNumber, splitter);
            allChunks.push(...pageChunks);
        }
    };

    // This will populate allChunks via the callback
    await pdf(dataBuffer, options);

    console.log(`Document split into ${allChunks.length} chunks across all pages.`);
    
    // 2. Extract just the text for embedding
    const chunkTexts = allChunks.map(chunk => chunk.text);

    // 3. Get embeddings for each chunk
    console.log('Requesting embeddings for all chunks...');
    const vectors = await getEmbeddings(chunkTexts);

    // 4. Combine chunks (with page numbers) and their vectors
    const chunksWithVectors = allChunks.map((chunk, i) => ({
        ...chunk, // This includes 'text' and 'pageNumber'
        vector: vectors[i]
    }));

    return chunksWithVectors;
}

module.exports = { processDocument };