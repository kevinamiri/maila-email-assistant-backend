import axios from 'axios';
import { addressCrawler, fetchPageContent } from "./fetchPage";
import { processSearchResults } from "./utils";
import "dotenv/config";
/**
 * Performs a custom search using the Google Search API.
 *
 * @param {string} searchQuery - The search query.
 * @returns {Promise<any>} - A promise that resolves to the search results.
 */
export async function performGoogleSearch(searchQuery: string) {
    // Encode the search query to make it URL-safe
    const encodedQuery: string = encodeURIComponent(searchQuery);

    if (!searchQuery) {
        throw new Error('No search query provided');
    }

    const API_KEY: string = process.env.GOOGLE_API_KEY as string;
    const CX: string = process.env.GOOGLE_CX as string;
    const url: string = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${CX}&q=${encodedQuery}`;

    try {
        const response = await axios.get(url);
        const data = response.data;
        const searchResults: any[] = data.items || [];
        const resultLinks: string[] = searchResults.map((result: any) => result?.link);
        const formattedResults: any[] = await processSearchResults(searchResults);

        const allContents = formattedResults.map((result: any) => {
            return `<article>Title: ${result.title}
${result.content}
Link: ${result.link}</article>`
        });

        const allContentString = allContents.join('\n\n---\n\n');
        return allContentString
    } catch (error: any) {
        throw new Error('Error fetching search results');
    }
}

/**
 * Performs a search using a web crawler and fetches the content of the resulting pages.
 *
 * @param {string} searchQuery - The search query.
 * @returns {Promise<any>} - A promise that resolves to the page contents.
 */
export async function performWebCrawlerSearch(searchQuery: string): Promise<any> {
    const encodedQuery: string = searchQuery.toString();

    if (!searchQuery) {
        throw new Error('No search query provided');
    }
    try {
        const response: any = await addressCrawler(encodedQuery, '1');
        const data: any = response.result;
        const searchResults: any[] = data || [];
        const resultLinks: string[] = searchResults.map((result: any) => result?.link);
        const pageContents: any[] = await fetchPageContent(resultLinks);

        return { pageContents };
    } catch (error: any) {
        throw new Error('Error fetching search results');
    }
}

export default { performGoogleSearch, performWebCrawlerSearch };