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
 * Cleans the HTML by removing scripts, styles, and unnecessary content
 * @param {string} html - Raw HTML content
 * @returns {string} - Simplified HTML
 */
function cleanHtml(html) {
    return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\s{2,}/g, ' ');
}

/**
 * Extract product information from HTML to prepare for AI processing
 * @param {string} html - Cleaned HTML content
 * @param {string} url - Product URL
 * @returns {string} - Processed content with labeled product info
 */
function extractProductInfo(html, url) {
    const productInfo = [];

    // Extract product title
    const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/i) ||
        html.match(/<title[^>]*>(.*?)<\/title>/i) ||
        html.match(/<div[^>]*product-title[^>]*>(.*?)<\/div>/i);

    if (titleMatch) {
        productInfo.push(`PRODUCT TITLE: ${titleMatch[1].trim()}`);
    }

    // Extract price
    const priceMatch = html.match(/class=["|']price["|'][^>]*>(.*?)<\/span>/i) ||
        html.match(/class=["|']product-price["|'][^>]*>(.*?)<\/div>/i) ||
        html.match(/\$(\d+\.?\d*)/i);

    if (priceMatch) {
        productInfo.push(`PRODUCT PRICE: ${priceMatch[1] || priceMatch[0]}`);
    }

    // Extract available size options
    const availableSizes = extractSizeOptions(html, false);
    if (availableSizes.length > 0) {
        productInfo.push(`AVAILABLE SIZE OPTIONS: ${availableSizes.join(', ')}`);
    }

    // Extract available color options with enhanced detection
    const availableColors = extractColorOptions(html);
    if (availableColors.length > 0) {
        productInfo.push(`AVAILABLE COLOR OPTIONS: ${availableColors.join(', ')}`);
    }

    // Extract product description
    const descMatch = html.match(/<div[^>]*(?:product-description|description)[^>]*>([\s\S]*?)<\/div>/i) ||
        html.match(/<meta[^>]*description[^>]*content=["|'](.*?)["|']/i);

    if (descMatch) {
        const description = descMatch[1].replace(/<[^>]*>/g, ' ').trim();
        productInfo.push(`PRODUCT DESCRIPTION: ${description.substring(0, 200)}...`);
    }

    // Extract product category
    const catMatch = html.match(/<nav[^>]*breadcrumb[^>]*>([\s\S]*?)<\/nav>/i) ||
        html.match(/<meta[^>]*product:category[^>]*content=["|'](.*?)["|']/i);

    if (catMatch) {
        const category = catMatch[1].replace(/<[^>]*>/g, ' ').trim();
        productInfo.push(`PRODUCT CATEGORY: ${category}`);
    }

    // If we have enough product info, return a structured format
    if (productInfo.length >= 2) {
        return `
PRODUCT URL: ${url}
${productInfo.join('\n')}

ADDITIONAL HTML SNIPPETS:
${html.substring(0, 2000)}
    `;
    }

    // Otherwise return a portion of the HTML
    return `
PRODUCT URL: ${url}
RAW HTML:
${html.substring(0, 4000)}
  `;
}

/**
 * Extract size options from HTML
 * @param {string} html - HTML content
 * @param {boolean} includeUnavailable - Whether to include unavailable options
 * @returns {Array} - Array of size options
 */
function extractSizeOptions(html, includeUnavailable = false) {
    const sizeContainers = [
        (html.match(/<select[^>]*(?:size|variant)[^>]*>([\s\S]*?)<\/select>/i) || [])[1],
        (html.match(/<div[^>]*(?:size|variant)[^>]*>([\s\S]*?)<\/div>/i) || [])[1],
        (html.match(/<ul[^>]*(?:size|variant)[^>]*>([\s\S]*?)<\/ul>/i) || [])[1]
    ].filter(Boolean);

    const sizeOptions = [];

    for (const container of sizeContainers) {
        if (!container) continue;

        // Get all options
        const options = [
            ...(container.match(/<option[^>]*>(.*?)<\/option>/gi) || []),
            ...(container.match(/<li[^>]*>(.*?)<\/li>/gi) || []),
            ...(container.match(/<button[^>]*>(.*?)<\/button>/gi) || []),
            ...(container.match(/<a[^>]*>(.*?)<\/a>/gi) || []),
            ...(container.match(/<div[^>]*option[^>]*>(.*?)<\/div>/gi) || [])
        ];

        for (const option of options) {
            // Skip if disabled and we don't want unavailable options
            if (!includeUnavailable && option.match(/disabled|sold[\s-]*out|out[\s-]*of[\s-]*stock|unavailable/i)) {
                continue;
            }

            // Extract the text content
            const text = option.replace(/<[^>]*>/g, '').trim();

            // Skip empty or selector placeholders
            if (!text || text.includes('Select') || text.includes('Choose')) {
                continue;
            }

            sizeOptions.push(text);

            // Also check for value attributes that might contain the size
            const valueMatch = option.match(/value=["|'](.*?)["|']/i);
            if (valueMatch && valueMatch[1] &&
                !/^\d+$/.test(valueMatch[1]) &&
                !valueMatch[1].includes('select') &&
                valueMatch[1].length < 10) {

                sizeOptions.push(valueMatch[1]);
            }
        }
    }

    // Remove duplicates and clean up
    return [...new Set(sizeOptions)].filter(size =>
        size &&
        size.length < 20 &&
        !size.includes('select') &&
        !size.includes('choose')
    );
}

/**
 * Extract color options from HTML with enhanced detection
 * @param {string} html - HTML content
 * @returns {Array} - Array of available color options
 */
function extractColorOptions(html) {
    // Find potential color containers
    const colorContainers = [
        (html.match(/<select[^>]*(?:color|colour)[^>]*>([\s\S]*?)<\/select>/i) || [])[1],
        (html.match(/<div[^>]*(?:color|colour)[^>]*>([\s\S]*?)<\/div>/i) || [])[1],
        (html.match(/<ul[^>]*(?:color|colour)[^>]*>([\s\S]*?)<\/ul>/i) || [])[1],
        (html.match(/<div[^>]*swatch[^>]*>([\s\S]*?)<\/div>/i) || [])[1]
    ].filter(Boolean);

    const colorOptions = [];

    // Specific color keywords to help with detection
    const colorKeywords = [
        'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown', 'black',
        'white', 'gray', 'grey', 'navy', 'teal', 'gold', 'silver', 'beige', 'burgundy',
        'turquoise', 'lavender', 'cream', 'khaki', 'olive'
    ];

    // Process each container
    for (const container of colorContainers) {
        if (!container) continue;

        // Get all potential color elements
        const options = [
            ...(container.match(/<option[^>]*>(.*?)<\/option>/gi) || []),
            ...(container.match(/<li[^>]*>(.*?)<\/li>/gi) || []),
            ...(container.match(/<button[^>]*>(.*?)<\/button>/gi) || []),
            ...(container.match(/<a[^>]*>(.*?)<\/a>/gi) || []),
            ...(container.match(/<div[^>]*swatch[^>]*>(.*?)<\/div>/gi) || []),
            ...(container.match(/<span[^>]*color[^>]*>(.*?)<\/span>/gi) || [])
        ];

        for (const option of options) {
            // Skip if disabled
            if (option.match(/disabled|sold[\s-]*out|out[\s-]*of[\s-]*stock|unavailable/i)) {
                continue;
            }

            // Extract the text content
            const text = option.replace(/<[^>]*>/g, '').trim();

            // If text might be a color name, add it
            if (text && !text.includes('Select') && !text.includes('Choose') &&
                (colorKeywords.some(color => text.toLowerCase().includes(color)) || text.length < 15)) {
                colorOptions.push(text);
            }

            // Check for color in style attribute (background color)
            const styleMatch = option.match(/style=["|'].*?background(?:-color)?:\s*(.*?)[;"|']/i);
            if (styleMatch && styleMatch[1]) {
                colorOptions.push(styleMatch[1].trim());
            }

            // Check for color-related classes
            const classMatch = option.match(/class=["|'](.*?)["|']/i);
            if (classMatch && classMatch[1]) {
                const classes = classMatch[1].split(/\s+/);
                for (const cls of classes) {
                    if (colorKeywords.some(color => cls.toLowerCase().includes(color))) {
                        // Extract color from class name
                        const colorName = colorKeywords.find(color => cls.toLowerCase().includes(color));
                        if (colorName && !colorOptions.includes(colorName)) {
                            colorOptions.push(colorName);
                        }
                    }
                }
            }

            // Check for data-color attribute
            const dataColorMatch = option.match(/data-color=["|'](.*?)["|']/i);
            if (dataColorMatch && dataColorMatch[1]) {
                colorOptions.push(dataColorMatch[1]);
            }
        }
    }

    // Remove duplicates and clean up
    return [...new Set(colorOptions)].filter(color =>
        color &&
        color.length < 20 &&
        !color.includes('select') &&
        !color.includes('choose')
    );
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

        // Process the HTML
        const cleanedHtml = cleanHtml(html);
        const processedHtml = extractProductInfo(cleanedHtml, url);

        // Log for debugging
        console.log("Processed HTML length:", processedHtml.length);

        // Create a prompt focused on only available options
        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: `You are a product data extraction expert. Extract ONLY AVAILABLE product attributes from the HTML.
Your output must be ONLY valid JSON without any explanations.`
                },
                {
                    role: "user",
                    content: `Extract only AVAILABLE product information from this HTML.

Use this exact JSON structure:
{
  "url": "${url}",
  "title": "Product title",
  "category": "Product category (use 'Unknown' only if absolutely no category information is found)",
  "attributes": {
    "colorOptions": ["ONLY available color options"],
    "sizeOptions": ["ONLY available size options"]
    // Include other available product attributes
  },
  "rawPrice": 0 // Numeric price without currency symbols
}

HTML Content:
${processedHtml}`
                }
            ],
            max_tokens: 1000,
            temperature: 0.1,
        });

        // Get the response content
        const content = response.choices[0].message.content;
        console.log("OpenAI response start:", content.substring(0, 100) + "...");

        // Parse the JSON response
        try {
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
                attributes: {
                    colorOptions: [],
                    sizeOptions: []
                },
                rawPrice: 0
            };
        }
    } catch (error) {
        console.error('Error extracting product data:', error);
        // Create a basic fallback response
        return {
            url: url,
            title: "Error: " + error.message.substring(0, 30),
            category: "Unknown",
            attributes: {
                colorOptions: [],
                sizeOptions: []
            },
            rawPrice: 0
        };
    }
}

module.exports = {
    fetchProductPage,
    extractProductData
};