import { NotificationService } from "medusa-interfaces";
import nodemailer from "nodemailer";
import ejs from 'ejs';
import path from "path";

class NodemailerService extends NotificationService {
    static identifier = "nodemailer";

    constructor({ orderService, cartService, inviteService, swapService }, config) {
        super();
        /**
         * @param {Object} options - options defined in `medusa-config.js`
         *    e.g.
         *    {
         *      api_key: SendGrid api key
         *      from: Medusa <hello@medusa.example>,
         *      order_placed_template: 01234,
         *      order_updated_template: 56789,
         *      order_canceled_template: 4242,
         *      user_password_reset_template: 0000,
         *      customer_password_reset_template: 1111,
         *    }
         */

        this.config = {
            fromEmail: "noreply@fake.org",
            transport: {
                host: 'mail.demo.net',
                port: 587,
                secure: false, // Set it to true if you're using a secure connection (e.g., SSL/TLS)
                auth: {
                    user: 'demo@noreply.com', // Your email address
                    pass: 'pass' // Your email password or API key
                }
            },
            emailTemplatePath: path.join(__dirname, '..', 'templates'),
            templateMap: {
                "order.placed": "orderplaced",
            },
            ...config,
        };
        this.orderService = orderService;
        this.cartService = cartService;
        this.inviteService = inviteService;
        this.swapService = swapService;

        this.transporter = nodemailer.createTransport(this.config.transport);

        // Configure email template engine
        this.emailTemplateEngine = {
            compile: async (templateName, data) => {
            const templatePath = path.join(this.config.emailTemplatePath, `${templateName}.ejs`);
            return ejs.renderFile(templatePath, data);
            },
        };
    }

    async sendNotification(eventName, eventData, attachmentGenerator) {

        try {
            const { to, data } = await this.retrieveData(eventName, eventData);
        
            if (!to || !data) {
              console.warn(`No recipient or data found for event: ${eventName}`);
              return;
            }
        
            const templateName = this.getTemplateNameForEvent(eventName);
            
            console.log("data: ", data)
            // Render the email template using the template engine
            const html = await this.emailTemplateEngine.compile(templateName, data);
        
            const mailOptions = {
              from: this.config.fromEmail,
              to,
              subject: `Notification: ${eventName}`,
              html,
              attachments: attachmentGenerator ? await attachmentGenerator() : [],
            };
        
            // Send the email using Nodemailer
            await this.transporter.sendMail(mailOptions);
        
            console.log(`Notification email sent for event: ${eventName}`);
          } catch (error) {
            console.error(`Error sending notification email for event: ${eventName}`, error);
          }
    //     try {
    //       let emailData = await this.retrieveData(eventName, eventData);
    //       if (emailData) {
    //         let templateName = this.getTemplateNameForEvent(eventName);
    //         const email = new Email({
    //           message: {
    //             from: this.config.fromEmail,
    //           },
    //           transport: this.transporter,
    //           views: {
    //             root: this.config.emailTemplatePath,
    //             options: {
    //               extension: 'pug',
    //             },
    //           },
    //           send: true,
    //         });
    //         console.log("emailData.data.customer.email: ", emailData.data.customer.email)
    //         const status = await email
    //           .send({
    //             template: templateName,
    //             message: {
    //               to: emailData.data.customer.email,
    //             },
    //             locals: {
    //               locale: 'pt',
    //               data: emailData.data,
    //               env: process.env,
    //             },
    //           });
      
    //         return {
    //           to: emailData.data.customer.email,
    //           status: "sent",
    //           data: emailData.data,
    //         };
    //       } else {
    //         throw new Error("No email data found.");
    //       }
    //     } catch (error) {
    //       console.error("Failed to send notification:", error);
    //       return {
    //         status: "failed",
    //         error: error.message,
    //       };
    //     }
      }
      

    // async resendNotification(notification, config, attachmentGenerator) {
    //     let templateName = this.getTemplateNameForEvent(notification.event_name);
    //     if (templateName) {
    //         const email = new Email({
    //             message: {
    //                 from: this.config.fromEmail,
    //             },
    //             transport: this.transporter,
    //             views: {
    //                 root: this.config.emailTemplatePath,
    //             },
    //             send: true,
    //         });
    //         const status = await email
    //             .send({
    //                 template: templateName,
    //                 message: {
    //                     to: notification.to,
    //                 },
    //                 locals: {
    //                     data: notification.data,
    //                     env: process.env,
    //                 },
    //             })
    //             .then(() => "sent")
    //             .catch(() => "failed");
    //         return {
    //             to: notification.to,
    //             status,
    //             data: notification.data,
    //         };
    //     } else {
    //         return {
    //             to: notification.to,
    //             status: "noTemplateFound",
    //             data: notification.data,
    //         };
    //     }
    // }

    async retrieveData(eventName, eventData) {
        let sendData;
        let registeredEvent = this.config.templateMap[eventName];
        let eventType = eventName.split(".")[0];
        if (!registeredEvent) {
            return false;
        } else {
            switch (eventType) {
                case "order":
                    sendData = await this.orderService.retrieve(eventData.id, {
                        select: [
                            "shipping_total",
                            "discount_total",
                            "tax_total",
                            "refunded_total",
                            "gift_card_total",
                            "subtotal",
                            "total",
                            "refundable_amount",
                        ],
                        relations: [
                            "customer",
                            "billing_address",
                            "shipping_address",
                            "discounts",
                            "discounts.rule",
                            "shipping_methods",
                            "shipping_methods.shipping_option",
                            "payments",
                            "fulfillments",
                            "returns",
                            "gift_cards",
                            "gift_card_transactions",
                        ],
                    });
                    break;
                case "invite":
                    sendData = await this.inviteService.list(
                        {
                            id: eventData.id,
                        },
                        {}
                    );
                    return {
                        to: sendData[0].user_email,
                        data: sendData[0],
                    };
                case "swap":
                    sendData = await this.swapService.retrieve(eventData.id, {
                        relations: [
                            "additional_items",
                            "return_order",
                            "return_order.items",
                            "return_order.items.item",
                            "return_order.shipping_method",
                            "return_order.shipping_method.shipping_option",
                        ],
                    });
                    break;
                case "user":
                    console.log("INFO: user-related event notifications are currently not supported.");
                    // TODO: fetch user data
                    break;
                case "customer":
                    console.log("INFO: customer related event notifications are currently not supported.");
                    // TODO: fetch customer data
                    break;
            }
            return {
                to: sendData.email,
                data: sendData,
            };
        }
    }

    getTemplateNameForEvent(eventName) {
        let templateNameForEvent = this.config.templateMap[eventName];
        if (templateNameForEvent) {
          return templateNameForEvent;
        } else {
          console.warn(`No template found for event: ${eventName}`);
          throw new Error(`No template found for event: ${eventName}`);
        }
      }
}

export default NodemailerService;
