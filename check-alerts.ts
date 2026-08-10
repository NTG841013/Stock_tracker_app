import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
console.log('📁 Loading env from:', envPath);

const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error('❌ Error loading .env file:', result.error);
    process.exit(1);
}

console.log('✅ Loaded', Object.keys(result.parsed || {}).length, 'environment variables\n');

import { connectToDatabase } from './database/mongoose';
import { Alert } from './database/models/alert.model';

async function checkAlerts() {
    try {
        await connectToDatabase();

        const alerts = await Alert.find({}).limit(5).lean();

        console.log('📊 Alert Schema Sample:');
        console.log('   Total alerts found:', alerts.length, '\n');

        alerts.forEach((alert, i) => {
            console.log(`Alert ${i + 1}:`);
            console.log('  _id:', alert._id);
            console.log('  userId:', alert.userId);
            console.log('  symbol:', alert.symbol);
            console.log('  company:', alert.company);
            console.log('  alertType:', alert.alertType);
            console.log('  condition:', alert.condition);
            console.log('  threshold:', alert.threshold);
            console.log('  isActive:', alert.isActive);
            console.log('');
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkAlerts();