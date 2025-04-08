const fs = require('fs').promises;
const path = require('path');
const yaml = require('yaml');

class ConfigHandler {
    constructor() {
        this.configDir = path.join(__dirname, '../configs');
    }

    async initialize() {
        try {
            await fs.mkdir(this.configDir, { recursive: true });
        } catch (error) {
            console.error('Error creating config directory:', error);
            throw error;
        }
    }

    async saveConfig(config, format = 'json') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `config-${timestamp}.${format}`;
        const filePath = path.join(this.configDir, fileName);

        try {
            let content;
            if (format === 'yaml') {
                content = yaml.stringify(config);
            } else {
                content = JSON.stringify(config, null, 2);
            }

            await fs.writeFile(filePath, content, 'utf8');
            return filePath;
        } catch (error) {
            console.error('Error saving configuration:', error);
            throw error;
        }
    }

    validateConfig(config) {
        const requiredFields = ['personalInfo', 'jobPreferences'];
        const errors = [];

        for (const field of requiredFields) {
            if (!config[field]) {
                errors.push(`Missing required section: ${field}`);
            }
        }

        if (errors.length > 0) {
            throw new Error('Configuration validation failed: ' + errors.join(', '));
        }

        return true;
    }
}

module.exports = ConfigHandler;