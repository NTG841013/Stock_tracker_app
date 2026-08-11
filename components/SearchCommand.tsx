// components/SearchCommand.tsx
"use client"

import { useEffect, useState } from 'react';
import {
    CommandDialog,
    CommandEmpty,
    CommandInput,
    CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { searchStocks } from '@/lib/actions/finnhub.actions';
import { useDebounce } from '@/hooks/useDebounce';
import WatchlistButton from './WatchlistButton';

interface SearchCommandProps {
    renderAs?: 'button' | 'text';
    label?: string;
    initialStocks: StockWithWatchlistStatus[];
}

interface StockWithWatchlistStatus {
    symbol: string;
    name: string;
    exchange: string;
    type: string;
    isInWatchlist: boolean;
}

export default function SearchCommand({ renderAs = 'button', label = 'Add stock', initialStocks }: SearchCommandProps) {
    const [open, setOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(false);
    const [stocks, setStocks] = useState<StockWithWatchlistStatus[]>(initialStocks);

    const isSearchMode = !!searchTerm.trim();
    const displayStocks = isSearchMode ? stocks : stocks?.slice(0, 10);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setOpen(v => !v);
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    const handleSearch = async () => {
        if (!isSearchMode) {
            setStocks(initialStocks);
            return;
        }

        setLoading(true);
        try {
            const results = await searchStocks(searchTerm.trim());
            setStocks(results);
        } catch {
            setStocks([]);
        } finally {
            setLoading(false);
        }
    };

    const debouncedSearch = useDebounce(handleSearch, 300);

    useEffect(() => {
        debouncedSearch();
    }, [searchTerm]);

    const handleSelectStock = () => {
        setOpen(false);
        setSearchTerm("");
        setStocks(initialStocks);
    };

    // Handle watchlist status change and keep list in sync
    const handleWatchlistChange = (symbol: string, isAdded: boolean) => {
        setStocks((prev) =>
            (prev || []).map((stock) =>
                stock.symbol === symbol ? { ...stock, isInWatchlist: isAdded } : stock
            )
        );
    };

    return (
        <>
            {renderAs === 'text' ? (
                <span onClick={() => setOpen(true)} className="cursor-pointer hover:text-yellow-500">
                    {label}
                </span>
            ) : (
                <Button onClick={() => setOpen(true)} className="search-btn">
                    {label}
                </Button>
            )}

            <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput
                    placeholder="Search by symbol or company name..."
                    value={searchTerm}
                    onValueChange={setSearchTerm}
                />
                <CommandList>
                    {loading ? (
                        <div className="py-12 text-center text-gray-500">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                            Loading stocks...
                        </div>
                    ) : displayStocks?.length === 0 ? (
                        <CommandEmpty>
                            {isSearchMode ? 'No results found' : 'No stocks available'}
                        </CommandEmpty>
                    ) : (
                        <div className="px-2 py-2">
                            <div className="sticky top-0 z-10 bg-gray-800/95 backdrop-blur-sm border-b border-gray-700 px-4 py-3">
                                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    {isSearchMode ? 'Search Results' : 'Popular Stocks'} ({displayStocks?.length || 0})
                                </div>
                            </div>
                            {displayStocks?.map((stock) => (
                                <div
                                    key={stock.symbol}
                                    className="flex items-center gap-3 px-3 py-3 hover:bg-gray-700/50 rounded-md transition-colors group"
                                >
                                    <TrendingUp className="h-5 w-5 text-gray-500 shrink-0" />
                                    <Link
                                        href={`/stocks/${stock.symbol}`}
                                        onClick={handleSelectStock}
                                        className="flex-1 min-w-0"
                                    >
                                        <div className="font-semibold text-base text-gray-100 mb-1 line-clamp-1">
                                            {stock.name}
                                        </div>
                                        <div className="text-sm text-gray-500 line-clamp-1">
                                            {stock.symbol} • {stock.exchange} • GLOBAL MARKET • {stock.type}
                                        </div>
                                    </Link>
                                    <div className="shrink-0">
                                        <WatchlistButton
                                            symbol={stock.symbol}
                                            company={stock.name}
                                            isInWatchlist={stock.isInWatchlist}
                                            onWatchlistChange={handleWatchlistChange}
                                            type="icon"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CommandList>
            </CommandDialog>
        </>
    );
}