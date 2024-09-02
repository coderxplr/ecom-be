const express = require("express");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const multerS3 = require("multer-s3");
const { S3Client } = require("@aws-sdk/client-s3");
const { Pool } = require("pg");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

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
app.get("/products", async (req, res) => {
  try {
    const result = await pool.query("SELECT data FROM products");
    const products = result.rows.map(row => row.data);
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching products" });
  }
});

// Create a new product
app.post("/products", async (req, res) => {
  const newProduct = req.body;
  newProduct.ProductID = generateId("prod_");

  try {
    await pool.query(
      "INSERT INTO products (data) VALUES ($1)",
      [newProduct]
    );
    res.status(201).json(newProduct);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error creating product" });
  }
});

// Update a product
app.put("/products/:id", async (req, res) => {
  const { id } = req.params;
  const updatedProduct = req.body;

  try {
    const result = await pool.query(
      "UPDATE products SET data = jsonb_set(data, '{ProductID}', $1) WHERE data->>'ProductID' = $2 RETURNING data",
      [JSON.stringify(updatedProduct), id]
    );

    if (result.rows.length > 0) {
      res.json(result.rows[0].data);
    } else {
      res.status(404).json({ message: "Product not found" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating product" });
  }
});

// Delete a product
app.delete("/products/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM products WHERE data->>'ProductID' = $1 RETURNING data",
      [id]
    );

    if (result.rows.length > 0) {
      res.status(204).end();
    } else {
      res.status(404).json({ message: "Product not found" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting product" });
  }
});

// Get all categories
app.get("/categories", async (req, res) => {
  try {
    const result = await pool.query("SELECT data FROM categories");
    const categories = result.rows.map(row => row.data);
    res.json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching categories" });
  }
});

// Create a new category
app.post("/categories", async (req, res) => {
  const newCategory = req.body;
  newCategory.CategoryID = generateId("cat_");

  try {
    await pool.query(
      "INSERT INTO categories (data) VALUES ($1)",
      [newCategory]
    );
    res.status(201).json(newCategory);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error creating category" });
  }
});

// Update a category
app.put("/categories/:id", async (req, res) => {
  const { id } = req.params;
  const updatedCategory = req.body;

  try {
    const result = await pool.query(
      "UPDATE categories SET data = jsonb_set(data, '{CategoryID}', $1) WHERE data->>'CategoryID' = $2 RETURNING data",
      [JSON.stringify(updatedCategory), id]
    );

    if (result.rows.length > 0) {
      res.json(result.rows[0].data);
    } else {
      res.status(404).json({ message: "Category not found" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating category" });
  }
});

// Delete a category
app.delete("/categories/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM categories WHERE data->>'CategoryID' = $1 RETURNING data",
      [id]
    );

    if (result.rows.length > 0) {
      res.status(204).end();
    } else {
      res.status(404).json({ message: "Category not found" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting category" });
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

  res.status(200).json({ imageUrl: fileUrl });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
