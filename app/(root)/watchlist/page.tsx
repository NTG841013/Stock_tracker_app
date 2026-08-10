import { Star } from 'lucide-react';
import { searchStocks } from '@/lib/actions/finnhub.actions';
import SearchCommand from '@/components/SearchCommand';
import { getWatchlistWithData } from '@/lib/actions/watchlist.actions';
import { WatchlistTable } from '@/components/WatchlistTable';

const Watchlist = async () => {
    const watchlist = await getWatchlistWithData();
    const initialStocks = await searchStocks();

    // Empty state
    if (watchlist.length === 0) {
        return (
            <section className="flex watchlist-empty-container">
                <div className="watchlist-empty">
                    <Star className="watchlist-star" />
                    <h2 className="empty-title">Your watchlist is empty</h2>
                    <p className="empty-description">
                        Start building your watchlist by searching for stocks and clicking the star icon to add them.
                    </p>
                </div>
                <SearchCommand initialStocks={initialStocks} />
import SearchCommand from "@/components/SearchCommand";
import { searchStocks } from "@/lib/actions/finnhub.actions";
import { getWatchlistWithData } from "@/lib/actions/watchlist.actions";
import { getUserAlerts } from "@/lib/actions/alert.actions";
import { Star } from "lucide-react";
import { WatchlistTable } from "@/components/WatchlistTable";
import AlertsList from "@/components/AlertsList";
import TopMovers from "@/components/TopMovers";

const WatchlistPage = async () => {
    // Fetch watchlist, alerts, and initial stocks in parallel
    const [watchlistData, alerts, initialStocks] = await Promise.all([
        getWatchlistWithData(),
        getUserAlerts(),
        searchStocks()
    ]);

    const hasItems = Array.isArray(watchlistData) && watchlistData.length > 0;

    if (!hasItems) {
        return (
            <section className="watchlist-empty-container">
                <div className="watchlist-empty">
                    <Star className="watchlist-star" />
                    <h1 className="text-2xl sm:text-3xl font-semibold text-gray-100">Your Watchlist</h1>
                    <p className="text-gray-400">
                        It looks empty here. Search for stocks and click the star to add them to your watchlist.
                        <br />
                        <br />
                        Only the US Exchange is supported at the moment.
                    </p>
                    <div className="mt-6">
                        <SearchCommand renderAs="button" label="Add stock" initialStocks={initialStocks} />
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="watchlist">
            <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <h2 className="watchlist-title">Watchlist</h2>
                    <SearchCommand initialStocks={initialStocks} />
                </div>
                <WatchlistTable watchlist={watchlist} />
        <section className="container py-10">
            <div className="watchlist-container">
                {/* Left Section - 2/3 width */}
                <div className="watchlist">
                    <div className="flex items-center justify-between mb-6">
                        <h1 className="watchlist-title">Watchlist</h1>
                        <SearchCommand renderAs="button" label="Add stock" initialStocks={initialStocks} />
                    </div>

                    <WatchlistTable watchlist={watchlistData} />

                    {/* Top 5 Movers Widget */}
                    <div className="mt-8">
                        <TopMovers />
                    </div>
                </div>

                {/* Right Section - 1/3 width */}
                <div className="watchlist-alerts">
                    <h1 className="watchlist-title mb-6">Alerts</h1>
                    <AlertsList alertData={alerts} watchlistData={watchlistData} />
                </div>
            </div>
        </section>
    );
};

export default Watchlist;

