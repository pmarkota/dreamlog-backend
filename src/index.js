require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const app = express();

// Disable helmet for now to rule out any interference
// app.use(helmet());

// Updated CORS configuration
app.use(cors()); // Allow all origins temporarily for debugging

// Enable pre-flight requests for all routes
app.options("*", cors());

app.use(morgan("dev"));
app.use(express.json());

// Import routes
const authRoutes = require("./routes/auth");
const dreamsRoutes = require("./routes/dreams");
const dreamAnalysisRoutes = require("./routes/dreamAnalysis");
const userRoutes = require("./routes/users");
const insightsRoutes = require("./routes/insights");
const waitlistRoutes = require("./routes/waitlist");

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/dreams", dreamsRoutes);
app.use("/api/analysis", dreamAnalysisRoutes);
app.use("/api/user", userRoutes);
app.use("/api/insights", insightsRoutes);
app.use("/api/waitlist", waitlistRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
