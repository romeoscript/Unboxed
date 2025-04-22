// server.js - Main entry point for our API
const express = require('express');
const cors = require('cors');
const path = require('path');
const { fetchProductPage, extractProductData } = require('./productService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'API is running' });
});

// Main product parsing endpoint
app.post('/parse-product', async (req, res) => {
  try {
    const { url, openaiApiKey } = req.body;
    
    // Validate required parameters
    if (!url || !openaiApiKey) {
      return res.status(400).json({ 
        error: 'Missing required parameters: url and openaiApiKey are required' 
      });
    }

    // Fetch HTML from the provided URL
    const html = await fetchProductPage(url);
    
    // Use OpenAI to extract product data
    const productData = await extractProductData(html, url, openaiApiKey);
    
    // Return the structured product data
    res.json(productData);
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ 
      error: 'Failed to process product URL',
      message: error.message 
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});