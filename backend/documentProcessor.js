const fs = require('fs');
const pdf = require('pdf-parse');
const { getEmbeddings } = require('./ml_runner'); // We'll update ml_runner next

async function processDocument(filePath) {
  // 1. Read the PDF content
  const dataBuffer = fs.readFileSync(filePath);
  const pdfData = await pdf(dataBuffer);
  const text = pdfData.text;

  // 2. Chunk the text (simple chunking by splitting into paragraphs)
  const chunks = text.split(/\n\s*\n/).filter(chunk => chunk.trim().length > 10);
  console.log(`Document split into ${chunks.length} chunks.`);

  // 3. Get embeddings for each chunk
  console.log('Requesting embeddings for all chunks...');
  const vectors = await getEmbeddings(chunks);

  const chunksWithVectors = chunks.map((chunkText, i) => ({
    text: chunkText,
    vector: vectors[i]
  }));

  return chunksWithVectors;
}

module.exports = { processDocument };