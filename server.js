const express = require("express");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const multerS3 = require("multer-s3");
const { S3Client } = require("@aws-sdk/client-s3");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// File system paths
const dataFilePath = path.join(__dirname, "data.json");

// Utility functions for file system
const readData = () => {
  if (fs.existsSync(dataFilePath)) {
    const rawData = fs.readFileSync(dataFilePath);
    return JSON.parse(rawData);
  }
  return { productsData: [], categoriesData: [] };
};

const writeData = (data) => {
  fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
};

// Load data from file system
let { productsData, categoriesData } = readData();

// AWS S3 configuration using v3
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Set up multer for file upload with AWS SDK v3
const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET_NAME,
    acl: "public-read",
    metadata: (req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    },
    key: (req, file, cb) => {
      cb(null, `uploads/${Date.now()}_${file.originalname}`);
    },
  }),
});

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiter middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

// Utility function to generate a unique ID
const generateId = (prefix = "") =>
  `${prefix}${Date.now()}${Math.floor(Math.random() * 10000)}`;

// Routes

// Get all products
app.get("/products", (req, res) => {
  return res.json(productsData);
});

// Create a new product
app.post("/products", (req, res) => {
  const newProduct = req.body;
  newProduct.ProductID = generateId("prod_");
  productsData.push(newProduct);
  writeData({ productsData, categoriesData }); // Save to file
  return res.status(201).json(newProduct);
});

// Update a product
app.put("/products/:id", (req, res) => {
  const index = productsData.findIndex((p) => p.ProductID === req.params.id);
  if (index !== -1) {
    productsData[index] = { ...productsData[index], ...req.body };
    writeData({ productsData, categoriesData }); // Save to file
    return res.json(productsData[index]);
  } else {
    return res.status(404).json({ message: "Product not found" });
  }
});

// Delete a product
app.delete("/products/:id", (req, res) => {
  const index = productsData.findIndex((p) => p.ProductID === req.params.id);
  if (index !== -1) {
    productsData.splice(index, 1);
    writeData({ productsData, categoriesData }); // Save to file
    return res.status(204).end();
  } else {
    return res.status(404).json({ message: "Product not found" });
  }
});

// Get all categories
app.get("/categories", (req, res) => {
  return res.json(categoriesData);
});

// Create a new category
app.post("/categories", (req, res) => {
  const newCategory = req.body;
  newCategory.CategoryID = generateId("cat_");
  categoriesData.push(newCategory);

  writeData({ productsData, categoriesData }); // Save to file
  return res.status(201).json(newCategory);
});

// Update a category
app.put("/categories/:id", (req, res) => {
  const index = categoriesData.findIndex((c) => c.CategoryID === req.params.id);
  if (index !== -1) {
    categoriesData[index] = { ...categoriesData[index], ...req.body };
    writeData({ productsData, categoriesData }); // Save to file
    return res.json(categoriesData[index]);
  } else {
    return res.status(404).json({ message: "Category not found" });
  }
});

// Delete a category
app.delete("/categories/:id", (req, res) => {
  const index = categoriesData.findIndex((c) => c.CategoryID === req.params.id);
  if (index !== -1) {
    categoriesData.splice(index, 1);
    writeData({ productsData, categoriesData }); // Save to file
    return res.status(204).end();
  } else {
    return res.status(404).json({ message: "Category not found" });
  }
});

// Upload image to S3 using AWS SDK v3
app.post("/upload", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  // File URL
  const fileUrl = req.file.location;
  console.log("fileUrl :", fileUrl);

  return res.status(200).json({ imageUrl: fileUrl });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
