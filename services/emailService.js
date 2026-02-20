const nodemailer = require('nodemailer');
const config = require('../config');
const EmailConfig = require('../models/EmailConfig');
const EmailLog = require('../models/EmailLog');
const EmailTemplate = require('../models/EmailTemplate');

class EmailService {
    constructor() {
        this.transporter = null;
        this.config = null;
    }

    async refreshConfig() {
        try {
            const dbConfig = await EmailConfig.findOne({ isEnabled: true });
            if (dbConfig) {
                this.config = dbConfig;
                this.transporter = nodemailer.createTransport({
                    host: dbConfig.host,
                    port: dbConfig.port,
                    secure: dbConfig.port === 465 || dbConfig.secure,
                    auth: {
                        user: dbConfig.user,
                        pass: dbConfig.pass
                    }
                });
                return true;
            }
            
            
            // Fallback logic for config.js has been removed as it is now database driven
            console.warn('⚠️ No enabled email configuration found in database.');


            this.config = null;
            this.transporter = null;
            return false;
        } catch (error) {
            console.error('❌ Error refreshing email config:', error);
            return false;
        }
    }

    async ensureTransporter() {
        // Always refresh from DB to get latest settings for now
        // In production, you might want to cache this for a few minutes
        return await this.refreshConfig();
    }

    async logEmail(type, recipients, subject, status, error = null, metadata = null, htmlContent = null) {
        try {
            await EmailLog.create({
                recipients: Array.isArray(recipients) ? recipients : [recipients],
                subject,
                type,
                status,
                error: error ? error.message || String(error) : null,
                metadata,
                htmlContent
            });
        } catch (logError) {
            console.error('❌ Failed to save email log:', logError);
        }
    }

    async sendAdminNotification(subject, text, html) {
        if (!await this.ensureTransporter()) {
             console.log('⚠️ Cannot send admin notification: No valid email configuration found.');
             return;
        }
        
        if (!this.config.adminEmail || this.config.adminEmail.length === 0) {
            console.log('⚠️ Cannot send admin notification: No admin emails configured.');
            return;
        }

        console.log(`📧 Attempting to send Admin Notification to: ${this.config.adminEmail.join(', ')}`);

        try {
            // Send using template
            const params = {
                subject: subject,
                message: html || text
            };

            const info = await this.sendFromTemplate('admin_alert', params);
            console.log('✅ Admin notification email sent:', info.messageId);
            
            return info;
        } catch (error) {
            console.error('❌ Failed to send admin notification email:', error);
            
            await this.logEmail(
                'ADMIN_NOTIFICATION', 
                this.config.adminEmail, 
                `🚨 [Tracking Alert] ${subject}`, 
                'FAILED', 
                error
            );
        }
    }

    renderTemplate(templateContent, params) {
        // Replace {{variableName}} with actual values from params object
        let rendered = templateContent;
        for (const [key, value] of Object.entries(params)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            rendered = rendered.replace(regex, value);
        }
        return rendered;
    }

    async sendFromTemplate(templateName, params, recipientOverride = null) {
        if (!await this.ensureTransporter()) {
            console.log('⚠️ Cannot send email: No valid email configuration found.');
            return;
        }

        try {
            // Fetch template from database
            const template = await EmailTemplate.findOne({ name: templateName, isActive: true });
            if (!template) {
                throw new Error(`Template "${templateName}" not found or inactive`);
            }

            console.log(`📧 Using template: ${templateName}`);

            // Render template with parameters
            const subject = this.renderTemplate(template.subject, params);
            const textContent = this.renderTemplate(template.textContent, params);
            const htmlContent = this.renderTemplate(template.htmlContent, params);

            // Determine recipients
            const recipients = recipientOverride || this.config.adminEmail;
            if (!recipients || (Array.isArray(recipients) && recipients.length === 0)) {
                console.log('⚠️ Cannot send email: No recipients specified.');
                return;
            }

            const mailOptions = {
                from: `"${this.config.fromName}" <${this.config.user}>`,
                to: Array.isArray(recipients) ? recipients.join(', ') : recipients,
                subject: subject,
                text: textContent,
                html: htmlContent
            };

            console.log(`🚀 Sending email to: ${mailOptions.to}`);
            const info = await this.transporter.sendMail(mailOptions);
            console.log('✅ Email sent:', info.messageId);

            await this.logEmail(
                templateName.toUpperCase(),
                Array.isArray(recipients) ? recipients : [recipients],
                subject,
                'SUCCESS',
                null,
                { messageId: info.messageId, template: templateName },
                htmlContent
            );

            return info;
        } catch (error) {
            console.error('❌ Failed to send template email:', error);

            await this.logEmail(
                templateName.toUpperCase(),
                recipientOverride || this.config.adminEmail,
                `Template: ${templateName}`,
                'FAILED',
                error
            );
            throw error;
        }
    }

    async sendDeliveryNotification(trackingData) {
        if (!await this.ensureTransporter()) {
             console.log('⚠️ Cannot send delivery notification: No valid email configuration found.');
             return;
        }

        if (!this.config.adminEmail || this.config.adminEmail.length === 0) {
             console.log('⚠️ Cannot send delivery notification: No admin emails configured.');
             return;
        }

        console.log(`📧 Attempting to send Delivery Notification for ${trackingData.trackingId} to: ${this.config.adminEmail.join(', ')}`);

        try {
            // Send using template
            const params = {
                trackingId: trackingData.trackingId || '',
                originalTrackingId: trackingData.originalTrackingId || '',
                provider: trackingData.provider || '',
                status: trackingData.status || '',
                location: trackingData.location || 'N/A',
                destination: trackingData.destination || 'N/A',
                lastUpdated: trackingData.lastUpdated ? 
                    new Date(trackingData.lastUpdated).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 
                    'N/A'
            };

            const info = await this.sendFromTemplate('delivery_notification', params);
            console.log('✅ Delivery notification sent to admin:', trackingData.trackingId);
            
            return info;
        } catch (error) {
            console.error('❌ Failed to send delivery notification:', error);
            
            await this.logEmail(
                'DELIVERY_NOTIFICATION', 
                this.config.adminEmail, 
                `📦 Package Delivered: ${trackingData.trackingId}`, 
                'FAILED', 
                error,
                { trackingId: trackingData.trackingId }
            );
        }
    }

    async sendBulkUpdateReport(results) {
        if (!await this.ensureTransporter()) {
             console.log('⚠️ Cannot send bulk update report: No valid email configuration found.');
             return;
        }

        if (!this.config.adminEmail || this.config.adminEmail.length === 0) {
             console.log('⚠️ Cannot send bulk update report: No admin emails configured.');
             return;
        }

        console.log(`📧 Attempting to send Bulk Update Report to: ${this.config.adminEmail.join(', ')}`);

        try {
            console.log('📝 Preparing bulk update report content...');
            const subject = `📊 Bulk Update Report: ${results.updated} Success, ${results.failed} Failed`;
            
            // Sort logs: Failures first, then by trackingId
            const sortedLogs = [...results.logs].sort((a, b) => {
                const aErr = !!a.error;
                const bErr = !!b.error;
                if (aErr && !bErr) return -1;
                if (!aErr && bErr) return 1;
                return a.trackingId.localeCompare(b.trackingId);
            });

            const tableRows = sortedLogs.map((log, index) => {
                const isError = !!log.error;
                const bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
                const statusColor = isError ? '#ef4444' : '#10b981';
                const statusBg = isError ? '#fee2e2' : '#d1fae5';
                const statusText = isError ? 'FAILED' : 'SUCCESS';
                const detail = isError ? log.error : (log.newStatus || 'Updated');
                
                return `
                    <tr style="background-color: ${bgColor}; border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 12px 15px; font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #1e293b; font-weight: 600;">${log.trackingId}</td>
                        <td style="padding: 12px 15px; font-size: 13px; color: #64748b;">${log.provider || 'N/A'}</td>
                        <td style="padding: 12px 15px;">
                            <span style="display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: ${statusColor}; background-color: ${statusBg};">
                                ${statusText}
                            </span>
                        </td>
                        <td style="padding: 12px 15px; font-size: 13px; color: #334155; font-weight: 500;">${detail}</td>
                    </tr>
                `;
            }).join('');

            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
                    </style>
                </head>
                <body style="margin: 0; padding: 20px; background-color: #f1f5f9; font-family: 'Inter', -apple-system, sans-serif;">
                    <div style="max-width: 800px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);">
                        <!-- Header -->
                        <div style="background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); padding: 30px 40px; text-align: left;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">Tracking Sync Report</h1>
                            <p style="margin: 5px 0 0 0; color: rgba(255, 255, 255, 0.8); font-size: 14px;">Automated bulk update summary</p>
                        </div>

                        <!-- Stats Cards -->
                        <div style="padding: 30px 40px; display: table; width: 100%; box-sizing: border-box; border-bottom: 1px solid #f1f5f9;">
                            <div style="display: table-cell; width: 33.33%; padding-right: 15px;">
                                <div style="background-color: #f8fafc; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0;">
                                    <div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;">Total Processed</div>
                                    <div style="font-size: 24px; color: #1e293b; font-weight: 800;">${results.total}</div>
                                </div>
                            </div>
                            <div style="display: table-cell; width: 33.33%; padding: 0 7.5px;">
                                <div style="background-color: #f0fdf4; padding: 15px; border-radius: 12px; border: 1px solid #dcfce7;">
                                    <div style="font-size: 11px; color: #15803d; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;">Successful</div>
                                    <div style="font-size: 24px; color: #166534; font-weight: 800;">${results.updated}</div>
                                </div>
                            </div>
                            <div style="display: table-cell; width: 33.33%; padding-left: 15px;">
                                <div style="background-color: #fef2f2; padding: 15px; border-radius: 12px; border: 1px solid #fee2e2;">
                                    <div style="font-size: 11px; color: #b91c1c; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;">Failed / Warnings</div>
                                    <div style="font-size: 24px; color: #991b1b; font-weight: 800;">${results.failed}</div>
                                </div>
                            </div>
                        </div>

                        <!-- Table -->
                        <div style="padding: 20px 40px 40px 40px;">
                            <div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                                    <thead>
                                        <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                                            <th style="padding: 12px 15px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.05em;">Tracking ID</th>
                                            <th style="padding: 12px 15px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.05em;">Carrier</th>
                                            <th style="padding: 12px 15px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.05em;">Status</th>
                                            <th style="padding: 12px 15px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.05em;">Details</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${tableRows || '<tr><td colspan="4" style="padding: 30px; text-align: center; color: #94a3b8; font-size: 14px;">No entries were processed during this run.</td></tr>'}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- Footer -->
                        <div style="background-color: #f8fafc; padding: 20px 40px; border-top: 1px solid #e2e8f0; text-align: center;">
                            <p style="margin: 0; color: #94a3b8; font-size: 12px; font-weight: 500;">
                                This is an automated notification from your Tracking System.
                            </p>
                            <p style="margin: 5px 0 0 0; color: #cbd5e1; font-size: 11px;">
                                Run time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'medium' })}
                            </p>
                        </div>
                    </div>
                </body>
                </html>
            `;

            console.log('🚀 Sending bulk report email now...');
            const info = await this.transporter.sendMail({
                from: `"${this.config.fromName}" <${this.config.user}>`,
                to: this.config.adminEmail.join(', '),
                subject: subject,
                html: html
            });
            console.log('✅ Beautified bulk update report sent to admin');
            
            await this.logEmail(
                'BULK_REPORT', 
                this.config.adminEmail, 
                subject, 
                'SUCCESS', 
                null, 
                { 
                    total: results.total,
                    updated: results.updated,
                    failed: results.failed,
                    messageId: info.messageId
                }
            );

            return info;
        } catch (error) {
            console.error('❌ Failed to send bulk update report:', error);
            
            await this.logEmail(
                'BULK_REPORT', 
                this.config.adminEmail, 
                `📊 Bulk Update Report: ${results.updated} Success, ${results.failed} Failed`, 
                'FAILED', 
                error,
                { 
                    total: results.total,
                    updated: results.updated,
                    failed: results.failed
                }
            );
        }
    }
}

module.exports = new EmailService();
