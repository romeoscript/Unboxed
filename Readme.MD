# Product Parser API

A REST API that extracts structured product data from URLs using OpenAI's GPT-4.

## Live API URL

**API Endpoint**: `https://unboxed-weld.vercel.app/parse-product`

## Overview

This API takes a product URL and OpenAI API key, fetches the HTML from the product page, and uses OpenAI's GPT-4 to extract structured product data, returning a standardized JSON response.

## Sample Request & Response

### Request

```bash
curl -X POST https://unboxed-weld.vercel.app/parse-product \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://now-time.biz/products/issue-1-whirlpool?variant=42480670539836",
    "openaiApiKey": "sk-your-openai-api-key"
  }'
```

### Response

```json
{
  "url": "https://now-time.biz/products/issue-1-whirlpool?variant=42480670539836",
  "title": "Issue 1: Whirlpool",
  "category": "Magazine",
  "attributes": {
    "formatOptions": ["Print", "Digital"],
    "language": "English",
    "pageCount": 148,
    "publisher": "NOW TIME Press"
  },
  "rawPrice": 29.99
}
```

## Local Run Instructions

1. Clone the repository:
   ```
   git clone https://github.com/romeoscript/Unboxed.git
   cd Unboxed
   ```

2. Install dependencies:
   ```
   npm install
   ```


4. Run the development server:
   ```
   npm run dev
   ```

5. The API will be available at `http://localhost:3000`

6. You can access a simple testing UI by opening `http://localhost:3000` in your browser

## Testing the API

You can test the API using the included test script:

1. Set your OpenAI API key in the `.env` file:
   ```
   OPENAI_API_KEY=sk-your-api-key
   ```

2. Run the test script:
   ```
   node test.js
   ```

This will make a request to the API with a sample product URL and display the results.

## Design Choices

### Prompt Strategy

My approach to the OpenAI prompt focuses on:

1. **HTML Preprocessing** - I aggressively reduce the HTML content by:
   - Extracting just the most relevant product sections
   - Removing scripts, styles, and comments
   - Limiting the character count to avoid token limits

2. **Clear Schema Instructions** - The prompt specifies the exact output structure required, matching the sample schema from the requirements

3. **Flexibility Emphasis** - The prompt instructs the model to capture any product-specific attributes while maintaining a consistent structure

4. **Optimized for Efficiency** - Using a lower temperature (0.1) and limited token output for more reliable and efficient extraction

### Output Schema Design

The schema is designed to be:

1. **Flexible** - Can accommodate various product types through the dynamic `attributes` object
2. **Structured** - Core fields like title, url, and category are standardized for easy querying
3. **Queryable** - Attributes are organized to enable filtering (e.g., find products with specific colors)

```json
{
  "url": "https://example.com/product/123",
  "title": "ACME Tee",
  "category": "T-Shirt",
  "attributes": {
    "colorOptions": ["Red", "Blue"],
    "sizeOptions": ["S", "M", "L"],
    "material": "Cotton",
    "weight": "150g"
  },
  "rawPrice": 29.99
}
```

This schema follows the requirements exactly while allowing for future expansion to handle any product type from t-shirts to motorcycles.

### Tradeoffs & TODOs

Given the 1-2 hour time constraint, I focused on a functional MVP. With more time, I would address:

1. **HTML Preprocessing Enhancement**
   - Add more sophisticated HTML cleaning to better extract product sections
   - Support for JavaScript-rendered content with Puppeteer/Playwright

2. **Reliability Improvements**
   - Add more means for color detection in product pages
   - Add retry logic for both fetching and AI processing
   - Implement caching to avoid redundant processing of the same URLs
   - Add defensive error handling for various HTML structures

3. **Schema Refinements**
   - Add validation to ensure consistent attribute formatting
   - Support additional product metadata when relevant
   - Create site-specific extractors for popular e-commerce platforms

4. **Performance Optimization**
   - Reduce token usage further with smarter HTML reduction
   - Support for batched processing of multiple products

5. **Testing & Monitoring**
   - Add unit tests for different product types
   - Add monitoring for API performance and reliability

## Technologies Used

- Node.js/Express
- OpenAI API (GPT-4)
- Axios for HTTP requests

