const winston = require('winston');
const path = require('path');

class ErrorHandler {
    constructor() {
        this.logger = winston.createLogger({
            level: 'error',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({
                    filename: path.join(__dirname, '../logs/errors.log')
                })
            ]
        });
    }

    async handleBrowserError(error, bot) {
        this.logger.error('Browser error occurred', { error: error.message });
        
        try {
            await bot.cleanup();
            await bot.initialize();
            await bot.start();
            return true;
        } catch (retryError) {
            this.logger.error('Failed to recover from browser error', { error: retryError.message });
            return false;
        }
    }

    async handleNetworkError(error, page) {
        this.logger.error('Network error occurred', { error: error.message });
        
        try {
            await page.reload({ waitUntil: 'networkidle0' });
            return true;
        } catch (retryError) {
            this.logger.error('Failed to recover from network error', { error: retryError.message });
            return false;
        }
    }

    async handleApplicationError(error, bot) {
        this.logger.error('Application error occurred', { error: error.message });
        
        if (error.message.includes('element not found')) {
            await this.handleElementNotFound(bot);
        } else if (error.message.includes('timeout')) {
            await this.handleTimeout(bot);
        }
    }

    async handleElementNotFound(bot) {
        try {
            await bot.page.reload({ waitUntil: 'networkidle0' });
            await bot.simulateHumanDelay();
            return true;
        } catch (error) {
            this.logger.error('Failed to recover from element not found error', { error: error.message });
            return false;
        }
    }

    async handleTimeout(bot) {
        try {
            await bot.page.reload({ waitUntil: 'networkidle0' });
            await bot.simulateHumanDelay();
            return true;
        } catch (error) {
            this.logger.error('Failed to recover from timeout error', { error: error.message });
            return false;
        }
    }
}

module.exports = new ErrorHandler();