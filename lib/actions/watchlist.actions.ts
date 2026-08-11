'use server';

import { connectToDatabase } from '@/database/mongoose';
import { Watchlist } from '@/database/models/watchlist.model';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getStocksDetails } from '@/lib/actions/finnhub.actions';
import { formatMarketCapValue, formatChangePercent, formatPrice } from '@/lib/utils';

// Helper function to get user ID from email
async function getUserIdFromEmail(email: string): Promise<string | null> {
    try {
        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if (!db) throw new Error('MongoDB connection not found');

        const user = await db.collection('user').findOne<{ _id?: unknown; email?: string }>({ email });
        if (!user) return null;

        return String(user._id);
    } catch (err) {
        console.error('getUserIdFromEmail error:', err);
        return null;
    }
}

// Helper function to get user session
async function getUserSession() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });
    if (!session?.user) redirect('/sign-in');
    return session;
}

export async function getWatchlistSymbolsByEmail(email: string): Promise<string[]> {
    if (!email) return [];

    try {
        const userId = await getUserIdFromEmail(email);
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
        await connectToDatabase();
        const session = await getUserSession();

        const existingItem = await Watchlist.findOne({
            userId: session.user.id,
            symbol: symbol.toUpperCase(),
        });

        if (existingItem) {
            return { success: false, error: 'Stock already in watchlist' };
        }

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
        await connectToDatabase();
        const session = await getUserSession();

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
        await connectToDatabase();
        const session = await getUserSession();

        const watchlist = await Watchlist.find({ userId: session.user.id })
            .sort({ addedAt: -1 })
            .lean();

        return JSON.parse(JSON.stringify(watchlist));
    } catch (error) {
        console.error('Error fetching watchlist:', error);
        throw new Error('Failed to fetch watchlist');
    }
};

// Get user's watchlist with stock data
export const getWatchlistWithData = async () => {
    try {
        await connectToDatabase();
        const session = await getUserSession();

        const watchlist = await Watchlist.find({ userId: session.user.id })
            .sort({ addedAt: -1 })
            .lean();

        if (watchlist.length === 0) return [];

        const stocksWithData = await Promise.all(
            watchlist.map(async (item) => {
                try {
                    const stockData = await getStocksDetails(item.symbol);

                    // Extract and format data safely
                    const currentPrice = stockData.currentPrice ?? 0;
                    const changePercent = stockData.changePercent ?? 0;

                    return {
                        userId: item.userId,
                        symbol: item.symbol,
                        company: item.company,
                        addedAt: item.addedAt,
                        currentPrice: currentPrice,
                        priceFormatted: formatPrice(currentPrice),
                        changeFormatted: formatChangePercent(changePercent),
                        changePercent: changePercent,
                        marketCapFormatted: 'N/A', // Default value since it's not in stockData
                        peRatio: 'N/A', // Default value since it's not in stockData
                    };
                } catch (e) {
                    console.warn(`Falling back to basic data for ${item.symbol}:`, e);
                    return {
                        userId: item.userId,
                        symbol: item.symbol,
                        company: item.company,
                        addedAt: item.addedAt,
                        currentPrice: 0,
                        priceFormatted: 'N/A',
                        changeFormatted: '',
                        changePercent: 0,
                        marketCapFormatted: 'N/A',
                        peRatio: 'N/A',
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

// Get current user's watchlist symbols
export async function getCurrentUserWatchlistSymbols(): Promise<string[]> {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        const email = session?.user?.email || '';
        if (!email) return [];
        return await getWatchlistSymbolsByEmail(email);
    } catch (err) {
        console.error('getCurrentUserWatchlistSymbols error:', err);
        return [];
    }
}

// Get detailed watchlist with stock data
export async function getDetailedWatchlistWithData() {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        const email = session?.user?.email;

        if (!email) {
            redirect('/sign-in');
        }

        const userId = await getUserIdFromEmail(email);
        if (!userId) return [];

        const watchlistItems = await Watchlist.find({ userId }).lean();

        if (!watchlistItems || watchlistItems.length === 0) return [];

        const stocksWithData = await Promise.all(
            watchlistItems.map(async (item) => {
                try {
                    const details = await getStocksDetails(item.symbol);

                    const currentPrice = details.quote?.c ?? 0;
                    const changePercent = details.quote?.dp ?? 0;
                    const marketCapUsd = details.profile?.marketCapitalization;
                    const peRatio = details.financials?.metric?.peBasicExclExtraTTM;

                    return {
                        userId: item.userId,
                        symbol: item.symbol,
                        company: item.company,
                        addedAt: item.addedAt,
                        currentPrice,
                        changePercent,
                        priceFormatted: formatPrice(currentPrice),
                        changeFormatted: formatChangePercent(changePercent),
                        marketCapFormatted: marketCapUsd ? formatMarketCapValue(marketCapUsd * 1_000_000) : 'N/A',
                        peRatio: peRatio ? peRatio.toFixed(2) : 'N/A',
                    };
                } catch (err) {
                    console.error(`Error fetching data for ${item.symbol}:`, err);
                    return {
                        userId: item.userId,
                        symbol: item.symbol,
                        company: item.company,
                        addedAt: item.addedAt,
                        currentPrice: 0,
                        changePercent: 0,
                        priceFormatted: 'N/A',
                        changeFormatted: '',
                        marketCapFormatted: 'N/A',
                        peRatio: 'N/A',
                    };
                }
            })
        );

        stocksWithData.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());

        return stocksWithData;
    } catch (err) {
        console.error('getDetailedWatchlistWithData error:', err);
        return [];
    }
}