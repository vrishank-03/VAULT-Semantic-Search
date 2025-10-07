require('dotenv').config();
const OpenAI = require('openai');

// This sets up the connection to Groq using your API key from the .env file
const groq = new OpenAI({
    baseURL: 'https://api.groq.com/openai/v1',
    apiKey: process.env.GROQ_API_KEY,
});

async function main() {
    console.log("Fetching available models from Groq...");
    try {
        const models = await groq.models.list();

        console.log("\n--- Models available for your API key ---");
        for (const model of models.data) {
            // We only care about the model ID, which is the name we need
            console.log(model.id);
        }
        console.log("-----------------------------------------");
        console.log("\nPlease choose one of these models and we will update your searchService.js file.");

    } catch (error) {
        console.error("Failed to fetch models:", error);
    }
}

main();