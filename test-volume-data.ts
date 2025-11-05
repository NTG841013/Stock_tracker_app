import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

import { connectToDatabase } from './database/mongoose';
import { Alert } from './database/models/alert.model';

async function checkVolumeAlerts() {
    await connectToDatabase();

    const volumeAlerts = await Alert.find({ alertType: 'volume' }).lean();

    console.log('📊 Volume Alerts in Database:');
    console.log(`   Total found: ${volumeAlerts.length}\n`);

    volumeAlerts.forEach((alert, i) => {
        console.log(`Alert ${i + 1}:`);
        console.log('  Symbol:', alert.symbol);
        console.log('  Company:', alert.company);
        console.log('  Alert Type:', alert.alertType);
        console.log('  Condition:', alert.condition);
        console.log('  Threshold:', alert.threshold);
        console.log('  Is Active:', alert.isActive);
        console.log('  Created:', alert.createdAt);
        console.log('');
    });

    process.exit(0);
}

checkVolumeAlerts().catch(console.error);