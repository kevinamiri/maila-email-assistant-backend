// src/utils.ts

import axios from 'axios';
import cheerio from 'cheerio';
import SearchResult from './searchResult';
import { fetchPageContent } from './fetchPage';

function splitContentByWords(
    content: string,
    chunkSize: number = 2000
): string[] {
    const words = content ? content?.split(/\s+/) : [];
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += chunkSize) {
        const chunk = words.slice(i, i + chunkSize).join(' ');
        chunks.push(chunk);
    }

    return chunks;
}



async function fetch_content(url: string): Promise<string | null> {
    try {
        const response = await axios.get(url);
        if (response.status === 200) {
            const $ = cheerio.load(response.data);

            let plainTextSummary = '';

            // Extract text differently for each tag to create a clean summary
            $('h1').each((_, elem) => {
                const text = $(elem).text().trim();
                plainTextSummary += `${text}:\n`;
            });

            $('h2').each((_, elem) => {
                const text = $(elem).text().trim();
                plainTextSummary += `    ${text}: `;
            });

            $('p, ul').each((_, elem) => {
                const text = $(elem).text().trim()
                    .replace(/\r?\n|\r/g, ' ')
                    .replace(/\t+/g, ' ')
                    .replace(/ {2,}/g, ' ');
                plainTextSummary += `${text}\n`;
            });

            // Remove trailing comma and add a newline
            plainTextSummary = plainTextSummary.replace(/, $/, '\n');

            return plainTextSummary || null;
        } else {
            return null;
        }
    } catch (error) {
        console.error(`Error fetching content: ${error}`);
        return null;
    }
}

type Separator = 'words' | 'passages';


function splitByPassages(passages: string[], chunkSize: number): string[] {
    const chunks: string[] = [];

    for (let i = 0; i < passages.length; i += chunkSize) {
        const chunk = passages.slice(i, i + chunkSize).join('\n\n');
        chunks.push(chunk);
    }

    return chunks;
}


export async function processSearchResults(links: any[]): Promise<object[]> {

    const chuncks = [] as any[]
    await Promise.all(links.map(async (link_: { title: string, link: string }) => {
        const { title, link } = link_;
        // console.log("link: ", link)
        const content = await fetch_content(link) as string
        // turn it into small chunks
        // const chunks = splitContentByWords(content, 2000); 
        const chunks = content.split('\n\n');
        // for each chunk create a new search result
        for (const chunk of chunks) {
            const searchResult = new SearchResult(title, link, chunk);
            chuncks.push(searchResult);
        }
        const searchResult = new SearchResult(title, link, content);
        chuncks.push(searchResult);
    }));
    // return [...chuncks.slice(0, 5), ...chuncks.slice(10, 15), ...chuncks.slice(20, 25)];
    return chuncks;
}


export async function processResults(links: string[]): Promise<any> {

    const results = await fetchPageContent(links);

    return results;

}
