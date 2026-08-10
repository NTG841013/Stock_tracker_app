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
import { addAlert } from '@/lib/actions/alerts.actions';
import { toast } from 'sonner';

export function WatchlistTable({ watchlist }: WatchlistTableProps) {
    const router = useRouter();

    return (
        <>
            <Table className='scrollbar-hide-default watchlist-table'>
                <TableHeader>
                    <TableRow className='table-header-row'>
                        {WATCHLIST_TABLE_HEADER.map((label) => (
                            <TableHead className='table-header' key={label}>
                                {label}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {watchlist.map((item, index) => (
                        <TableRow
                            key={item.symbol + index}
                            className='table-row'
                            onClick={() =>
                                router.push(`/stocks/${encodeURIComponent(item.symbol)}`)
                            }
                        >
                            <TableCell className='pl-4 table-cell'>{item.company}</TableCell>
                            <TableCell className='table-cell'>{item.symbol}</TableCell>
                            <TableCell className='table-cell'>
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
                            <TableCell className='table-cell'>
                                {item.marketCap || '—'}
                            </TableCell>
                            <TableCell className='table-cell'>
                                {item.peRatio || '—'}
                            </TableCell>
                            <TableCell>
                                <Button
                                    className='add-alert'
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        e.preventDefault();

                                        const input = window.prompt(`Set price threshold for ${item.symbol} (e.g., 150.25):`);
                                        if (!input) return;
                                        const threshold = Number(input);
                                        if (Number.isNaN(threshold)) {
                                            toast.error('Please enter a valid number for the threshold.');
                                            return;
                                        }

                                        const res = await addAlert(item.symbol, item.company, 'Price Alert', 'upper', threshold);
                                        if (res?.success) {
                                            toast.success('Alert added', {
                                                description: `${item.symbol} will alert at price > ${threshold}`,
                                            });
                                        } else {
                                            toast.error('Failed to add alert');
                                        }
                                    }}
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
                                    type='icon'
                                />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </>
    );
}