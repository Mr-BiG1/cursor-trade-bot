const Alpaca = require('@alpacahq/alpaca-trade-api');
const { RSI, EMA, MACD } = require('technicalindicators');

const alpaca = new Alpaca({
    keyId: process.env.ALPACA_API_KEY,
    secretKey: process.env.ALPACA_API_SECRET,
    paper: process.env.ALPACA_PAPER_TRADING === 'true',
    usePolygon: false
});

async function getTechnicalIndicators(symbol) {
    try {
        // Use the free tier endpoint with delayed data
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 100); // Last 100 days

        const bars = await alpaca.getBarsV2(
            symbol,
            {
                start: startDate.toISOString(),
                end: endDate.toISOString(),
                timeframe: '1Day',
                feed: 'iex' // Use IEX data feed instead of SIP
            }
        );

        const prices = [];
        for await (const bar of bars) {
            prices.push(bar.ClosePrice);
        }

        if (prices.length === 0) {
            throw new Error('No price data available');
        }

        // Calculate indicators
        const rsi = calculateRSI(prices);
        const ema50 = calculateEMA(prices, 50);
        const ema200 = calculateEMA(prices, 200);
        const macd = calculateMACD(prices);

        // Add trend signal
        const trendSignal = ema50 > ema200 ? 'bullish' : 'bearish';
        const momentum = rsi > 50 ? 'positive' : 'negative';

        return {
            rsi,
            ema50,
            ema200,
            macd,
            trendSignal,
            momentum,
            currentPrice: prices[prices.length - 1],
            timestamp: new Date()
        };
    } catch (error) {
        console.error('Error calculating technical indicators:', error);
        throw new Error(`Failed to calculate technical indicators: ${error.message}`);
    }
}

function calculateRSI(prices, period = 14) {
    const rsi = new RSI({ period, values: prices });
    const results = rsi.getResult();
    return results[results.length - 1];
}

function calculateEMA(prices, period) {
    const ema = new EMA({ period, values: prices });
    const results = ema.getResult();
    return results[results.length - 1];
}

function calculateMACD(prices) {
    const macd = new MACD({
        values: prices,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false
    });
    const results = macd.getResult();
    return results[results.length - 1];
}

// Export the function after it's defined
module.exports = {
    getTechnicalIndicators
}; 