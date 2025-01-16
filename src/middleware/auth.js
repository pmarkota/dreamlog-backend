const jwt = require("jsonwebtoken");

const authenticateToken = (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res
        .status(401)
        .json({ message: "No authentication token, access denied" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    next();
  } catch (error) {
    res.status(401).json({ message: "Token is invalid or expired" });
  }
};

const isPremium = (req, res, next) => {
  if (!req.user.is_premium) {
    return res.status(403).json({ message: "Premium subscription required" });
  }
  next();
};

module.exports = {
  authenticateToken,
  isPremium,
};
