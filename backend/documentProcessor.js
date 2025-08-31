const fs = require('fs');
const pdf = require('pdf-parse');
const { getEmbeddings } = require('./ml_runner');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');

async function processDocument(filePath) {
  // 1. Read the PDF content
  const dataBuffer = fs.readFileSync(filePath);
  const pdfData = await pdf(dataBuffer);
  const text = pdfData.text;

  // 2. NEW: Use the RecursiveCharacterTextSplitter
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000, // The max size of a chunk in characters
    chunkOverlap: 100, // The number of characters to overlap between chunks
  });

  const chunks = await splitter.splitText(text);

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