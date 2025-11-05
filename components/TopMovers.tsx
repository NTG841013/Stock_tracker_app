// components/TopMovers.tsx
import TradingViewWidget from "@/components/TradingViewWidget";

const TOP_MOVERS_WIDGET_CONFIG = {
    exchange: "US",
    colorTheme: "dark",
    dateRange: "12M",
    showChart: true,
    locale: "en",
    largeChartUrl: "",
    isTransparent: true,
    showSymbolLogo: false,
    showFloatingTooltip: false,
    plotLineColorGrowing: "rgba(15, 237, 190, 1)",
    plotLineColorFalling: "rgba(255, 73, 91, 1)",
    gridLineColor: "rgba(240, 243, 250, 0)",
    scaleFontColor: "#DBDBDB",
    belowLineFillColorGrowing: "rgba(15, 237, 190, 0.12)",
    belowLineFillColorFalling: "rgba(255, 73, 91, 0.12)",
    belowLineFillColorGrowingBottom: "rgba(15, 237, 190, 0)",
    belowLineFillColorFallingBottom: "rgba(255, 73, 91, 0)",
    symbolActiveColor: "rgba(15, 237, 190, 0.12)",
    width: "100%",
    height: "550"
};

export default function TopMovers() {
    const scriptUrl = `https://s3.tradingview.com/external-embedding/embed-widget-hotlists.js`;

    return (
        <TradingViewWidget
            title="Top 5 Movers"
            scriptUrl={scriptUrl}
            config={TOP_MOVERS_WIDGET_CONFIG}
            height={550}
        />
    );
}