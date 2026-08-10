'use server';

import { connectToDatabase } from '@/database/mongoose';
import { Watchlist } from '@/database/models/watchlist.model';
import { revalidatePath } from 'next/cache';
import { auth } from '../better-auth/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getStocksDetails } from '@/lib/actions/finnhub.actions';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getStocksDetails } from '@/lib/actions/finnhub.actions';
import { formatMarketCapValue, formatChangePercent, formatPrice } from '@/lib/utils';


export async function getWatchlistSymbolsByEmail(email: string): Promise<string[]> {
    if (!email) return [];

    try {
        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if (!db) throw new Error('MongoDB connection not found');

        // Better Auth stores users in the "user" collection
        const user = await db.collection('user').findOne<{ _id?: unknown; id?: string; email?: string }>({ email });
        if (!user) return []; // or appropriate error response

        const userId = String(user._id);
        if (!userId) return [];

        const items = await Watchlist.find({ userId }, { symbol: 1 }).lean();
        return items.map((i) => String(i.symbol));
    } catch (err) {
        console.error('getWatchlistSymbolsByEmail error:', err);
        return [];
    }
}
// Add stock to watchlist
export const addToWatchlist = async (symbol: string, company: string) => {
    try {
        // Ensure DB connection
        await connectToDatabase();

        const session = await auth.api.getSession({
            headers: await headers(),
        });
        if (!session?.user) redirect('/sign-in');

        // Check if stock already exists in watchlist
        const existingItem = await Watchlist.findOne({
            userId: session.user.id,
            symbol: symbol.toUpperCase(),
        });

        if (existingItem) {
            return { success: false, error: 'Stock already in watchlist' };
        }

        // Add to watchlist
        const newItem = new Watchlist({
            userId: session.user.id,
            symbol: symbol.toUpperCase(),
            company: company.trim(),
        });

        await newItem.save();
        revalidatePath('/watchlist');

        return { success: true, message: 'Stock added to watchlist' };
    } catch (error) {
        console.error('Error adding to watchlist:', error);
        throw new Error('Failed to add stock to watchlist');
    }
};

// Remove stock from watchlist
export const removeFromWatchlist = async (symbol: string) => {
    try {
        // Ensure DB connection
        await connectToDatabase();

        const session = await auth.api.getSession({
            headers: await headers(),
        });
        if (!session?.user) redirect('/sign-in');

        // Remove from watchlist
        await Watchlist.deleteOne({
            userId: session.user.id,
            symbol: symbol.toUpperCase(),
        });
        revalidatePath('/watchlist');

        return { success: true, message: 'Stock removed from watchlist' };
    } catch (error) {
        console.error('Error removing from watchlist:', error);
        throw new Error('Failed to remove stock from watchlist');
    }
};
// Get user's watchlist
export const getUserWatchlist = async () => {
    try {
        // Ensure DB connection
        await connectToDatabase();

        const session = await auth.api.getSession({
            headers: await headers(),
        });
        if (!session?.user) redirect('/sign-in');

        const watchlist = await Watchlist.find({ userId: session.user.id })
            .sort({ addedAt: -1 })
            .lean();

        return JSON.parse(JSON.stringify(watchlist));
    } catch (error) {
        console.error('Error fetching watchlist:', error);
        throw new Error('Failed to fetch watchlist');
    }
}
// Get user's watchlist with stock data
export const getWatchlistWithData = async () => {
    try {
        // Ensure DB connection
        await connectToDatabase();

        const session = await auth.api.getSession({
            headers: await headers(),
        });
        if (!session?.user) redirect('/sign-in');

        const watchlist = await Watchlist.find({ userId: session.user.id }).sort({ addedAt: -1 }).lean();

        if (watchlist.length === 0) return [];

        const stocksWithData = await Promise.all(
            watchlist.map(async (item) => {
                try {
                    const stockData = await getStocksDetails(item.symbol);
                    return {
                        company: stockData.company,
                        symbol: stockData.symbol,
                        currentPrice: stockData.currentPrice,
                        priceFormatted: stockData.priceFormatted,
                        changeFormatted: stockData.changeFormatted,
                        changePercent: stockData.changePercent,
                        marketCap: stockData.marketCapFormatted,
                        peRatio: stockData.peRatio,
                        // Preserve base fields for type completeness
                        userId: (item as any).userId,
                        addedAt: (item as any).addedAt,
                    };
                } catch (e) {
                    console.warn(`Falling back to basic data for ${item.symbol}:`, e);
                    // Fallback to the minimal data so the watchlist still renders
                    return {
                        company: (item as any).company,
                        symbol: (item as any).symbol,
                        userId: (item as any).userId,
                        addedAt: (item as any).addedAt,
                    };
                }
            }),
        );

        return JSON.parse(JSON.stringify(stocksWithData));
    } catch (error) {
        console.error('Error loading watchlist:', error);
        throw new Error('Failed to fetch watchlist');
    }
};

// Get current user's watchlist symbols using Better Auth session
export async function getUserWatchlist(): Promise<string[]> {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        const email = session?.user?.email || '';
        if (!email) return [];
        return await getWatchlistSymbolsByEmail(email);
    } catch (err) {
        console.error('getUserWatchlist error:', err);
        return [];
    }
}

// Add a stock to the current user's watchlist
export async function addToWatchlist(input: { symbol: string; company: string }): Promise<{ ok: boolean; error?: string; alreadyExists?: boolean; }> {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        const email = session?.user?.email;
        if (!email) {
            // Not signed in – redirect to sign in page
            redirect('/sign-in');
        }

        const symbol = String(input?.symbol || '').toUpperCase().trim();
        const company = String(input?.company || '').trim();
        if (!symbol || !company) {
            return { ok: false, error: 'Invalid stock data' };
        }

        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if (!db) throw new Error('MongoDB connection not found');

        // locate Better Auth user and resolve userId
        const user = await db.collection('user').findOne<{ _id?: unknown; id?: string; email?: string }>({ email });
        if (!user) return { ok: false, error: 'User not found' };

        const userId = String(user._id);
        if (!userId) return { ok: false, error: 'User id not found' };

        // Check duplicate
        const existing = await Watchlist.findOne({ userId, symbol }).lean();
        if (existing) {
            // Revalidate so UI stays in sync even if duplicate attempt
            revalidatePath('/watchlist');
            return { ok: true, alreadyExists: true };
        }

        await Watchlist.create({ userId, symbol, company });

        // Revalidate watchlist path so the UI updates
        revalidatePath('/watchlist');
        return { ok: true };
    } catch (err) {
        console.error('addToWatchlist error:', err);
        return { ok: false, error: 'Failed to add to watchlist' };
    }
}

// Remove a stock from the current user's watchlist
export async function removeFromWatchlist(symbolInput: string): Promise<{ ok: boolean; error?: string; }> {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        const email = session?.user?.email;
        if (!email) {
            redirect('/sign-in');
        }

        const symbol = String(symbolInput || '').toUpperCase().trim();
        if (!symbol) return { ok: false, error: 'Invalid symbol' };

        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if (!db) throw new Error('MongoDB connection not found');

        const user = await db.collection('user').findOne<{ _id?: unknown; id?: string; email?: string }>({ email });
        if (!user) return { ok: false, error: 'User not found' };

        const userId = String(user._id);
        if (!userId) return { ok: false, error: 'User id not found' };

        await Watchlist.deleteOne({ userId, symbol });

        revalidatePath('/watchlist');
        return { ok: true };
    } catch (err) {
        console.error('removeFromWatchlist error:', err);
        return { ok: false, error: 'Failed to remove from watchlist' };
    }
}

export async function getWatchlistWithData(): Promise<StockWithData[]> {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        const email = session?.user?.email;

        if (!email) {
            redirect('/sign-in');
        }

        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if (!db) throw new Error('MongoDB connection not found');

        // Get user
        const user = await db.collection('user').findOne<{ _id?: unknown; id?: string; email?: string }>({ email });
        if (!user) return []; // or appropriate error response

        const userId = String(user._id);
        if (!userId) return [];

        // Fetch user's watchlist items
        const watchlistItems = await Watchlist.find({ userId }).lean();

        if (!watchlistItems || watchlistItems.length === 0) return [];

        // Fetch detailed data for each stock in parallel
        const stocksWithData = await Promise.all(
            watchlistItems.map(async (item) => {
                try {
                    const details = await getStocksDetails(item.symbol);

                    const currentPrice = details.quote?.c;
                    const changePercent = details.quote?.dp;
                    const marketCapUsd = details.profile?.marketCapitalization;
                    const peRatio = details.financials?.metric?.peBasicExclExtraTTM;

                    return {
                        userId: item.userId,
                        symbol: item.symbol,
                        company: item.company,
                        addedAt: item.addedAt,
                        currentPrice,
                        changePercent,
                        priceFormatted: currentPrice ? formatPrice(currentPrice) : 'N/A',
                        changeFormatted: formatChangePercent(changePercent),
                        marketCap: marketCapUsd ? formatMarketCapValue(marketCapUsd * 1_000_000) : 'N/A',
                        peRatio: peRatio ? peRatio.toFixed(2) : 'N/A',
                    } as StockWithData;
                } catch (err) {
                    console.error(`Error fetching data for ${item.symbol}:`, err);
                    // Return minimal data if fetch fails
                    return {
                        userId: item.userId,
                        symbol: item.symbol,
                        company: item.company,
                        addedAt: item.addedAt,
                        priceFormatted: 'N/A',
                        changeFormatted: '',
                        marketCap: 'N/A',
                        peRatio: 'N/A',
                    } as StockWithData;
                }
            })
        );

        // Sort by most recently added
        stocksWithData.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());

        return stocksWithData;
    } catch (err) {
        console.error('getWatchlistWithData error:', err);
        return [];
    }
}
