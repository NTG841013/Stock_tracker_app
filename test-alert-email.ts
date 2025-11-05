// ✅ Load from .env (not .env.local)
import dotenv from 'dotenv';
import path from 'path';

// Explicitly specify the .env file location
const envPath = path.resolve(process.cwd(), '.env');
console.log('📁 Loading env from:', envPath);

const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error('❌ Error loading .env file:', result.error);
    process.exit(1);
}

console.log('✅ Loaded', Object.keys(result.parsed || {}).length, 'environment variables');

import { sendPriceAlertEmail } from './lib/nodemailer';

async function testAlertEmail() {
    // ✅ Verify env vars are loaded
    console.log('\n🔍 Environment check:');
    console.log('   NODEMAILER_EMAIL:', process.env.NODEMAILER_EMAIL || '❌ Missing');
    console.log('   NODEMAILER_PASSWORD:', process.env.NODEMAILER_PASSWORD ? '✅ Set (hidden)' : '❌ Missing');
    console.log('   MONGODB_URI:', process.env.MONGODB_URI ? '✅ Set (hidden)' : '❌ Missing');

    if (!process.env.NODEMAILER_EMAIL || !process.env.NODEMAILER_PASSWORD) {
        console.error('\n❌ Missing Nodemailer credentials in .env file!');
        console.error('   Please add these lines to your .env file:');
        console.error('   NODEMAILER_EMAIL=your-email@gmail.com');
        console.error('   NODEMAILER_PASSWORD=your-app-password');
        process.exit(1);
    }

    console.log('\n🧪 Testing price alert email...');

    const emailResult = await sendPriceAlertEmail({
        email: 'ntg567497@gmail.com',
        symbol: 'AAPL',
        company: 'Apple Inc.',
        alertType: 'greater',
        currentPrice: 185.50,
        targetPrice: 180.00,
        changePercent: 2.5
    });

    console.log('\n📊 Result:', emailResult);

    if (emailResult.success) {
        console.log('✅ Email sent successfully! Check your inbox.');
    } else {
        console.error('❌ Email failed:', emailResult.error);
    }
}

testAlertEmail().catch(console.error);