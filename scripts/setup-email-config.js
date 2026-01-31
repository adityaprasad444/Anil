const { connectDB } = require('../db');
const EmailConfig = require('../models/EmailConfig');

const setup = async () => {
    try {
        await connectDB();
        console.log('✅ Connected to database...');

        // Check if config already exists
        let emailConfig = await EmailConfig.findOne();
        
        const adminEmails = process.env.ADMIN_EMAIL 
            ? process.env.ADMIN_EMAIL.split(',').map(e => e.trim()).filter(e => e)
            : ['admin@example.com'];

        if (emailConfig) {
            console.log('ℹ️ Existing email config found. Updating fields...');
            emailConfig.adminEmail = adminEmails;
            if (process.env.SMTP_USER) emailConfig.user = process.env.SMTP_USER;
            if (process.env.SMTP_PASS) emailConfig.pass = process.env.SMTP_PASS;
            emailConfig.isEnabled = !!process.env.SMTP_USER;
            await emailConfig.save();
            console.log('✅ Updated existing configuration to support multiple admin emails.');
        } else {
            console.log('✨ Creating new email configuration...');
            if (!process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.ADMIN_EMAIL) {
                console.warn('⚠️ Missing primary email environment variables. Creating a placeholder config.');
            }

            const newConfig = new EmailConfig({
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: parseInt(process.env.SMTP_PORT) || 587,
                secure: process.env.SMTP_PORT === '465',
                user: process.env.SMTP_USER || 'placeholder@gmail.com',
                pass: process.env.SMTP_PASS || 'placeholder_pass',
                adminEmail: adminEmails,
                fromName: 'AK Logistics Tracking System',
                isEnabled: !!process.env.SMTP_USER
            });

            await newConfig.save();
            console.log('✨ Email configuration migrated to database successfully!');
        }
        process.exit(0);
    } catch (error) {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    }
};

setup();
