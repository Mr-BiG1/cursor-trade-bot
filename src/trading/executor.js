const Alpaca = require('@alpacahq/alpaca-trade-api');

const alpaca = new Alpaca({
    keyId: process.env.ALPACA_API_KEY,
    secretKey: process.env.ALPACA_API_SECRET,
    paper: process.env.ALPACA_PAPER_TRADING === 'true',
    usePolygon: false
});

/**
 * Place a trade order
 * @param {Object} params Trade parameters
 * @returns {Promise<Object>} Order result
 */
async function executeTrade(params) {
    try {
        const {
            symbol,
            action,
            quantity,
            stopLoss
        } = params;

        // Validate parameters
        if (!symbol || !action || !quantity) {
            throw new Error('Missing required trade parameters');
        }

        // Place the main order
        const orderParams = {
            symbol,
            qty: quantity,
            side: action === 'buy' ? 'buy' : 'sell',
            type: 'market',
            time_in_force: 'day'
        };

        const order = await alpaca.createOrder(orderParams);

        // If order is filled and we have a stop loss, place the stop loss order
        if (order.status === 'filled' && stopLoss) {
            const stopLossParams = {
                symbol,
                qty: quantity,
                side: action === 'buy' ? 'sell' : 'buy',
                type: 'stop',
                time_in_force: 'gtc',
                stop_price: stopLoss
            };

            const stopLossOrder = await alpaca.createOrder(stopLossParams);

            return {
                success: true,
                mainOrder: order,
                stopLossOrder,
                action: order.side,
                quantity: parseInt(order.qty),
                symbol: order.symbol,
                price: parseFloat(order.filled_avg_price || order.limit_price),
                timestamp: new Date()
            };
        }

        return {
            success: true,
            mainOrder: order,
            action: order.side,
            quantity: parseInt(order.qty),
            symbol: order.symbol,
            price: parseFloat(order.filled_avg_price || order.limit_price),
            timestamp: new Date()
        };

    } catch (error) {
        console.error('Error executing trade:', error);
        return {
            success: false,
            error: error.message,
            timestamp: new Date()
        };
    }
}

/**
 * Get current positions
 * @returns {Promise<Array>} Array of current positions
 */
async function getCurrentPositions() {
    try {
        const positions = await alpaca.getPositions();
        return positions.map(position => ({
            symbol: position.symbol,
            quantity: parseInt(position.qty),
            entryPrice: parseFloat(position.avg_entry_price),
            currentPrice: parseFloat(position.current_price),
            marketValue: parseFloat(position.market_value),
            unrealizedPL: parseFloat(position.unrealized_pl),
            unrealizedPLPercent: parseFloat(position.unrealized_plpc) * 100
        }));
    } catch (error) {
        console.error('Error getting positions:', error);
        return [];
    }
}

/**
 * Close all positions
 * @returns {Promise<Object>} Result of closing positions
 */
async function closeAllPositions() {
    try {
        await alpaca.cancelAllOrders();
        const result = await alpaca.closeAllPositions();
        return {
            success: true,
            result,
            timestamp: new Date()
        };
    } catch (error) {
        console.error('Error closing positions:', error);
        return {
            success: false,
            error: error.message,
            timestamp: new Date()
        };
    }
}

module.exports = {
    executeTrade,
    getCurrentPositions,
    closeAllPositions
}; 