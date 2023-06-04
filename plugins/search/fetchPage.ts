import SearchResult from "./searchResult";
import fetch from "node-fetch";


export interface Main {
    result: Result;
}

export interface Result {
    body: string;
    url: string;
    title: string;
    metaDescription: string;
    links: string[];
    internalLinks: string[];
    externalLinks: any[];
    headers: Headers;
    contentText: string;
}

export interface Headers {
    h1: H1[];
    h2: H1[];
    h3: any[];
    h4: any[];
    h5: any[];
    h6: any[];
}

export interface H1 {
    text: string;
    content: string;
}


/**
 * Retrieves the page's content using Maila AI's page API.
 * @param {string} text The URL to search.
 * @returns {Promise<Main>} The page content.
 */
export const pageCrawler = async (text: string): Promise<Main> => {
    const url = `https://api.maila.ai/page`;
    let bodyContent = JSON.stringify({
        url: text,
    });
    try {
        const response = await fetch(url, {
            headers: {
                "Content-Type": "application/json",
            },
            body: bodyContent,
            method: "POST",
        });
        const res = await response.json() || { result: { body: "", url: "", title: "", metaDescription: "", links: [], internalLinks: [], externalLinks: [], headers: { h1: [], h2: [], h3: [], h4: [], h5: [], h6: [] }, contentText: "" } };
        return res;
    } catch (error) {
        console.log(error);
        return { result: { body: "", url: "", title: "", metaDescription: "", links: [], internalLinks: [], externalLinks: [], headers: { h1: [], h2: [], h3: [], h4: [], h5: [], h6: [] }, contentText: "" } };
    }
};


/**
 * Indexing urls: get the page context for each url
 * @param {string[]} links An array of links.
 * @returns {Promise<Object[][]>} An array of objects containing string and the specified attribute.
 */
export async function fetchPageContent(links: string[]): Promise<Result[]> {
    let pageContexts = await Promise.all(
        links.map(async (link) => {
            const res = await pageCrawler(link);
            return res.result;
        })
    );
    return pageContexts;
}


/**
 * Indexing urls: get headers and it's respective content
 *  headers: {
 *     h1: [
 *      {
 *         text: "string",
 *        content: "string"
 *     }
 *    ]
 * }
 */

export async function getHContent(links: string[]): Promise<string[]> {
    let headers = await Promise.all(
        links.map(async (link) => {
            const res = await pageCrawler(link) || { result: { headers: { h1: [], h2: [], h3: [] } } };
            const headers = res.result.headers;
            // header and it's content
            const h1 = headers.h1.map((h1) => {
                return {
                    text: h1.text,
                    content: h1.content,
                };
            });
            const h2 = headers.h2.map((h2) => {
                return {
                    text: h2.text,
                    content: h2.content,
                };
            });
            const h3 = headers.h3.map((h3) => {
                return {
                    text: h3.text,
                    content: h3.content,
                };
            });
            // get all headers and it's content as a sttring with a space and : as a separator between header and content
            const allHeaders = h1
                .concat(h2)
                .concat(h3)
                .map((h) => {
                    return `${h.text}: ${h.content}`;
                })
                .join(" ");
            // return all headers and it's content as a string
            return allHeaders;
        })
    );
    return headers;
}

/**
 * Searches for addresses using Maila AI's search API.
 * @param {string} text The keyword to search.
 * @param {string} page The number of pages in the search result.
 * @returns {Promise<Object>} The list of addresses.
 */
export const addressCrawler = async (text: string, page: string) => {
    var url = `https://api.maila.ai/search`;
    let bodyContent = JSON.stringify({
        query: text,
        page: page,
        // type: "scholar",
    });
    try {
        const response = await fetch(url, {
            headers: {
                "Content-Type": "application/json",
            },
            body: bodyContent,
            method: "POST",
        });
        const res = await response.json();
        console.log(res);
        return res;
    } catch (error) {
        console.log(error);
    }
};


function stringifyHeaders(headers: any) {
    const processHeaders = (headerArray: any) =>
        headerArray.map(({ text = "", content = "" } = {}) => `${text}: ${content}`)
            .join(" ");

    const cleanedString = (str: any) =>
        str.replace(/(\r\n|\n|\r|\t)/gm, " ").replace(/\s+/g, " ").trim().substring(0, 2000);

    if (!headers) return "";

    const allHeaders = [
        ...processHeaders(headers.h1),
        ...processHeaders(headers.h2),
        ...processHeaders(headers.h3),
    ].join(" ");

    console.log(allHeaders)

    return cleanedString(allHeaders);
}


export async function getPageContent(links: string[]): Promise<any[][]> {
    const chunkify = (arr: any[], size: number) =>
        Array.from({ length: Math.ceil(arr.length / size) }, (_v, i) =>
            arr.slice(i * size, i * size + size)
        );

    const delay = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));

    const linksChunks = chunkify(links, 1000);

    let pageContents: any[] = [];

    for (const chunk of linksChunks) {
        const chunkLinks = await Promise.all(
            chunk.map(async (link) => {
                const pageContexts = await pageCrawler(link).then((res) => {
                    if (res?.result?.headers) {
                        return {
                            link: link,
                            title: res?.result?.title || "",
                            content: stringifyHeaders(res.result.headers) || "",
                        };
                    }
                });
                if (pageContexts) {
                    console.log(pageContexts);
                    return pageContexts;
                } else {
                    return null;
                }
            })
        );

        pageContents = pageContents.concat(chunkLinks);
        await delay(1000); // Wait 1 seconds before processing the next chunk
    }

    const uniquecontents = filterUniqueNonNull(pageContents) || [];

    return uniquecontents;
}

/**
 * Filters out duplicate and null values from an array.
 * @param {any[]} array The array to filter.
 * @returns {any[]} The filtered array.
 */
function filterUniqueNonNull(array: any[]): any[] {
    const uniqueArray = array.filter((v, i, a) => a.indexOf(v) === i);
    const filteredArray = uniqueArray.filter(
        (el) => el !== null && el !== undefined
    );
    return filteredArray;
}