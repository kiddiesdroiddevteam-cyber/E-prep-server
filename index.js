require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const multer = require('multer');
// const pdfParse = require('pdf-parse');
const { PDFParse } = require('pdf-parse');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const fs = require('fs/promises'); // Use fs.promises for async file operations
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // For parsing application/json

// --- PDF Storage Configuration ---
// In a real application, you might use a database (e.g., PostgreSQL, MongoDB)
// or a cloud storage service (e.g., AWS S3, Google Cloud Storage) to store the extracted text.
// For this example, we'll use a simple in-memory object to store the extracted PDF text.
// This is NOT suitable for production as data will be lost on server restart.
const pdfContentStore = {}; // Stores { contentId: "extracted text" }

// Multer storage configuration for temporary file upload
const storage = multer.memoryStorage(); // Store the file in memory as a Buffer
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are allowed!'), false);
    }
    cb(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB file size limit
  },
});

// --- Routes ---

// 1. POST /api/upload-pdf
// Handles PDF file upload, extracts text, and stores it.
app.post('/api/upload-pdf', upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No PDF file uploaded.' });
  }

  try {
    const dataBuffer = req.file.buffer; // Get the PDF file buffer from multer
   console.log(`Received PDF upload: ${req.file.originalname}, size: ${req.file.size} bytes`);
    // Use pdf-parse to extract text
     const uint8Array = new Uint8Array(dataBuffer);
    const data = new PDFParse(uint8Array);
   
	const result = await data.getText();
	console.log(result.text);
    const extractedText = result.text;
    console.log(`Extracted text length: ${extractedText.length} characters`);
    if (!extractedText || extractedText.trim().length === 0) {
        return res.status(400).json({ message: 'Could not extract text from the PDF, or the PDF is empty.' });
    }

    // Generate a unique ID for this PDF content
    const contentId = uuidv4();

    // Store the extracted text with its ID
    pdfContentStore[contentId] = extractedText;
    console.log(`PDF uploaded and text extracted. Content ID: ${contentId}`);

    res.status(200).json({ contentId, message: 'PDF uploaded and processed successfully.' });

  } catch (error) {
    console.error('Error processing PDF upload:', error);
    if (error.name === 'AbortError' || error.message.includes('PDF could not be read')) {
        return res.status(400).json({ message: 'Invalid or corrupt PDF file.' });
    }
    res.status(500).json({ message: 'Failed to process PDF.', error: error.message });
  }
});

// 2. GET /api/get-pdf-content/:id
// Retrieves the extracted text for a given contentId.
app.get('/api/get-pdf-content/:id', async (req, res) => {
  const contentId = req.params.id;
  const pdfText = pdfContentStore[contentId];
  console.log(pdfText, "checking pdf text");

  if (!pdfText) {
    return res.status(404).json({ message: 'PDF content not found for the given ID.' });
  }

  res.status(200).json({ pdfText });
});


// Basic error handling for routes not found
app.use((req, res, next) => {
    res.status(404).json({ message: 'API route not found.' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Global Error Handler:', err.stack);
    res.status(500).json({ message: 'Something went wrong!', error: err.message });
});


// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});