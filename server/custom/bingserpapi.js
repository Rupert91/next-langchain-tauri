import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Tool } from "@langchain/core/tools";
/**
 * A tool for web search functionality using Bing's search engine. It
 * extends the base `Tool` class and implements the `_call` method to
 * perform the search operation. Requires an API key for Bing's search
 * engine, which can be set in the environment variables. Also accepts
 * additional parameters for the search query.
 */
class BingSerpAPI extends Tool {
    static lc_name() {
        return "BingSerpAPI";
    }
    /**
     * Not implemented. Will throw an error if called.
     */
    toJSON() {
        return this.toJSONNotImplemented();
    }
    constructor(apiKey = getEnvironmentVariable("BingApiKey"), params = {}) {
        super(...arguments);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "bing-search"
        });
        Object.defineProperty(this, "description", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "a search engine. useful for when you need to answer questions about current events. input should be a search query."
        });
        Object.defineProperty(this, "key", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "params", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        if (!apiKey) {
            throw new Error("BingSerpAPI API key not set. You can set it as BingApiKey in your .env file.");
        }
        this.key = apiKey;
        this.params = params;
    }
    /** @ignore */
    async _call(input) {
        const headers = { "Ocp-Apim-Subscription-Key": this.key };
        const params = { q: input,count: 5, textDecorations: "true", textFormat: "HTML" };
        const searchUrl = new URL("https://api.bing.microsoft.com/v7.0/search");
        Object.entries(params).forEach(([key, value]) => {
            searchUrl.searchParams.append(key, value);
        });
        const response = await fetch(searchUrl, { headers });
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        const res = await response.json();
        // console.log(res)
        const results = res.webPages.value;
        if (results.length === 0) {
            return "No good results found.";
        }
        const snippets = results
            .map((result) => `[*${result.snippet.replace(/<b>/g,'**').replace(/<\/b>/g,'**  ')}*](${result.url})`)
            .join("\n\n");
        return  snippets+"\n\n";
    }
}
export { BingSerpAPI };
