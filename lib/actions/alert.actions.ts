// lib/actions/alert.actions.ts
'use server';

import { connectToDatabase } from '@/database/mongoose';
import { Alert } from '@/database/models/alert.model';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

interface CreateAlertInput {
    symbol: string;
    company: string;
    alertName: string;
    currentPrice: number;
    alertType: 'price';
    condition: 'greater' | 'less';
    threshold: number;
}

interface UpdateAlertInput {
    alertName: string;
    alertType: 'price';
    condition: 'greater' | 'less';
    threshold: number;
}

// Get current user's alerts
export async function getUserAlerts() {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        const email = session?.user?.email;
        if (!email) return [];

        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if (!db) throw new Error('MongoDB connection not found');

        const user = await db.collection('user').findOne<{ _id?: unknown; id?: string; email?: string }>({ email });
        if (!user) return { ok: false, error: 'User not found' };

        const userId = String(user._id);
        console.log(`🔍 Creating alert for userId: ${userId}`); // Add this log

        if (!userId) return { ok: false, error: 'User id not found' };

        const alerts = await Alert.find({ userId }).sort({ createdAt: -1 }).lean();

        return alerts.map(alert => ({
            id: String(alert._id),
            symbol: alert.symbol,
            company: alert.company,
            alertName: alert.alertName,
            currentPrice: alert.currentPrice,
            alertType: alert.alertType,
            condition: alert.condition,
            threshold: alert.threshold,
            isActive: alert.isActive,
            createdAt: alert.createdAt,
            updatedAt: alert.updatedAt,
            triggeredAt: alert.triggeredAt
        }));
    } catch (err) {
        console.error('getUserAlerts error:', err);
        return [];
    }
}

// Create a new alert
// In createAlert function
export async function createAlert(input: CreateAlertInput): Promise<{ ok: boolean; error?: string }> {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        const email = session?.user?.email;
        if (!email) {
            redirect('/sign-in');
        }

        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if (!db) throw new Error('MongoDB connection not found');

        const user = await db.collection('user').findOne<{ _id?: unknown; id?: string; email?: string }>({ email });
        if (!user) return { ok: false, error: 'User not found' };

        // ✅ Better Auth stores users with _id (ObjectId), not id field
        // Convert to string for consistent storage
        const userId = String(user._id);

        console.log('💾 Creating alert with userId:', userId);

        if (!userId) return { ok: false, error: 'User id not found' };

        await Alert.create({
            userId,
            symbol: input.symbol.toUpperCase().trim(),
            company: input.company.trim(),
            alertName: input.alertName.trim(),
            currentPrice: input.currentPrice,
            alertType: input.alertType,
            condition: input.condition,
            threshold: input.threshold,
            isActive: true
        });

        revalidatePath('/watchlist');
        return { ok: true };
    } catch (err) {
        console.error('createAlert error:', err);
        return { ok: false, error: 'Failed to create alert' };
    }
}

// Update an existing alert
export async function updateAlert(alertId: string, input: UpdateAlertInput): Promise<{ ok: boolean; error?: string }> {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        const email = session?.user?.email;
        if (!email) {
            redirect('/sign-in');
        }

        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if (!db) throw new Error('MongoDB connection not found');

        const user = await db.collection('user').findOne<{ _id?: unknown; id?: string; email?: string }>({ email });
        if (!user) return { ok: false, error: 'User not found' };

        const userId = String(user._id);
        if (!userId) return { ok: false, error: 'User id not found' };

        const alert = await Alert.findOne({ _id: alertId, userId });
        if (!alert) return { ok: false, error: 'Alert not found' };

        await Alert.updateOne(
            { _id: alertId, userId },
            {
                $set: {
                    alertName: input.alertName.trim(),
                    alertType: input.alertType,
                    condition: input.condition,
                    threshold: input.threshold,
                    updatedAt: new Date()
                }
            }
        );

        revalidatePath('/watchlist');
        return { ok: true };
    } catch (err) {
        console.error('updateAlert error:', err);
        return { ok: false, error: 'Failed to update alert' };
    }
}

// Delete an alert
export async function deleteAlert(alertId: string): Promise<{ ok: boolean; error?: string }> {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        const email = session?.user?.email;
        if (!email) {
            redirect('/sign-in');
        }

        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if (!db) throw new Error('MongoDB connection not found');

        const user = await db.collection('user').findOne<{ _id?: unknown; id?: string; email?: string }>({ email });
        if (!user) return { ok: false, error: 'User not found' };

        const userId = String(user._id);
        if (!userId) return { ok: false, error: 'User id not found' };

        await Alert.deleteOne({ _id: alertId, userId });

        revalidatePath('/watchlist');
        return { ok: true };
    } catch (err) {
        console.error('deleteAlert error:', err);
        return { ok: false, error: 'Failed to delete alert' };
    }
}

// Toggle alert active status
export async function toggleAlertStatus(alertId: string, isActive: boolean): Promise<{ ok: boolean; error?: string }> {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        const email = session?.user?.email;
        if (!email) {
            redirect('/sign-in');
        }

        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if (!db) throw new Error('MongoDB connection not found');

        const user = await db.collection('user').findOne<{ _id?: unknown; id?: string; email?: string }>({ email });
        if (!user) return { ok: false, error: 'User not found' };


        const userId = String(user._id);
        if (!userId) return { ok: false, error: 'User id not found' };

        await Alert.updateOne(
            { _id: alertId, userId },
            {
                $set: { isActive, updatedAt: new Date() }
            }
        );

        revalidatePath('/watchlist');
        return { ok: true };
    } catch (err) {
        console.error('toggleAlertStatus error:', err);
        return { ok: false, error: 'Failed to toggle alert status' };
    }
}
// In alert.actions.ts
export async function reactivateAlert(alertId: string): Promise<{ ok: boolean; error?: string }> {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        const email = session?.user?.email;
        if (!email) redirect('/sign-in');

        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if (!db) throw new Error('MongoDB connection not found');

        const user = await db.collection('user').findOne({ email });
        if (!user) return { ok: false, error: 'User not found' };

        const userId = String(user._id);

        await Alert.updateOne(
            { _id: alertId, userId },
            {
                $set: {
                    isActive: true,
                    triggeredAt: null,
                    updatedAt: new Date()
                }
            }
        );

        revalidatePath('/watchlist');
        return { ok: true };
    } catch (err) {
        console.error('reactivateAlert error:', err);
        return { ok: false, error: 'Failed to reactivate alert' };
    }
}