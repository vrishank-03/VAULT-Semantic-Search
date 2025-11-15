// backend/services/FormattingService.js

const logger = require('../utils/logger');
const SERVICE_NAME = 'FormattingService';

/**
 * Formats the raw LLM answer and builds the source list.
 */
async function formatAnswer(rawAnswer, relevantSources) {
    logger.info(SERVICE_NAME, 'Formatting raw answer and building source list...');
    
    const sourceMap = new Map();
    for (const source of relevantSources) {
        // [METADATA_BUG_FIX]
        // Use 'documentId' and 'pageNumber' (camelCase) to match database.js
        const key = `Document ID ${source.metadata.documentId}, Page ${source.metadata.pageNumber}`;
        
        if (!sourceMap.has(key)) {
            sourceMap.set(key, {
                id: source.metadata.documentId,
                name: source.metadata.documentName,
                page: source.metadata.pageNumber,
            });
        }
    }

    const citationRegex = /\[Source from Document ID (\d+), Page (\d+)\]/g;
    let finalAnswerText = rawAnswer;
    const finalSources = new Map();
    let sourceCounter = 1;

    finalAnswerText = rawAnswer.replace(citationRegex, (match, docId, pageNum) => {
        // [METADATA_BUG_FIX]
        // Use 'documentId' and 'pageNumber' (camelCase) keys
        const key = `Document ID ${docId}, Page ${pageNum}`;
        
        if (sourceMap.has(key)) {
            const source = sourceMap.get(key);
            
            let sourceNumber;
            if (finalSources.has(key)) {
                sourceNumber = Array.from(finalSources.values()).find(s => 
                    s.id === source.id && s.page === source.page
                ).number;
            } else {
                sourceNumber = sourceCounter++;
                finalSources.set(key, {
                    number: sourceNumber,
                    ...source 
                });
            }
            
            return `[${sourceNumber}]`;
        } else {
            logger.warn(SERVICE_NAME, `LLM hallucinated a source: ${match}. Removing it.`);
            return ""; 
        }
    });

    finalAnswerText = finalAnswerText.replace(/(\s+\[)/g, ' [')
                                     .replace(/\[\s+/g, '[')
                                     .replace(/\s+\]/g, ']')
                                     .replace(/\[\]/g, '')
                                     .replace(/\s+\./g, '.')
                                     .replace(/\s+,/g, ',');

    const sortedSources = Array.from(finalSources.values()).sort((a, b) => a.number - b.number);
    
    logger.info(SERVICE_NAME, `Formatting complete. Found ${sortedSources.length} unique sources.`);
    
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

    const payload = {
        answer: naturalLanguageAnswer,
        sources: [], 
        metadata: sqlResult 
    };

    return payload;
}


module.exports = {
    formatAnswer,
    formatMetadataAnswer,
};