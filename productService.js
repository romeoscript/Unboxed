// productService.js - Service for fetching and processing product data
const axios = require('axios');
const OpenAI = require('openai');

/**
 * Fetches the HTML content from a product URL
 * @param {string} url - The product URL to fetch
 * @returns {Promise<string>} - The HTML content
 */
async function fetchProductPage(url) {
  try {
    // Use a user agent to avoid being blocked by some websites
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching URL ${url}:`, error.message);
    throw new Error(`Failed to fetch product page: ${error.message}`);
  }
}

/**
 * Extracts structured product data from HTML using OpenAI
 * @param {string} html - The HTML content of the product page
 * @param {string} url - The original product URL
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<Object>} - Structured product data
 */
async function extractProductData(html, url, apiKey) {
  try {
    const openai = new OpenAI({
      apiKey: apiKey
    });

    // Simplify HTML to reduce tokens
    const simplifyHtml = (html) => {
      // Remove all scripts, styles, SVGs, and comments
      let simplified = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\s{2,}/g, ' ');
      
      // Only keep a few key HTML tags that might contain product info
      const keyElements = [];
      
      // Try to find the title
      const titleMatch = simplified.match(/<title[^>]*>(.*?)<\/title>/i);
      if (titleMatch) keyElements.push(titleMatch[0]);
      
      // Try to find headings which might contain the product name
      const h1Matches = simplified.match(/<h1[^>]*>.*?<\/h1>/gi);
      if (h1Matches) keyElements.push(...h1Matches);
      
      // Try to find product price
      const priceMatches = simplified.match(/<[^>]*(?:price|cost)[^>]*>(?:(?!<\/div>)[\s\S])*<\/[^>]*>/gi);
      if (priceMatches) keyElements.push(...priceMatches);
      
      // Try to find product description
      const descMatches = simplified.match(/<[^>]*(?:description|details|features)[^>]*>(?:(?!<\/div>)[\s\S])*<\/[^>]*>/gi);
      if (descMatches) keyElements.push(...descMatches.slice(0, 2)); // Limit to just a couple
      
 
      if (keyElements.length >= 3) {
        return keyElements.join('\n').substring(0, 3000);
      }
      
      // Fallback to a short version of the HTML
      return simplified.substring(0, 3000);
    };

    const simplifiedHtml = simplifyHtml(html);
    
    // Log for debugging
    console.log("Simplified HTML length:", simplifiedHtml.length);
    console.log("First 100 chars:", simplifiedHtml.substring(0, 100));


    const response = await openai.chat.completions.create({
      model: "gpt-4", 
      messages: [
        {
          role: "system",
          content: `You are a JSON-only product information extractor. 
          You MUST ALWAYS respond with ONLY a valid JSON object and nothing else.
          Do not include any explanation, preamble, or commentary.`
        },
        {
          role: "user",
          content: `Extract basic product info from this HTML for: ${url}
          
          Respond with ONLY this JSON structure:
          {
            "url": "${url}",
            "title": "Product title",
            "category": "Product category if found, otherwise best guess",
            "attributes": {
              "colorOptions": ["array of colors if found"],
              "sizeOptions": ["array of sizes if found"],
              // other attributes you can find
            },
            "rawPrice": 29.99 // numeric price without currency symbol
          }
          
          HTML: ${simplifiedHtml}`
        }
      ],
      response_format: { type: "json_object" }, 
      max_tokens: 1000,
      temperature: 0,
    });

    // Get the response content
    const content = response.choices[0].message.content;
    console.log("OpenAI response:", content.substring(0, 100) + "...");

    // Parse the JSON response
    try {
      // First try direct parsing
      return JSON.parse(content);
    } catch (parseError) {
      console.error("Direct JSON parsing failed:", parseError.message);
      
      // Try to extract JSON from the response if there's text around it
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (matchError) {
          console.error("JSON extraction failed:", matchError.message);
        }
      }
      
      // If all parsing fails, create a basic fallback response
      console.error("Falling back to basic product data");
      return {
        url: url,
        title: "Product Title Not Extracted",
        category: "Unknown",
        attributes: {},
        rawPrice: 0
      };
    }
  } catch (error) {
    console.error('Error extracting product data:', error);
    // Create a basic fallback response
    return {
      url: url,
      title: "Error: " + error.message.substring(0, 30),
      category: "Error",
      attributes: {},
      rawPrice: 0
    };
  }
}

module.exports = {
  fetchProductPage,
  extractProductData
};