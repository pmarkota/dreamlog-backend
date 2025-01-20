const sgMail = require("@sendgrid/mail");
const client = require("@sendgrid/client");
const configModule = require("../config/config");

// Handle both nested and direct config
const config = configModule.config || configModule;

console.log("Email service config structure:", {
  hasConfig: !!config,
  hasSendGrid: !!config?.sendgrid,
  sendgridKeys: config?.sendgrid ? Object.keys(config.sendgrid) : [],
});

// Validate SendGrid configuration
if (!config?.sendgrid?.apiKey) {
  console.warn(
    "SendGrid API key is missing. Email functionality will be disabled."
  );
  module.exports = {
    addToWaitlist: async () => {
      console.log("Email functionality disabled - SendGrid not configured");
      return false;
    },
    sendEmail: async () => {
      console.log("Email functionality disabled - SendGrid not configured");
      return false;
    },
    sendWaitlistEmail: async () => {
      console.log("Email functionality disabled - SendGrid not configured");
      return false;
    },
    sendWelcomeEmail: async () => {
      console.log("Email functionality disabled - SendGrid not configured");
      return false;
    },
    sendBulkEmail: async () => {
      console.log("Email functionality disabled - SendGrid not configured");
      return false;
    },
  };
} else {
  sgMail.setApiKey(config.sendgrid.apiKey);
  client.setApiKey(config.sendgrid.apiKey);

  const FROM_EMAIL = config.sendgrid.fromEmail || "noreply@dreamlog.app";
  const FROM_NAME = config.sendgrid.fromName || "Dreamlog";
  const WAITLIST_LIST_ID = "2e1b99cc-e123-4360-bb66-c4c78b7b1a4d";
  const WAITLIST_TEMPLATE_ID = "d-92edaf8d637749ad8467e3a59fdae252";

  class EmailService {
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
        return true;
      } catch (error) {
        console.error("Error adding contact to SendGrid:", error);
        if (error.response) {
          console.error(error.response.body);
        }
        throw error;
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
        return true;
      } catch (error) {
        console.error("Error sending email:", error);
        if (error.response) {
          console.error(error.response.body);
        }
        throw error;
      }
    }

    static async sendWaitlistEmail(email, metadata = {}) {
      // First add to SendGrid contacts
      await this.addToWaitlist(email, metadata);
      // Then send the welcome email
      return this.sendEmail(email, "waitlist");
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
          sender_id: 1, // You might need to adjust this based on your SendGrid settings
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
        return true;
      } catch (error) {
        console.error("Error sending bulk email:", error);
        if (error.response) {
          console.error(error.response.body);
        }
        throw error;
      }
    }
  }

  module.exports = EmailService;
}
