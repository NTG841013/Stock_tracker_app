// components/SearchCommand.tsx
"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, TrendingUp, Search, X } from "lucide-react"
import Link from "next/link"
import { searchStocks } from "@/lib/actions/finnhub.actions"
import { useDebounce } from "@/hooks/useDebounce"
import WatchlistButton from "@/components/WatchlistButton"

export default function SearchCommand({ renderAs = 'button', label = 'Add stock', initialStocks }: SearchCommandProps) {
    const [open, setOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const [loading, setLoading] = useState(false)
    const [stocks, setStocks] = useState<StockWithWatchlistStatus[]>(initialStocks)

    const isSearchMode = !!searchTerm.trim()
    const displayStocks = isSearchMode ? stocks : stocks?.slice(0, 10)

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault()
                setOpen(v => !v)
            }
        }
        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    }, [])

    const handleSearch = async () => {
        if (!isSearchMode) return setStocks(initialStocks)

        setLoading(true)
        try {
            const results = await searchStocks(searchTerm.trim())
            setStocks(results)
        } catch {
            setStocks([])
        } finally {
            setLoading(false)
        }
    }

    const debouncedSearch = useDebounce(handleSearch, 300)

    useEffect(() => {
        debouncedSearch()
    }, [searchTerm])

    const handleSelectStock = () => {
        setOpen(false)
        setSearchTerm("")
        setStocks(initialStocks)
    }

    const handleWatchlistChange = (symbol: string, isAdded: boolean) => {
        setStocks((prev) => prev.map((s) => (s.symbol === symbol ? { ...s, isInWatchlist: isAdded } : s)))
    }

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

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent
                    className="!bg-gray-800 border-gray-600 !p-0 max-w-[800px] max-h-[600px] overflow-hidden"
                    showCloseButton={false}
                >
                    {/* ✅ ADD THIS: Visually hidden title for accessibility */}
                    <DialogTitle className="sr-only">
                        Search Stocks
                    </DialogTitle>

                    {/* Search Header */}
                    <div className="flex items-center gap-3 border-b border-gray-600 px-4 py-3">
                        <Search className="h-5 w-5 text-gray-500 shrink-0" />
                        <Input
                            type="text"
                            placeholder="Search by symbol or company name"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-1 bg-transparent border-0 text-gray-100 placeholder:text-gray-500 focus-visible:ring-0 focus-visible:ring-offset-0 h-auto px-0 text-base"
                            autoFocus
                        />
                        {loading && <Loader2 className="h-5 w-5 text-gray-500 animate-spin shrink-0" />}
                        <button
                            onClick={() => setOpen(false)}
                            className="p-1 hover:bg-gray-700 rounded-md transition-colors shrink-0"
                        >
                            <X className="h-5 w-5 text-gray-400" />
                        </button>
                    </div>

                    {/* Results */}
                    <div className="overflow-y-auto max-h-[500px]">
                        {loading ? (
                            <div className="py-12 text-center text-gray-500">
                                Loading stocks...
                            </div>
                        ) : displayStocks?.length === 0 ? (
                            <div className="py-12 text-center text-gray-500">
                                {isSearchMode ? 'No results found' : 'No stocks available'}
                            </div>
                        ) : (
                            <>
                                {/* Header */}
                                <div className="sticky top-0 z-10 bg-gray-800/95 backdrop-blur-sm border-b border-gray-700 px-4 py-3">
                                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                        {isSearchMode ? 'Search Results' : 'Popular Stocks'} ({displayStocks?.length || 0})
                                    </div>
                                </div>

                                {/* Stock List */}
                                <div className="px-2 py-2">
                                    {displayStocks?.map((stock) => (
                                        <div
                                            key={stock.symbol}
                                            className="flex items-center gap-3 px-3 py-3 hover:bg-gray-700/50 rounded-md transition-colors group"
                                        >
                                            {/* Icon */}
                                            <TrendingUp className="h-5 w-5 text-gray-500 shrink-0" />

                                            {/* Stock Info */}
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

                                            {/* Watchlist Button */}
                                            <div className="shrink-0">
                                                <WatchlistButton
                                                    symbol={stock.symbol}
                                                    company={stock.name}
                                                    isInWatchlist={stock.isInWatchlist}
                                                    type="icon"
                                                    onWatchlistChange={handleWatchlistChange}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}