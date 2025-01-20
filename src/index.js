require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const app = express();

// Updated CORS configuration for Vercel
const allowedOrigins = [
  "https://dreamlog-frontend.vercel.app",
  "https://dreamlog-frontend-26tuh6do5-petars-projects-c8c2d231.vercel.app",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg =
          "The CORS policy for this site does not allow access from the specified Origin.";
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(helmet());
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
