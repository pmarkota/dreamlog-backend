require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const app = express();

// Configure CORS for production and development
const allowedOrigins = [
  "https://dreamlog-frontend.vercel.app",
  "https://dreamlog-backend.vercel.app",
  "http://localhost:3000",
  "http://localhost:5000",
];

// CORS configuration
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) === -1) {
        console.log("Blocked origin:", origin); // Debug log
        return callback(null, false);
      }
      return callback(null, true);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
    credentials: true,
    maxAge: 86400, // Cache preflight request for 24 hours
  })
);

// Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, // Disable CSP for simplicity in development
  })
);

// Debug middleware to log requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log("Origin:", req.headers.origin);
  console.log("Headers:", req.headers);
  next();
});

app.use(morgan("dev"));
app.use(express.json());

// Basic route with CORS headers
app.get("/", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.json({ message: "Welcome to DreamLog API" });
});

// Import routes
const authRoutes = require("./routes/auth");
const dreamsRoutes = require("./routes/dreams");
const dreamAnalysisRoutes = require("./routes/dreamAnalysis");

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/dreams", dreamsRoutes);
app.use("/api/analysis", dreamAnalysisRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Something went wrong!",
    error:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal server error",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log("Allowed origins:", allowedOrigins);
});
