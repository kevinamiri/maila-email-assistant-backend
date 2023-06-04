import fetch from "node-fetch";

export type Model =
    | "claude-v1"
    | "claude-v1-100k"
    | "claude-instant-v1"
    | "claude-instant-v1-100k"
    | "claude-v1.3"
    | "claude-v1.3-100k"
    | "claude-v1.2"
    | "claude-v1.0"
    | "claude-instant-v1.1"
    | "claude-instant-v1.1-100k"
    | "claude-instant-v1.0"


export type CompletionParameters = {
    prompt: string;
    temperature?: number;
    max_tokens_to_sample?: number;
    stop_sequences?: string[];
    top_k?: number;
    top_p?: number;
    model: Model;
    tags?: Record<string, string>;
};

export type CompletionResponse = {
    completion: string;
    stop: string | null;
    stopReason: "stop_sequence" | "max_tokens";
    isTruncated: boolean;
    exception: string | null;
    logId: string;
};


export const HUMAN_PROMPT = "\n\nHuman:";
export const AI_PROMPT = "\n\nAssistant:";



// Define constants

async function createCompletion(prompt: CompletionParameters): Promise<CompletionResponse> {
    const parameters = {
        prompt: `${HUMAN_PROMPT}${prompt}${AI_PROMPT}`,
        stop_sequences: [HUMAN_PROMPT],
        max_tokens_to_sample: 50000,
        temperature: 0.74,
        model: "claude-v1-100k",
    }
    // If temperature is not defined in params, set it to 0.75
    if (parameters.temperature === undefined) {
        parameters.temperature = 0.75;
    }
    if (parameters.max_tokens_to_sample === undefined) {
        parameters.max_tokens_to_sample = 50000;
    }
    if (parameters.stop_sequences === undefined) {
        parameters.stop_sequences = [HUMAN_PROMPT];
    }
    try {
        const response = await fetch(`https://api.anthropic.com/v1/complete`, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Client: "anthropic-typescript/custom_build",
                "X-API-Key": this.apiKey,
            },
            body: JSON.stringify({ ...parameters, stream: false }),
        });

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const completion = await response.json() as CompletionResponse;
        return completion;
    } catch (error) {
        console.error(`Error in completion function: ${error}`);
        throw error;
    }
}


// Define constants
const CLIENT_ID = "anthropic-typescript/0.4.3";
const DEFAULT_API_URL = "https://api.anthropic.com";

// Define the client class
export class AnthropicClient {
    private apiUrl: string;

    // Constructor for the AnthropicClient class
    constructor(private apiKey: string, options?: { apiUrl?: string }) {
        this.apiUrl = options?.apiUrl ?? DEFAULT_API_URL;
    }

    // Function to complete a prompt
    // This function sends a POST request to the API to get a completion for the given prompt.
    // It returns a promise that resolves to the completion response.
    async completion(prompt: CompletionParameters): Promise<CompletionResponse> {
        const parameters = {
            prompt: `${HUMAN_PROMPT}${prompt}${AI_PROMPT}`,
            stop_sequences: [HUMAN_PROMPT],
            max_tokens_to_sample: 50000,
            temperature: 0.74,
            model: "claude-v1-100k",
        }
        try {
            const response = await fetch(`${this.apiUrl}/v1/complete`, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    Client: CLIENT_ID,
                    "X-API-Key": this.apiKey,
                },
                body: JSON.stringify({ ...parameters, stream: false }),

            });

            if (!response.ok) {
                console.log(response);
                throw new Error(`API request failed with status ${response.status}`);

            }

            const completion = await response.json() as CompletionResponse;
            return completion;
        } catch (error) {
            throw error;
        }
    }
}