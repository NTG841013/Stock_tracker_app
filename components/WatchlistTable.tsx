// components/WatchlistTable.tsx
'use client';

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { WATCHLIST_TABLE_HEADER } from '@/lib/constants';
import { Button } from './ui/button';
import WatchlistButton from './WatchlistButton';
import { useRouter } from 'next/navigation';
import { cn, getChangeColorClass } from '@/lib/utils';
import { useState } from 'react';
import AlertModal from './AlertModal';

export function WatchlistTable({ watchlist }: WatchlistTableProps) {
    const router = useRouter();
    const [localWatchlist, setLocalWatchlist] = useState(watchlist);
    const [selectedStock, setSelectedStock] = useState<{
        symbol: string;
        company: string;
        currentPrice: number;
    } | null>(null);
    const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);

    const handleWatchlistChange = (symbol: string, isAdded: boolean) => {
        if (!isAdded) {
            // Remove from local state for immediate UI update
            setLocalWatchlist((prev) => prev.filter((item) => item.symbol !== symbol));
        }
    };

    const handleAddAlert = (e: React.MouseEvent, stock: StockWithData) => {
        e.stopPropagation(); // Prevent row click
        setSelectedStock({
            symbol: stock.symbol,
            company: stock.company,
            currentPrice: stock.currentPrice || 0
        });
        setIsAlertModalOpen(true);
    };

    if (!localWatchlist || localWatchlist.length === 0) {
        return (
            <div className="watchlist-table p-6 rounded-lg">
                <p className="text-gray-400 text-center">Your watchlist is empty.</p>
            </div>
        );
    }

    return (
        <>
            <Table className="scrollbar-hide-default watchlist-table">
                <TableHeader>
                    <TableRow className="table-header-row">
                        {WATCHLIST_TABLE_HEADER.map((label) => (
                            <TableHead className="table-header" key={label}>
                                {label}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {localWatchlist.map((item, index) => (
                        <TableRow
                            key={item.symbol + index}
                            className="table-row"
                            onClick={() =>
                                router.push(`/stocks/${encodeURIComponent(item.symbol)}`)
                            }
                        >
                            <TableCell className="pl-4 table-cell">{item.company}</TableCell>
                            <TableCell className="table-cell">{item.symbol}</TableCell>
                            <TableCell className="table-cell">
                                {item.priceFormatted || '—'}
                            </TableCell>
                            <TableCell
                                className={cn(
                                    'table-cell',
                                    getChangeColorClass(item.changePercent)
                                )}
                            >
                                {item.changeFormatted || '—'}
                            </TableCell>
                            <TableCell className="table-cell">
                                {item.marketCap || '—'}
                            </TableCell>
                            <TableCell className="table-cell">
                                {item.peRatio || '—'}
                            </TableCell>
                            <TableCell>
                                <Button
                                    className="add-alert"
                                    onClick={(e) => handleAddAlert(e, item)}
                                >
                                    Add Alert
                                </Button>
                            </TableCell>
                            <TableCell>
                                <WatchlistButton
                                    symbol={item.symbol}
                                    company={item.company}
                                    isInWatchlist={true}
                                    showTrashIcon={true}
                                    type="icon"
                                    onWatchlistChange={handleWatchlistChange}
                                />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            {isAlertModalOpen && selectedStock && (
                <AlertModal
                    open={isAlertModalOpen}
                    setOpen={setIsAlertModalOpen}
                    alertData={{
                        symbol: selectedStock.symbol,
                        company: selectedStock.company,
                        alertName: `${selectedStock.company} Alert`,
                        alertType: 'price',
                        condition: 'greater',
                        threshold: selectedStock.currentPrice.toString()
                    }}
                    action="create"
                    currentPrice={selectedStock.currentPrice}
                />
            )}
        </>
    );
}