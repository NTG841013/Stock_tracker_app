'use server';

import { getDateRange, validateArticle, formatArticle, formatPrice, formatChangePercent, formatMarketCapValue } from '@/lib/utils';
import { POPULAR_STOCK_SYMBOLS } from '@/lib/constants';
import { cache } from 'react';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getWatchlistSymbolsByEmail } from '@/lib/actions/watchlist.actions';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
const NEXT_PUBLIC_FINNHUB_API_KEY = process.env.NEXT_PUBLIC_FINNHUB_API_KEY ?? '';

async function fetchJSON<T>(url: string, revalidateSeconds?: number): Promise<T> {
    const options: RequestInit & { next?: { revalidate?: number } } = revalidateSeconds
        ? { cache: 'force-cache', next: { revalidate: revalidateSeconds } }
        : { cache: 'no-store' };

    const res = await fetch(url, options);
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Fetch failed ${res.status}: ${text}`);
    }
    return (await res.json()) as T;
}

export { fetchJSON };

interface QuoteData {
    c: number;
    dp: number;
    [key: string]: any;
}

interface ProfileData {
    name: string;
    marketCapitalization: number;
    [key: string]: any;
}

interface FinancialsData {
    metric: {
        peNormalizedAnnual?: number;
        [key: string]: any;
    };
    [key: string]: any;
}

interface FinnhubSearchResult {
    symbol: string;
    description: string;
    displaySymbol: string;
    type: string;
}

interface FinnhubSearchResponse {
    result: FinnhubSearchResult[];
}

// RawNewsArticle matches Finnhub API response (id is number)
interface RawNewsArticle {
    id: number;
    headline: string;
    summary: string;
    source: string;
    url: string;
    datetime: number;
    image: string;
    category: string;
    related: string;
    [key: string]: any;
}

// MarketNewsArticle can have id as string or number for flexibility
interface MarketNewsArticle {
    id: string | number;
    headline: string;
    summary: string;
    source: string;
    url: string;
    datetime: number;
    image: string;
    category: string;
    related: string;
    [key: string]: any;
}

interface StockProfileLite {
    name?: string;
    ticker?: string;
    exchange?: string;
    marketCapitalization?: number;
}

interface StockWithWatchlistStatus {
    symbol: string;
    name: string;
    exchange: string;
    type: string;
    isInWatchlist: boolean;
}

interface FinnhubSearchResultWithExchange extends FinnhubSearchResult {
    __exchange?: string;
}

export async function getStocksDetails(symbolInput: string): Promise<{
    symbol: string;
    company?: string;
    currentPrice?: number;
    changePercent?: number;
    priceFormatted?: string;
    changeFormatted?: string;
    peRatio?: string;
    marketCapFormatted?: string;
    quote?: QuoteData;
    profile?: ProfileData;
    financials?: FinancialsData;
}> {
    const token = process.env.FINNHUB_API_KEY ?? NEXT_PUBLIC_FINNHUB_API_KEY;
    const symbol = String(symbolInput || '').toUpperCase().trim();
    if (!symbol) throw new Error('Symbol is required');
    if (!token) throw new Error('FINNHUB API key is not configured');

    try {
        const [quote, profile, financials] = await Promise.all([
            fetchJSON<QuoteData>(`${FINNHUB_BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`, 15),
            fetchJSON<ProfileData>(`${FINNHUB_BASE_URL}/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${token}`, 3600),
            fetchJSON<FinancialsData>(`${FINNHUB_BASE_URL}/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${token}`, 3600),
        ]);

        const company = profile?.name || symbol;
        const currentPrice = quote?.c;
        const changePercent = quote?.dp;
        const priceFormatted = currentPrice ? formatPrice(currentPrice) : 'N/A';
        const changeFormatted = changePercent !== undefined ? formatChangePercent(changePercent) : 'N/A';
        const peRatio = financials?.metric?.peNormalizedAnnual?.toFixed(1) || '—';
        const marketCapFormatted = profile?.marketCapitalization ? formatMarketCapValue(profile.marketCapitalization) : 'N/A';

        return {
            symbol,
            company,
            currentPrice,
            changePercent,
            priceFormatted,
            changeFormatted,
            peRatio,
            marketCapFormatted,
            quote,
            profile,
            financials
        };
    } catch (err) {
        console.error('getStocksDetails error:', err);
        return { symbol, company: symbol };
    }
}

export async function getNews(symbols?: string[]): Promise<MarketNewsArticle[]> {
    try {
        const range = getDateRange(5);
        const token = process.env.FINNHUB_API_KEY ?? NEXT_PUBLIC_FINNHUB_API_KEY;
        if (!token) {
            throw new Error('FINNHUB API key is not configured');
        }
        const cleanSymbols = (symbols || [])
            .map((s) => s?.trim().toUpperCase())
            .filter((s): s is string => Boolean(s));

        const maxArticles = 6;

        if (cleanSymbols.length > 0) {
            const perSymbolArticles: Record<string, RawNewsArticle[]> = {};

            await Promise.all(
                cleanSymbols.map(async (sym) => {
                    try {
                        const url = `${FINNHUB_BASE_URL}/company-news?symbol=${encodeURIComponent(sym)}&from=${range.from}&to=${range.to}&token=${token}`;
                        const articles = await fetchJSON<RawNewsArticle[]>(url, 300);
                        perSymbolArticles[sym] = (articles || []).filter((article) => validateArticle(article));
                    } catch (e) {
                        console.error('Error fetching company news for', sym, e);
                        perSymbolArticles[sym] = [];
                    }
                })
            );

            const collected: MarketNewsArticle[] = [];
            for (let round = 0; round < maxArticles; round++) {
                for (let i = 0; i < cleanSymbols.length; i++) {
                    const sym = cleanSymbols[i];
                    const list = perSymbolArticles[sym] || [];
                    if (list.length === 0) continue;
                    const article = list.shift();
                    if (!article || !validateArticle(article)) continue;
                    const formatted = formatArticle(article, true, sym, round);
                    collected.push(formatted);
                    if (collected.length >= maxArticles) break;
                }
                if (collected.length >= maxArticles) break;
            }

            if (collected.length > 0) {
                collected.sort((a, b) => (b.datetime || 0) - (a.datetime || 0));
                return collected.slice(0, maxArticles);
            }
        }

        const generalUrl = `${FINNHUB_BASE_URL}/news?category=general&token=${token}`;
        const general = await fetchJSON<RawNewsArticle[]>(generalUrl, 300);

        const seen = new Set<string>();
        const unique: RawNewsArticle[] = [];
        for (const art of general || []) {
            if (!validateArticle(art)) continue;
            const key = `${art.id}-${art.url}-${art.headline}`;
            if (seen.has(key)) continue;
            seen.add(key);
            unique.push(art);
            if (unique.length >= 20) break;
        }

        const formatted = unique.slice(0, maxArticles).map((a, idx) => formatArticle(a, false, undefined, idx));
        return formatted;
    } catch (err) {
        console.error('getNews error:', err);
        throw new Error('Failed to fetch news');
    }
}

export const searchStocks = cache(
    async (query?: string): Promise<StockWithWatchlistStatus[]> => {
        try {
            const token = process.env.FINNHUB_API_KEY ?? NEXT_PUBLIC_FINNHUB_API_KEY;
            if (!token) {
                console.error('Error in stock search:', new Error('FINNHUB API key is not configured'));
                return [];
            }

            const session = await auth.api.getSession({
                headers: await headers(),
            });
            if (!session?.user) redirect('/sign-in');

            const userWatchlistSymbols = await getWatchlistSymbolsByEmail(
                session.user.email
            );

            const trimmed = typeof query === 'string' ? query.trim() : '';
            let results: FinnhubSearchResultWithExchange[] = [];

            if (!trimmed) {
                const top = POPULAR_STOCK_SYMBOLS.slice(0, 10);
                const profiles = await Promise.all(
                    top.map(async (sym) => {
                        try {
                            const url = `${FINNHUB_BASE_URL}/stock/profile2?symbol=${encodeURIComponent(sym)}&token=${token}`;
                            const profile = await fetchJSON<StockProfileLite>(url, 3600);
                            return { sym, profile };
                        } catch (e) {
                            console.error('Error fetching profile2 for', sym, e);
                            return { sym, profile: null as StockProfileLite | null };
                        }
                    })
                );

                results = profiles
                    .map(({ sym, profile }) => {
                        const symbol = sym.toUpperCase();
                        const name = profile?.name || profile?.ticker || undefined;
                        const exchange = profile?.exchange || undefined;
                        if (!name) return undefined;
                        const r: FinnhubSearchResultWithExchange = {
                            symbol,
                            description: name,
                            displaySymbol: symbol,
                            type: 'Common Stock',
                            __exchange: exchange,
                        };
                        return r;
                    })
                    .filter((x): x is FinnhubSearchResultWithExchange => Boolean(x));
            } else {
                const url = `${FINNHUB_BASE_URL}/search?q=${encodeURIComponent(trimmed)}&token=${token}`;
                const data = await fetchJSON<FinnhubSearchResponse>(url, 1800);
                results = Array.isArray(data?.result) ? data.result : [];
            }

            let mapped: StockWithWatchlistStatus[] = results
                .map((r) => {
                    const upper = (r.symbol || '').toUpperCase();
                    const name = r.description || upper;
                    const exchangeFromDisplay = r.displaySymbol || undefined;
                    const exchangeFromProfile = r.__exchange;
                    const exchange = exchangeFromDisplay || exchangeFromProfile || 'US';
                    const type = r.type || 'Stock';
                    const item: StockWithWatchlistStatus = {
                        symbol: upper,
                        name,
                        exchange,
                        type,
                        isInWatchlist: userWatchlistSymbols.includes(
                            r.symbol.toUpperCase()
                        )
                    };
                    return item;
                })
                .slice(0, 15);

            // Attach per-user watchlist status
            try {
                const session = await auth.api.getSession({ headers: await headers() });
                const email = session?.user?.email || '';
                if (email) {
                    const symbols = await getWatchlistSymbolsByEmail(email);
                    const set = new Set((symbols || []).map((s) => String(s).toUpperCase()));
                    mapped = mapped.map((it) => ({ ...it, isInWatchlist: set.has(it.symbol) }));
                }
            } catch (e) {
                console.warn('searchStocks: could not resolve watchlist status', e);
            }

            return mapped;
        } catch (err) {
            console.error('Error in stock search:', err);
            return [];
        }
    }
);

// Fetch stock details by symbol (cached version)
export const getStockDetailsCached = cache(async (symbol: string) => {
    const cleanSymbol = symbol.trim().toUpperCase();

    try {
        const token = process.env.FINNHUB_API_KEY ?? NEXT_PUBLIC_FINNHUB_API_KEY;
        if (!token) throw new Error('FINNHUB API key is not configured');

        const [quote, profile, financials] = await Promise.all([
            fetchJSON<QuoteData>(
                `${FINNHUB_BASE_URL}/quote?symbol=${cleanSymbol}&token=${token}`
            ),
            fetchJSON<ProfileData>(
                `${FINNHUB_BASE_URL}/stock/profile2?symbol=${cleanSymbol}&token=${token}`,
                3600
            ),
            fetchJSON<FinancialsData>(
                `${FINNHUB_BASE_URL}/stock/metric?symbol=${cleanSymbol}&metric=all&token=${token}`,
                1800
            ),
        ]);

        if (!quote?.c || !profile?.name)
            throw new Error('Invalid stock data received from API');

        const changePercent = quote.dp || 0;
        const peRatio = financials?.metric?.peNormalizedAnnual || null;

        return {
            symbol: cleanSymbol,
            company: profile?.name,
            currentPrice: quote.c,
            changePercent,
            priceFormatted: formatPrice(quote.c),
            changeFormatted: formatChangePercent(changePercent),
            peRatio: peRatio?.toFixed(1) || '—',
            marketCapFormatted: formatMarketCapValue(
                profile?.marketCapitalization || 0
            ),
        };
    } catch (error) {
        console.error(`Error fetching details for ${cleanSymbol}:`, error);
        throw new Error('Failed to fetch stock details');
    }
});