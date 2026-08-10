import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

async function testVolumeCheck() {
    const mongoose = await import('./database/mongoose');
    await mongoose.connectToDatabase();

    const { Alert } = await import('./database/models/alert.model');

    const volumeAlerts = await Alert.find({ alertType: 'volume', isActive: true }).lean();

    if (volumeAlerts.length === 0) {
        console.log('❌ No active volume alerts found');
        process.exit(0);
        return;
    }

    console.log(`Found ${volumeAlerts.length} active volume alert(s)\n`);

    for (const alert of volumeAlerts) {
        console.log(`\n📊 Testing Volume Alert:`);
        console.log(`   Symbol: ${alert.symbol}`);
        console.log(`   Threshold: ${alert.threshold.toLocaleString()}`);
        console.log(`   Condition: ${alert.condition}`);

        try {
            const token = process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
            const url = `https://finnhub.io/api/v1/quote?symbol=${alert.symbol}&token=${token}`;

            const response = await fetch(url);
            const quote = await response.json();

            const currentVolume = quote.v;
            const currentPrice = quote.c;

            console.log(`\n   Current Market Data:`);
            console.log(`   Volume: ${currentVolume?.toLocaleString() || 'N/A'}`);
            console.log(`   Price: $${currentPrice}`);

            if (!currentVolume) {
                console.log(`   ❌ No volume data available`);
                continue;
            }

            let shouldTrigger = false;

            if (alert.condition === 'greater' && currentVolume >= alert.threshold) {
                shouldTrigger = true;
            } else if (alert.condition === 'less' && currentVolume <= alert.threshold) {
                shouldTrigger = true;
            }

            console.log(`\n   Comparison:`);
            console.log(`   ${currentVolume.toLocaleString()} ${alert.condition === 'greater' ? '>=' : '<='} ${alert.threshold.toLocaleString()}`);

            console.log(`\n   Result:`);
            if (shouldTrigger) {
                console.log(`   ✅ ALERT WOULD TRIGGER!`);
            } else {
                console.log(`   ⏭️ Alert would NOT trigger`);
                if (alert.condition === 'greater') {
                    const diff = alert.threshold - currentVolume;
                    console.log(`   Need ${diff.toLocaleString()} more shares to trigger`);
                } else {
                    const diff = currentVolume - alert.threshold;
                    console.log(`   Volume is ${diff.toLocaleString()} shares too high`);
                }
            }

        } catch (error) {
            console.error(`   ❌ Error fetching data:`, error);
        }
    }

    process.exit(0);
}

testVolumeCheck().catch(console.error);