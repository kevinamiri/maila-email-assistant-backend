import * as AWS from 'aws-sdk';
import "dotenv/config";
import { Client, HUMAN_PROMPT, AI_PROMPT } from "@anthropic-ai/sdk";
import { performWebCrawlerSearch } from './plugins/search';
import { chainSearch, chainContexts, initialPrompt } from './prompts';
import { searchPromptPrefix } from './context';

// Initialize AWS SDK with credentials from environment variables
// AWS.config.update({
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//     region: process.env.AWS_REGION
// });
AWS.config.update({
    region: 'eu-west-1'
});

// Initialize Anthropic AI client with API key from environment variables
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
    throw new Error("The ANTHROPIC_API_KEY environment variable must be set");
}
const AnthropicClient = new Client(apiKey);

// Function to create a completion using the Anthropic AI SDK
const createCompletion = async (prompt: string, greating?: string) => {
    return AnthropicClient
        .complete({
            prompt: `${HUMAN_PROMPT} ${prompt}${AI_PROMPT}${greating && greating}`,
            stop_sequences: ["</response>", HUMAN_PROMPT],
            max_tokens_to_sample: 50000,
            temperature: 0.5,
            model: "claude-v1.3-100k",
        })
        .then((res) => res?.completion)
        .catch((error) => {
            console.error(error);
        });
}

// Function to create an instant completion using the Anthropic AI SDK
const createInstantCompletion = async (prompt: string, greeting?: string) => {
    return AnthropicClient
        .complete({
            prompt: `${HUMAN_PROMPT} ${prompt}${AI_PROMPT}${greeting && greeting}`,
            stop_sequences: ["\n", HUMAN_PROMPT],
            max_tokens_to_sample: 5000,
            temperature: 0.5,
            model: "claude-v1.3-100k",
        })
        .then((res) => res?.completion)
        .catch((error) => {
            console.error(error);
        });
}

// Function to perform a search and process the results
const performSearchAndProcessResults = async (searchQuery: string) => {
    try {
        const searchResults = await performWebCrawlerSearch(searchQuery);
        return processSearchResults(searchResults);
    } catch (error) {
        console.error('Error performing search and processing results:', error);
        throw error;
    }
}

// Function to process search results
const processSearchResults = (searchResults) => {
    const content = searchResults.pageContents.map((pageContent, inx: number) => {
        return `
<section>
Page number: ${inx}
Title: ${pageContent?.title}
Content: ${pageContent?.contentText}
Link: ${pageContent?.url}</section>`
    })
    return content.join('---\n');
}
// Main function to execute the script
export const inferMessage = async (question: string) => {
    // Prepare the initial request by prompting
    const initialReq = chainSearch(question) as string;

    // Get search query
    const searchQuery = await createInstantCompletion(initialReq, searchPromptPrefix) as string;

    // Get the search results and process them
    const content_str = await performSearchAndProcessResults(searchQuery);

    // Prepare the final request
    const finalReq = chainContexts(content_str, question) as string;

    // Get the final response
    const finalResponse = await createCompletion(finalReq, "<response>") as string;

    // Modify the response to replace [Your Name] with 'Kevin A. Smith'
    const modifyAutomaticSignature = finalResponse.replace(/\[Your Name\]/g, 'Kevin A. Smith');

    return modifyAutomaticSignature
}
