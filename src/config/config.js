require("dotenv").config();

module.exports = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY,
    fromEmail: process.env.SENDGRID_FROM_EMAIL,
    fromName: process.env.SENDGRID_FROM_NAME,
  },
};
