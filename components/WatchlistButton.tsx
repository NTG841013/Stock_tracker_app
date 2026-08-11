'use client';

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { Star, Trash2 } from "lucide-react";
import { addToWatchlist, removeFromWatchlist } from "@/lib/actions/watchlist.actions";
import { useDebounce } from "@/hooks/useDebounce";

interface WatchlistButtonProps {
    symbol: string;
    company: string;
    isInWatchlist: boolean;
    showTrashIcon?: boolean;
    type?: 'button' | 'icon';
    onWatchlistChange?: (symbol: string, isAdded: boolean) => void;
}

// WatchlistButton with optimistic update, debounced server calls, and toast notifications.
// Prevents event bubbling to avoid triggering parent clickable rows.
const WatchlistButton = ({
                             symbol,
                             company,
                             isInWatchlist,
                             showTrashIcon = false,
                             type = 'button',
                             onWatchlistChange,
                         }: WatchlistButtonProps) => {
    const [added, setAdded] = useState<boolean>(isInWatchlist);

    const label = useMemo(() => {
        if (type === 'icon') return '';
        return added ? 'Remove from Watchlist' : 'Add to Watchlist';
    }, [added, type]);

    const toggleWatchlist = async () => {
        try {
            if (added) {
                const res = await removeFromWatchlist(symbol);
                if (res?.success) {
                    toast.success(`${symbol} removed from watchlist`);
                    onWatchlistChange?.(symbol, false);
                } else {
                    // Revert optimistic update on failure
                    setAdded(true);
                    onWatchlistChange?.(symbol, true);
                    toast.error(`Could not remove ${symbol} from watchlist`);
                }
            } else {
                const res = await addToWatchlist(symbol, company);
                if (res?.success) {
                    toast.success(`${symbol} added to watchlist`);
                    onWatchlistChange?.(symbol, true);
                } else if (res && 'error' in res && res.error === 'Stock already in watchlist') {
                    toast.success(`${symbol} is already in your watchlist`);
                    // Revert optimistic update
                    setAdded(false);
                    onWatchlistChange?.(symbol, false);
                } else {
                    // Revert optimistic update on failure
                    setAdded(false);
                    onWatchlistChange?.(symbol, false);
                    const errorMsg = res && 'error' in res ? res.error : `Could not add ${symbol} to watchlist`;
                    toast.error(errorMsg);
                }
            }
        } catch (err) {
            console.error('watchlist toggle error:', err);
            // Revert optimistic update on error
            const revert = !added;
            setAdded(revert);
            onWatchlistChange?.(symbol, revert);
            toast.error(added ? `Could not remove ${symbol} from watchlist` : `Could not add ${symbol} to watchlist`);
        }
    };

    const debouncedToggle = useDebounce(toggleWatchlist, 300);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        // Prevent event bubbling inside clickable rows or cards
        e.stopPropagation();

        // Optimistic UI update
        const next = !added;
        setAdded(next);
        onWatchlistChange?.(symbol, next);

        // Debounce server action call
        debouncedToggle();
    };

    if (type === 'icon') {
        return (
            <button
                type="button"
                title={added ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
                aria-label={added ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
                className={`watchlist-icon-btn ${added ? 'watchlist-icon-added' : ''}`}
                onClick={handleClick}
            >
                <Star className="star-icon" fill={added ? 'currentColor' : 'none'} />
            </button>
        );
    }

    return (
        <button
            type="button"
            className={`watchlist-btn ${added ? 'watchlist-remove' : ''}`}
            onClick={handleClick}
        >
            {showTrashIcon && added ? <Trash2 /> : null}
            <span>{label}</span>
        </button>
    );
};

export default WatchlistButton;