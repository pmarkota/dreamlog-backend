require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const app = express();

// Configure CORS to accept requests from Expo app
app.use(
  cors({
    origin: true, // Allow all origins in development
    credentials: false,
  })
);

// Middleware
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);
  next();
});

// Basic route
app.get("/", (req, res) => {
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

const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";
const NETWORK_IP = "172.20.10.2";

// Listen on all network interfaces
app.listen(PORT, HOST, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`Network: http://${NETWORK_IP}:${PORT}`);
  console.log(`API Endpoint: http://${NETWORK_IP}:${PORT}/api`);
});
