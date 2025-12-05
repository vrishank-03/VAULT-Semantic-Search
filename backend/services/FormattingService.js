// backend/services/FormattingService.js - MERGED & COMPLETE
// --------------------------------------------------------
// [HELPER] Handles both Input Formatting (Context) and Output Formatting (Citations).
// [MERGE] Combines original citation logic with new RAG context builders.
// --------------------------------------------------------

const logger = require('../utils/logger');
const SERVICE_NAME = 'FormattingService';

/**
 * [NEW] Formats the raw document chunks into a single context string.
 * Adds source attribution (Filename + Page) so the AI can cite sources.
 * @param {Array} chunks - Array of chunk objects { content, source, page, score }
 * @returns {string} - A formatted string ready for the LLM prompt.
 */
function formatContext(chunks) {
    if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
        return "No relevant documents found.";
    }

    return chunks.map((chunk, index) => {
        // Handle cases where source might be missing or different format
        const sourceName = chunk.source || chunk.filename || "Unknown Document";
        const pageNum = chunk.page || chunk.page_number || "N/A";

        // Clean up content (remove excessive newlines)
        const cleanContent = (chunk.content || "").replace(/\n+/g, ' ').trim();

        // We format it specifically so the LLM sees: [Source: filename.pdf, Page: 1]
        // This matches the regex expected by 'formatAnswer' below.
        return `[Source: ${sourceName}, Page: ${pageNum}]
Content: "${cleanContent}"
`;
    }).join("\n\n");
}

/**
 * [NEW] Formats chat history for the LLM context window.
 */
function formatHistory(history) {
    if (!history || !Array.isArray(history)) return "";
    return history.map(msg => `${msg.sender}: ${msg.message}`).join("\n");
}

/**
 * [EXISTING] Formats the raw LLM answer and builds the source list.
 * Maps [Source: doc.pdf, Page 1] -> [1] and aggregates metadata.
 */
function formatAnswer(rawAnswer, relevantSources) {
    // [ATOMIC_LOGGING] Log the raw input for debugging
    logger.debug(SERVICE_NAME, 'Formatting raw answer...', { rawLength: rawAnswer.length });

    // 1. Build a Lookup Map for Sources
    const sourceMap = new Map();
    for (const source of relevantSources) {
        // Handle both flat structure (new) and nested metadata (old)
        const docName = source.source || source.metadata?.documentName || source.name;
        const pageNum = source.page || source.metadata?.pageNumber || source.page_number;
        const docId = source.id || source.metadata?.documentId;

        if (docName && pageNum) {
            const key = `${docName}|${pageNum}`;
            if (!sourceMap.has(key)) {
                sourceMap.set(key, {
                    id: docId,
                    name: docName,
                    page: pageNum,
                    preview: source.content ? source.content.substring(0, 100) : "No text available"
                });
            }
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
            // Fallback: If LLM hallucinated a filename slightly, we remove it
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
 * [EXISTING] Formats a metadata (SQL) answer.
 */
function formatMetadataAnswer(naturalLanguageAnswer, sqlResult) {
    logger.info(SERVICE_NAME, 'Formatting metadata answer...');
    return {
        answer: naturalLanguageAnswer,
        sources: [],
        metadata: sqlResult
    };
}

module.exports = {
    formatContext,       // New (Required by searchService)
    formatHistory,       // New
    formatAnswer,        // Existing
    formatMetadataAnswer // Existing
};