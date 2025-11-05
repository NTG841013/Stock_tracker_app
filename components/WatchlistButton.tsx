"use client";
import React, { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { addToWatchlist, removeFromWatchlist } from "@/lib/actions/watchlist.actions";

// WatchlistButton with optimistic update, debounced server calls, and toast notifications.
// Prevents event bubbling to avoid triggering parent clickable rows.

const WatchlistButton = ({
                            symbol,
                            company,
                            isInWatchlist,
                            showTrashIcon = false,
                            type = "button",
                            onWatchlistChange,
                        }: WatchlistButtonProps) => {
    const [added, setAdded] = useState<boolean>(!!isInWatchlist);

    // Debounce management
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingStateRef = useRef<boolean>(added);
    const inflightRef = useRef<boolean>(false);

    const label = useMemo(() => {
        if (type === "icon") return "";
        return added ? "Remove from Watchlist" : "Add to Watchlist";
    }, [added, type]);

    const runServerAction = async (next: boolean) => {
        try {
            inflightRef.current = true;
            if (next) {
                const res = await addToWatchlist({ symbol, company });
                if (res?.ok) {
                    toast.success(`${symbol} added to watchlist`);
                } else if (res?.alreadyExists) {
                    toast.success(`${symbol} is already in your watchlist`);
                } else {
                    throw new Error(res?.error || "Failed to add");
                }
            } else {
                const res = await removeFromWatchlist(symbol);
                if (res?.ok) {
                    toast.success(`${symbol} removed from watchlist`);
                } else {
                    throw new Error(res?.error || "Failed to remove");
                }
            }
        } catch (err) {
            // Revert optimistic update on failure
            const revert = !next;
            setAdded(revert);
            onWatchlistChange?.(symbol, revert);
            toast.error(next ? `Could not add ${symbol} to watchlist` : `Could not remove ${symbol} from watchlist`);
        } finally {
            inflightRef.current = false;
        }
    };

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        // Prevent event bubbling inside clickable rows/cards
        e.stopPropagation();

        const next = !added;
        // Optimistic UI toggle
        setAdded(next);
        pendingStateRef.current = next;
        onWatchlistChange?.(symbol, next);

        // Debounce server action calls (~300ms)
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        timerRef.current = setTimeout(() => {
            timerRef.current = null;
            // Only run if not currently in flight; if in flight, queue will run after? For simplicity, skip if inflight
            if (inflightRef.current) return;
            void runServerAction(pendingStateRef.current);
        }, 300);
    };

    if (type === "icon") {
        return (
            <button
                title={added ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
                aria-label={added ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
                className="p-2 hover:bg-gray-600/30 rounded-md transition-colors"
                onClick={handleClick}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill={added ? "#FACC15" : "none"}
                    stroke={added ? "#FACC15" : "#9095A1"}
                    strokeWidth="2"
                    className="w-5 h-5"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.385a.563.563 0 00-.182-.557L3.04 10.385a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345l2.125-5.111z"
                    />
                </svg>
            </button>
        );
    }

    return (
        <button className={`watchlist-btn ${added ? "watchlist-remove" : ""}`} onClick={handleClick}>
            {showTrashIcon && added ? (
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 h-5 mr-2"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-7 4v6m4-6v6m4-6v6" />
                </svg>
            ) : null}
            <span>{label}</span>
        </button>
    );
};

export default WatchlistButton;