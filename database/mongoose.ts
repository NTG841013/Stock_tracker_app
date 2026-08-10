import mongoose from 'mongoose';

declare global {
    var mongooseCache: {
        conn: typeof mongoose | null;
        promise: Promise<typeof mongoose> | null;
    }
}

let cached = global.mongooseCache;

if(!cached) {
    cached = global.mongooseCache = { conn: null, promise: null };
}

export const connectToDatabase = async () => {
    // ✅ Check for MONGODB_URI inside the async function, not at module level
    const MONGODB_URI = process.env.MONGODB_URI;

    if(!MONGODB_URI) {
        throw new Error('MONGODB_URI must be set within .env file');
    }

    if(cached.conn) {
        console.log('Using cached database connection');
        return cached.conn;
    }

    if(!cached.promise) {
        console.log('Creating new database connection...');
        cached.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false });
    }

    try {
        cached.conn = await cached.promise;
        console.log(`✅ Connected to MongoDB (${process.env.NODE_ENV || 'development'})`);
    } catch (err) {
        cached.promise = null;
        throw err;
    }

    return cached.conn;
}