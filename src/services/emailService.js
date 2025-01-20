const sgMail = require("@sendgrid/mail");
const client = require("@sendgrid/client");
const config = require("../config/config");

// Add detailed debug logging
console.log("Raw environment variables:", {
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY ? "exists" : "missing",
  SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL ? "exists" : "missing",
  SENDGRID_FROM_NAME: process.env.SENDGRID_FROM_NAME ? "exists" : "missing",
});

console.log("Config in email service:", {
  hasConfig: !!config,
  configKeys: Object.keys(config),
  sendgridConfig: config?.sendgrid || "missing",
});

// Add debug logging for SendGrid configuration
console.log("Email service configuration:", {
  hasConfig: !!config,
  hasSendGrid: !!config?.sendgrid,
  hasApiKey: !!config?.sendgrid?.apiKey,
  hasFromEmail: !!config?.sendgrid?.fromEmail,
  hasFromName: !!config?.sendgrid?.fromName,
});

// Validate SendGrid configuration
if (!config?.sendgrid?.apiKey) {
  console.warn(
    "SendGrid API key is missing. Email functionality will be disabled."
  );

  class DisabledEmailService {
    static isEnabled() {
      return false;
    }

    static async addToWaitlist(email, metadata = {}) {
      console.log("Email functionality disabled - SendGrid not configured");
      return { success: false, reason: "email_disabled" };
    }

    static async sendEmail(to, templateName) {
      console.log("Email functionality disabled - SendGrid not configured");
      return { success: false, reason: "email_disabled" };
    }

    static async sendWaitlistEmail(email, metadata = {}) {
      console.log("Email functionality disabled - SendGrid not configured");
      return { success: false, reason: "email_disabled" };
    }

    static async sendWelcomeEmail(email) {
      console.log("Email functionality disabled - SendGrid not configured");
      return { success: false, reason: "email_disabled" };
    }

    static async sendBulkEmail(options) {
      console.log("Email functionality disabled - SendGrid not configured");
      return { success: false, reason: "email_disabled" };
    }
  }

  module.exports = DisabledEmailService;
} else {
  sgMail.setApiKey(config.sendgrid.apiKey);
  client.setApiKey(config.sendgrid.apiKey);

  const FROM_EMAIL = config.sendgrid.fromEmail || "noreply@dreamlog.app";
  const FROM_NAME = config.sendgrid.fromName || "Dreamlog";
  const WAITLIST_LIST_ID = "2e1b99cc-e123-4360-bb66-c4c78b7b1a4d";
  const WAITLIST_TEMPLATE_ID = "d-92edaf8d637749ad8467e3a59fdae252";

  class EmailService {
    static isEnabled() {
      return true;
    }

    static async addToWaitlist(email, metadata = {}) {
      const data = {
        contacts: [
          {
            email,
            custom_fields: {
              signup_source: metadata.source,
              user_language: metadata.language,
              signup_date: metadata.timestamp,
            },
          },
        ],
        list_ids: [WAITLIST_LIST_ID],
      };

      try {
        const request = {
          url: "/v3/marketing/contacts",
          method: "PUT",
          body: data,
        };

        await client.request(request);
        console.log(`Added ${email} to SendGrid waitlist`);
        return { success: true };
      } catch (error) {
        console.error("Error adding contact to SendGrid:", error);
        if (error.response) {
          console.error(error.response.body);
        }
        return {
          success: false,
          reason: "sendgrid_error",
          error: error.message,
        };
      }
    }

    static async sendEmail(to, templateName) {
      const msg = {
        to,
        from: {
          email: FROM_EMAIL,
          name: FROM_NAME,
        },
        template_id: WAITLIST_TEMPLATE_ID,
        asm: {
          group_id: 26944,
        },
        dynamic_template_data: {
          // Add any dynamic data you want to use in your template
          // For example:
          // first_name: data.firstName,
          // custom_message: data.message,
        },
      };

      try {
        await sgMail.send(msg);
        console.log(`Email sent successfully to ${to}`);
        return { success: true };
      } catch (error) {
        console.error("Error sending email:", error);
        if (error.response) {
          console.error(error.response.body);
        }
        return {
          success: false,
          reason: "sendgrid_error",
          error: error.message,
        };
      }
    }

    static async sendWaitlistEmail(email, metadata = {}) {
      try {
        // First add to SendGrid contacts
        const addResult = await this.addToWaitlist(email, metadata);
        if (!addResult.success) {
          return addResult;
        }
        // Then send the welcome email
        return await this.sendEmail(email, "waitlist");
      } catch (error) {
        console.error("Error in sendWaitlistEmail:", error);
        return {
          success: false,
          reason: "sendgrid_error",
          error: error.message,
        };
      }
    }

    static async sendWelcomeEmail(email) {
      return this.sendEmail(email, "welcome");
    }

    static async sendBulkEmail({
      listId,
      templateId,
      subject,
      sendAt = null, // Unix timestamp for scheduled sending
    }) {
      try {
        const data = {
          name: subject,
          sender_id: 1,
          subject: subject,
          list_ids: [listId],
          template_id: templateId,
          suppression_group_id: 26944,
          custom_unsubscribe_url: "",
          send_at: sendAt,
        };

        const request = {
          url: "/v3/marketing/singlesends",
          method: "POST",
          body: data,
        };

        // Create the campaign
        const [response] = await client.request(request);
        const campaignId = response.body.id;

        // Schedule or send the campaign immediately
        const scheduleRequest = {
          url: `/v3/marketing/singlesends/${campaignId}/schedule`,
          method: "PUT",
          body: { send_at: sendAt ? sendAt : "now" },
        };

        await client.request(scheduleRequest);
        console.log(
          `Bulk email ${
            sendAt ? "scheduled" : "sent"
          } successfully to list ${listId}`
        );
        return { success: true };
      } catch (error) {
        console.error("Error sending bulk email:", error);
        if (error.response) {
          console.error(error.response.body);
        }
        return {
          success: false,
          reason: "sendgrid_error",
          error: error.message,
        };
      }
    }
  }

  module.exports = EmailService;
}
