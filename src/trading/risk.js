const Alpaca = require('@alpacahq/alpaca-trade-api');

const alpaca = new Alpaca({
    keyId: process.env.ALPACA_API_KEY,
    secretKey: process.env.ALPACA_API_SECRET,
    paper: process.env.ALPACA_PAPER_TRADING === 'true',
    usePolygon: false
});

const RISK_PERCENTAGE = parseFloat(process.env.RISK_PERCENTAGE) || 1; // Default 1% risk per trade
const MIN_RISK_REWARD_RATIO = 2; // Minimum 2:1 reward-to-risk ratio

/**
 * Calculate position size based on risk parameters
 * @param {Object} params Trade parameters
 * @returns {Promise<number>} Position size
 */
async function calculatePositionSize(params) {
    const account = await alpaca.getAccount();
    const portfolioValue = parseFloat(account.portfolio_value);
    const maxRiskAmount = portfolioValue * (RISK_PERCENTAGE / 100);
    
    const riskPerShare = Math.abs(params.entryPrice - params.stopLoss);
    const shares = Math.floor(maxRiskAmount / riskPerShare);
    
    return shares;
}

/**
 * Calculate risk-reward ratio
 * @param {Object} params Trade parameters
 * @returns {number} Risk-reward ratio
 */
function calculateRiskRewardRatio(params) {
    const potentialReward = Math.abs(params.priceTarget - params.entryPrice);
    const potentialRisk = Math.abs(params.entryPrice - params.stopLoss);
    
    return potentialReward / potentialRisk;
}

/**
 * Check if the trade meets margin requirements
 * @param {Object} params Trade parameters
 * @returns {Promise<boolean>} Whether trade meets margin requirements
 */
async function checkMarginRequirements(params) {
    try {
        const account = await alpaca.getAccount();
        const buying_power = parseFloat(account.buying_power);
        const total_cost = params.quantity * params.entryPrice;
        
        return total_cost <= buying_power;
    } catch (error) {
        console.error('Error checking margin requirements:', error);
        return false;
    }
}

/**
 * Validate trade against risk management rules
 * @param {Object} decision Trading decision
 * @returns {Promise<Object>} Validation result
 */
async function validateRisk(decision) {
    try {
        if (!decision.symbol) {
            throw new Error('Stock symbol is required for risk validation');
        }

        if (decision.action === 'hold') {
            return {
                isValid: true,
                reason: 'Hold position - no risk check needed'
            };
        }

        // Get current price
        const quote = await alpaca.getLatestQuote(decision.symbol);
        const currentPrice = parseFloat(quote.askprice);

        const tradeParams = {
            entryPrice: currentPrice,
            stopLoss: decision.stopLoss,
            priceTarget: decision.priceTarget
        };

        // Calculate position size
        const quantity = await calculatePositionSize(tradeParams);
        
        // Calculate risk-reward ratio
        const riskRewardRatio = calculateRiskRewardRatio(tradeParams);
        
        // Check margin requirements
        const hasMargin = await checkMarginRequirements({
            ...tradeParams,
            quantity
        });

        // Validate the trade
        if (riskRewardRatio < MIN_RISK_REWARD_RATIO) {
            return {
                isValid: false,
                reason: `Risk-reward ratio ${riskRewardRatio.toFixed(2)} below minimum ${MIN_RISK_REWARD_RATIO}`,
                details: { riskRewardRatio }
            };
        }

        if (!hasMargin) {
            return {
                isValid: false,
                reason: 'Insufficient buying power',
                details: { quantity, estimatedCost: quantity * currentPrice }
            };
        }

        return {
            isValid: true,
            quantity,
            riskRewardRatio,
            maxRisk: RISK_PERCENTAGE,
            details: {
                entryPrice: currentPrice,
                stopLoss: decision.stopLoss,
                priceTarget: decision.priceTarget
            }
        };

    } catch (error) {
        console.error('Error validating risk:', error);
        return {
            isValid: false,
            reason: `Risk validation error: ${error.message}`
        };
    }
}

module.exports = {
    validateRisk
}; 