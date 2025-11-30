// backend/services/FormattingService.js

const logger = require('../utils/logger');
const SERVICE_NAME = 'FormattingService';

/**
 * Formats the raw LLM answer and builds the source list.
 * Maps [Source: doc.pdf, Page 1] -> [1] and aggregates metadata.
 */
async function formatAnswer(rawAnswer, relevantSources) {
    // [ATOMIC_LOGGING] Log the raw input for debugging
    logger.debug(SERVICE_NAME, 'Formatting raw answer...', { rawLength: rawAnswer.length });
    
    // 1. Build a Lookup Map for Sources
    // Key format must match the string generated in RAGPipelineService
    const sourceMap = new Map();
    for (const source of relevantSources) {
        // Use the NORMALIZED metadata structure
        const docName = source.metadata.documentName;
        const pageNum = source.metadata.pageNumber;
        const key = `${docName}|${pageNum}`;
        
        if (!sourceMap.has(key)) {
            sourceMap.set(key, {
                id: source.metadata.documentId,
                name: docName,
                page: pageNum,
                // Keep raw text for potential UI tooltip expansion
                preview: source.text ? source.text.substring(0, 100) : "No text available"
            });
        }
    }

    // 2. Regex to find citations in the LLM output
    // Matches: [Source: file.pdf, Page 12] or [Source: file.pdf, Page: 12]
    const citationRegex = /\[Source:\s*([^,\]]+),\s*Page:?\s*(\d+)\]/gi;
    
    let finalAnswerText = rawAnswer;
    const finalSources = new Map();
    let sourceCounter = 1;

    // 3. Replace Text Citations with Numbers [1]
    finalAnswerText = finalAnswerText.replace(citationRegex, (match, docName, pageNum) => {
        const cleanDocName = docName.trim();
        const key = `${cleanDocName}|${pageNum}`;
        
        if (sourceMap.has(key)) {
            const source = sourceMap.get(key);
            
            let sourceNumber;
            if (finalSources.has(key)) {
                // Reuse number if already cited
                sourceNumber = finalSources.get(key).number;
            } else {
                // Assign new number
                sourceNumber = sourceCounter++;
                finalSources.set(key, {
                    number: sourceNumber,
                    ...source 
                });
            }
            
            return `[${sourceNumber}]`;
        } else {
            // Fallback: If LLM hallucinated a filename slightly, try to find by page number matching in valid sources
            // (Strict mode: currently we remove it to prevent fake citations)
            logger.warn(SERVICE_NAME, `[CITATION_MISMATCH] LLM cited '${cleanDocName}' pg ${pageNum} but it was not in context. Removing.`);
            return ""; 
        }
    });

    // 4. Cosmetic Cleanup
    finalAnswerText = finalAnswerText
        .replace(/(\s+\[)/g, ' [')    // Normalise spaces before brackets
        .replace(/\[\s+/g, '[')       // Remove space inside bracket
        .replace(/\s+\]/g, ']')       // Remove space before closing bracket
        .replace(/\[\]/g, '')         // Remove empty citations
        .replace(/\s+\./g, '.')       // Fix floating periods
        .replace(/\s+,/g, ',');       // Fix floating commas

    // 5. Sort sources by their appearance order [1], [2], [3]
    const sortedSources = Array.from(finalSources.values()).sort((a, b) => a.number - b.number);
    
    logger.info(SERVICE_NAME, `Formatting complete. Mapped ${sortedSources.length} unique sources.`);
    
    return {
        answer: finalAnswerText,
        sources: sortedSources
    };
}

/**
 * Formats a metadata (SQL) answer.
 */
async function formatMetadataAnswer(naturalLanguageAnswer, sqlResult) {
    logger.info(SERVICE_NAME, 'Formatting metadata answer...');
    return {
        answer: naturalLanguageAnswer,
        sources: [], 
        metadata: sqlResult 
    };
}

module.exports = {
    formatAnswer,
    formatMetadataAnswer,
};