import { headers } from "next/headers";
import { auth } from "@/lib/better-auth/auth";
import SearchCommand from "@/components/SearchCommand";
import { searchStocks } from "@/lib/actions/finnhub.actions";
import { getWatchlistWithData } from "@/lib/actions/watchlist.actions";
import { getUserAlerts } from "@/lib/actions/alert.actions";
import { Star } from "lucide-react";
import { WatchlistTable } from "@/components/WatchlistTable";
import AlertsList from "@/components/AlertsList";
import TopMovers from "@/components/TopMovers";

const WatchlistPage = async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    const email = session?.user?.email || "";

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

export default WatchlistPage;