// src/searchResult.ts

class SearchResult {
    constructor(public title: string, public link: string, public content: string) { }

    toDict() {
        return {
            title: this.title,
            link: this.link,
            content: this.content
        };
    }
}

export default SearchResult;
