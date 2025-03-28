const Alpaca = require('@alpacahq/alpaca-trade-api');

if (!process.env.ALPACA_API_KEY || !process.env.ALPACA_API_SECRET) {
    throw new Error(
        'Alpaca API credentials are missing. Please make sure ALPACA_API_KEY and ALPACA_API_SECRET are set in your .env file'
    );
}

const alpaca = new Alpaca({
    keyId: process.env.ALPACA_API_KEY,
    secretKey: process.env.ALPACA_API_SECRET,
    paper: process.env.ALPACA_PAPER_TRADING === 'true',
    usePolygon: false
});

/**
 * Check if the market is currently open and available for trading
 * @returns {Promise<Object>} Object containing market status information
 */
async function checkMarketStatus() {
    try {
        const clock = await alpaca.getClock();
        const calendar = await alpaca.getCalendar({
            start: new Date().toISOString().split('T')[0],
            end: new Date().toISOString().split('T')[0]
        });

        const isMarketDay = calendar.length > 0;
        const isOpen = clock.is_open;
        const nextOpen = new Date(clock.next_open);
        const nextClose = new Date(clock.next_close);

        return {
            isOpen,
            isMarketDay,
            nextOpen,
            nextClose,
            timestamp: new Date(),
            serverTime: clock.timestamp
        };
    } catch (error) {
        console.error('Error checking market status:', error);
        throw new Error(`Failed to check market status: ${error.message}`);
    }
}

/**
 * Get current trading hours
 * @returns {Promise<Object>} Object containing trading hours information
 */
async function getTradingHours() {
    try {
        const calendar = await alpaca.getCalendar({
            start: new Date().toISOString().split('T')[0],
            end: new Date().toISOString().split('T')[0]
        });

        if (calendar.length === 0) {
            return {
                isMarketDay: false,
                openTime: null,
                closeTime: null
            };
        }

        const today = calendar[0];
        return {
            isMarketDay: true,
            openTime: new Date(today.open),
            closeTime: new Date(today.close)
        };
    } catch (error) {
        console.error('Error getting trading hours:', error);
        throw new Error(`Failed to get trading hours: ${error.message}`);
    }
}

module.exports = {
    checkMarketStatus,
    getTradingHours
}; 