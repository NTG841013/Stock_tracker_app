// lib/nodemailer/index.ts
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import {
    WELCOME_EMAIL_TEMPLATE,
    NEWS_SUMMARY_EMAIL_TEMPLATE,
    STOCK_ALERT_UPPER_EMAIL_TEMPLATE,
    STOCK_ALERT_LOWER_EMAIL_TEMPLATE,
} from "@/lib/nodemailer/templates";
import { formatPrice } from "@/lib/utils";

// ✅ FIX: Create transporter with proper typing and error handling
export const getTransporter = (): Transporter => {
    try {
        // Ensure nodemailer is properly imported
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            },
        });

        return transporter;
    } catch (error) {
        console.error("❌ Failed to create nodemailer transporter:", error);
        throw new Error("Email service initialization failed");
    }
};

export const sendWelcomeEmail = async ({
                                           email,
                                           name,
                                           intro
                                       }: {
    email: string;
    name: string;
    intro: string;
}) => {
    const transporter = getTransporter();

    const htmlTemplate = WELCOME_EMAIL_TEMPLATE
        .replace('{{name}}', name)
        .replace('{{intro}}', intro);

    const mailOptions = {
        from: `"Inkomba" <${process.env.NODEMAILER_EMAIL}>`,
        to: email,
        subject: `Welcome to Inkomba - your stock market toolkit is ready!`,
        text: 'Thanks for joining Inkomba',
        html: htmlTemplate,
    }

    await transporter.sendMail(mailOptions);
}

export const sendNewsSummaryEmail = async (
    { email, date, newsContent }: { email: string; date: string; newsContent: string }
): Promise<void> => {
    const transporter = getTransporter();

    const htmlTemplate = NEWS_SUMMARY_EMAIL_TEMPLATE
        .replace('{{date}}', date)
        .replace('{{newsContent}}', newsContent);

    const mailOptions = {
        from: `"Inkomba News" <${process.env.NODEMAILER_EMAIL}>`,
        to: email,
        subject: `📈 Market News Summary Today - ${date}`,
        text: `Today's market news summary from Inkomba:`,
        html: htmlTemplate,
    };

    await transporter.sendMail(mailOptions);
};

export const sendPriceAlertEmail = async ({
                                              email,
                                              symbol,
                                              company,
                                              alertType,
                                              currentPrice,
                                              targetPrice,
                                              changePercent
                                          }: {
    email: string;
    symbol: string;
    company: string;
    alertType: 'greater' | 'less';
    currentPrice: number;
    targetPrice: number;
    changePercent: number;
}): Promise<{ success: boolean; error?: string }> => {
    console.log(`📧 [sendPriceAlertEmail] Starting for ${symbol} to ${email}`);
    console.log(`   Alert Type: ${alertType}, Current: ${currentPrice}, Target: ${targetPrice}`);

    const transporter = getTransporter();

    try {
        const timestamp = new Date().toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'UTC'
        });

        const template = alertType === 'greater'
            ? STOCK_ALERT_UPPER_EMAIL_TEMPLATE
            : STOCK_ALERT_LOWER_EMAIL_TEMPLATE;

        const htmlTemplate = template
            .replace(/{{symbol}}/g, symbol)
            .replace(/{{company}}/g, company)
            .replace(/{{timestamp}}/g, timestamp)
            .replace(/{{currentPrice}}/g, formatPrice(currentPrice))
            .replace(/{{targetPrice}}/g, formatPrice(targetPrice));

        const subject = alertType === 'greater'
            ? `🔔 ${symbol} Price Alert: Above ${formatPrice(targetPrice)}`
            : `🔔 ${symbol} Price Alert: Below ${formatPrice(targetPrice)}`;

        console.log(`   Subject: ${subject}`);

        const mailOptions = {
            from: `"Inkomba Alerts" <${process.env.NODEMAILER_EMAIL}>`,
            to: email,
            subject: subject,
            text: `Your price alert for ${symbol} has been triggered.`,
            html: htmlTemplate,
        };

        const result = await transporter.sendMail(mailOptions);

        console.log(`✅ Price alert email sent successfully to ${email} for ${symbol}`);
        console.log(`   Message ID: ${result.messageId}`);

        return { success: true };
    } catch (err) {
        console.error(`❌ Failed to send price alert email for ${symbol}:`, err);
        console.error(`   Error details:`, JSON.stringify(err, null, 2));
        return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
};

