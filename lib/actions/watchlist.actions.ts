'use server';

import { connectToDatabase } from '@/database/mongoose';
import { Watchlist } from '@/database/models/watchlist.model';
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
        if (!user) return []; // or appropriate error response

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
        if (!user) return []; // or appropriate error response

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
