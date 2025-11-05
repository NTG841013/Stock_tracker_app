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

async function checkUsers() {
    try {
        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;

        if (!db) {
            console.error('❌ No database connection');
            return;
        }

        const users = await db.collection('user').find({}).limit(3).toArray();

        console.log('📊 User Schema Sample:');
        console.log('   Total users found:', users.length, '\n');

        users.forEach((user, i) => {
            console.log(`User ${i + 1}:`);
            console.log('  _id:', user._id);
            console.log('  id:', user.id);
            console.log('  email:', user.email);
            console.log('  name:', user.name);
            console.log('');
        });

        await mongoose.connection.close();
        console.log('✅ Database connection closed');
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

checkUsers();