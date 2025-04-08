const path = require('path');
const fs = require('fs').promises;
const LinkedInAutomation = require('./LinkedInAutomation');
const ConfigHandler = require('./configHandler');

class BotController {
    constructor() {
        this.bot = null;
        this.configHandler = new ConfigHandler();
        this.logSubscribers = new Set();
    }

    async getChromeProfiles() {
        const chromePath = path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\User Data');
        try {
            const dirs = await fs.readdir(chromePath);
            const profiles = dirs
                .filter(dir => dir.startsWith('Profile') || dir === 'Default')
                .map(dir => ({
                    name: dir,
                    path: path.join(chromePath, dir)
                }));
            return profiles;
        } catch (error) {
            console.error('Error loading Chrome profiles:', error);
            throw error;
        }
    }

    async startBot(chromeProfile, config) {
        if (this.bot) {
            throw new Error('Bot is already running');
        }

        try {
            await this.configHandler.validateConfig(config);
            this.bot = new LinkedInAutomation({
                ...config,
                chromeProfilePath: chromeProfile
            });

            // Subscribe to bot logs
            this.bot.logger.on('logging', (info) => {
                this.broadcastLog(info);
            });

            await this.bot.initialize();
            await this.bot.start();
        } catch (error) {
            console.error('Failed to start bot:', error);
            throw error;
        }
    }

    async stopBot() {
        if (!this.bot) {
            throw new Error('Bot is not running');
        }

        try {
            await this.bot.stop();
            await this.bot.cleanup();
            this.bot = null;
        } catch (error) {
            console.error('Failed to stop bot:', error);
            throw error;
        }
    }

    subscribeToLogs(subscriber) {
        this.logSubscribers.add(subscriber);
    }

    unsubscribeFromLogs(subscriber) {
        this.logSubscribers.delete(subscriber);
    }

    broadcastLog(logInfo) {
        const logMessage = JSON.stringify(logInfo);
        this.logSubscribers.forEach(subscriber => {
            subscriber.write(`data: ${logMessage}\n\n`);
        });
    }
}

module.exports = new BotController();