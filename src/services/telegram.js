const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/**
 * Format message based on notification type
 * @param {Object} data Notification data
 * @returns {string} Formatted message
 */
function formatMessage(data) {
    const timestamp = new Date().toLocaleString();
    let message = '';

    switch (data.type) {
        case 'trade':
            message = `🤖 Trade Alert!\n\n${data.message}\n\nTime: ${timestamp}`;
            break;
        case 'error':
            message = `⚠️ Error Alert!\n\n${data.message}\n\nTime: ${timestamp}`;
            break;
        case 'warning':
            message = `⚠️ Warning!\n\n${data.message}\n\nTime: ${timestamp}`;
            break;
        case 'system':
            message = `🔧 System Message\n\n${data.message}\n\nTime: ${timestamp}`;
            break;
        case 'info':
            message = `ℹ️ Info\n\n${data.message}\n\nTime: ${timestamp}`;
            break;
        default:
            message = `${data.message}\n\nTime: ${timestamp}`;
    }

    return message;
}

/**
 * Send notification via Telegram
 * @param {Object} data Notification data
 * @returns {Promise<Object>} Telegram response
 */
async function sendNotification(data) {
    try {
        if (!CHAT_ID) {
            throw new Error('Telegram chat ID not configured');
        }

        const message = formatMessage(data);
        
        // Add markdown formatting
        const options = {
            parse_mode: 'Markdown',
            disable_web_page_preview: true
        };

        const response = await bot.sendMessage(CHAT_ID, message, options);
        
        return {
            success: true,
            messageId: response.message_id,
            timestamp: new Date()
        };
    } catch (error) {
        console.error('Error sending Telegram notification:', error);
        
        // Don't throw error to prevent breaking the main flow
        // Just log it and return error status
        return {
            success: false,
            error: error.message,
            timestamp: new Date()
        };
    }
}

// Export the function after it's defined
module.exports = {
    sendNotification
}; 