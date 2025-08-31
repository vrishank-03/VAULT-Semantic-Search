const fs = require('fs');
const pdf = require('pdf-parse');
const { getEmbeddings } = require('./ml_runner');

async function processDocument(filePath) {
  // 1. Read the PDF content
  const dataBuffer = fs.readFileSync(filePath);
  const pdfData = await pdf(dataBuffer);
  const text = pdfData.text;

  // 2. Implement a fixed-size chunking strategy
  const chunkSize = 400; // characters
  const chunkOverlap = 50; // characters
  const rawChunks = [];

  for (let i = 0; i < text.length; i += chunkSize - chunkOverlap) {
    const chunk = text.substring(i, i + chunkSize);
    rawChunks.push(chunk);
  }

  // 3. NEW: Aggressively clean and then filter the chunks
  const cleanedChunks = rawChunks
    .map(chunk => {
      // Replace multiple whitespace chars (newlines, tabs, etc.) with a single space
      const cleaned = chunk.replace(/\s+/g, ' ').trim();
      return cleaned;
    })
    .filter(chunk => chunk.length > 10); // Filter out any chunks that are too short after cleaning
  
  console.log(`Document split and cleaned into ${cleanedChunks.length} chunks.`);
  
  // 4. Get embeddings for each chunk
  console.log('Requesting embeddings for all chunks...');
  const vectors = await getEmbeddings(cleanedChunks);
  
  const chunksWithVectors = cleanedChunks.map((chunkText, i) => ({
    text: chunkText,
    vector: vectors[i]
  }));

  return chunksWithVectors;
}

module.exports = { processDocument };