const puppeteer = require('puppeteer');
const winston = require('winston');
const path = require('path');
const errorHandler = require('./errorHandler');

class LinkedInAutomation {
    constructor(config) {
        this.config = config;
        this.isRunning = false;
        this.logger = this.setupLogger();
    }

    setupLogger() {
        return winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ 
                    filename: path.join(__dirname, '../logs/error.log'), 
                    level: 'error' 
                }),
                new winston.transports.File({ 
                    filename: path.join(__dirname, '../logs/application.log')
                })
            ]
        });
    }

    async initialize() {
        try {
            this.browser = await puppeteer.launch({
                headless: false,
                userDataDir: this.config.chromeProfilePath,
                defaultViewport: { width: 1280, height: 800 }
            });
            this.page = await this.browser.newPage();
            await this.setupPageInterception();
            this.logger.info('Browser initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize browser', { error: error.message });
            throw error;
        }
    }

    async setupPageInterception() {
        await this.page.setRequestInterception(true);
        this.page.on('request', request => {
            if (request.resourceType() === 'image' || request.resourceType() === 'stylesheet') {
                request.abort();
            } else {
                request.continue();
            }
        });
    }

    async start() {
        try {
            this.isRunning = true;
            await this.navigateToJobSearch();
            await this.processJobs();
        } catch (error) {
            this.logger.error('Job application process failed', { error: error.message });
            throw error;
        }
    }

    async navigateToJobSearch() {
        await this.page.goto('https://www.linkedin.com/jobs/');
        await this.page.waitForSelector('input[role="combobox"]');
        
        // Set job search criteria
        await this.setSearchCriteria();
    }

    async setSearchCriteria() {
        const { jobTitles, locations } = this.config.jobPreferences;
        
        // Clear existing search terms
        await this.page.evaluate(() => {
            document.querySelectorAll('input[role="combobox"]').forEach(input => input.value = '');
        });

        // Enter job title
        await this.page.type('input[role="combobox"]', jobTitles[0]);
        await this.simulateHumanDelay();
    }

    async processJobs() {
        while (this.isRunning) {
            try {
                const jobCards = await this.page.$$('.job-card-container');
                
                for (const jobCard of jobCards) {
                    if (!this.isRunning) break;

                    try {
                        await this.processJobCard(jobCard);
                    } catch (error) {
                        const recovered = await errorHandler.handleApplicationError(error, this);
                        if (!recovered) {
                            this.logger.error('Failed to process job card', { error: error.message });
                            continue;
                        }
                    }
                }

                if (await this.hasNextPage()) {
                    await this.goToNextPage();
                } else {
                    break;
                }
            } catch (error) {
                const recovered = await errorHandler.handleBrowserError(error, this);
                if (!recovered) {
                    this.logger.error('Critical error in job processing', { error: error.message });
                    break;
                }
            }
        }
    }

    async submitApplication(applyButton) {
        try {
            await applyButton.click();
            await this.simulateHumanDelay();

            while (await this.isApplicationIncomplete()) {
                try {
                    await this.fillCurrentStep();
                    await this.simulateHumanDelay();
                    await this.clickNext();
                } catch (error) {
                    const recovered = await errorHandler.handleApplicationError(error, this);
                    if (!recovered) {
                        throw error;
                    }
                }
            }

            const submitButton = await this.page.$('button[aria-label="Submit application"]');
            if (submitButton) {
                await submitButton.click();
                this.logger.info('Application submitted successfully');
            }
        } catch (error) {
            this.logger.error('Failed to submit application', { error: error.message });
            throw error;
        }
    }

    async hasNextPage() {
        try {
            const nextButton = await this.page.$('button[aria-label="Next"]');
            return nextButton !== null;
        } catch (error) {
            this.logger.error('Error checking next page', { error: error.message });
            return false;
        }
    }

    async goToNextPage() {
        try {
            await this.page.click('button[aria-label="Next"]');
            await this.page.waitForSelector('.job-card-container');
            await this.simulateHumanDelay();
        } catch (error) {
            this.logger.error('Error navigating to next page', { error: error.message });
            throw error;
        }
    }

    isBlacklisted(jobTitle, company) {
        const { companies = [], titles = [] } = this.config.blacklist || {};
        return companies.some(c => company.toLowerCase().includes(c.toLowerCase())) ||
               titles.some(t => jobTitle.toLowerCase().includes(t.toLowerCase()));
    }

    async isApplicationIncomplete() {
        try {
            const nextButton = await this.page.$('button[aria-label="Continue to next step"]');
            const submitButton = await this.page.$('button[aria-label="Submit application"]');
            return nextButton !== null || submitButton !== null;
        } catch (error) {
            this.logger.error('Error checking application status', { error: error.message });
            return false;
        }
    }

    async fillCurrentStep() {
        try {
            const formFields = await this.page.$$('input, select, textarea');
            
            for (const field of formFields) {
                const fieldType = await field.evaluate(el => el.type);
                const fieldName = await field.evaluate(el => el.name || el.id || el.placeholder);
                
                if (fieldType === 'file') {
                    await this.handleFileUpload(field);
                } else {
                    await this.fillFormField(field, fieldType, fieldName);
                }
            }
        } catch (error) {
            this.logger.error('Error filling form field', { error: error.message });
            throw error;
        }
    }

    async handleFileUpload(field) {
        const inputName = await field.evaluate(el => el.name || el.id);
        const filePath = inputName.includes('resume') ? 
            this.config.documents.resumePath : 
            this.config.documents.coverLetterPath;

        if (filePath) {
            await field.uploadFile(filePath);
        }
    }

    async fillFormField(field, type, name) {
        const value = this.getFieldValue(name);
        if (!value) return;

        switch (type) {
            case 'text':
            case 'email':
            case 'tel':
                await field.type(value);
                break;
            case 'select-one':
                await field.select(value);
                break;
            case 'checkbox':
                if (value === true) {
                    await field.click();
                }
                break;
            case 'textarea':
                await field.type(value);
                break;
        }
    }

    getFieldValue(fieldName) {
        const fieldMap = {
            'firstName': this.config.personalInfo.fullName.split(' ')[0],
            'lastName': this.config.personalInfo.fullName.split(' ').slice(1).join(' '),
            'email': this.config.personalInfo.email,
            'phone': this.config.personalInfo.phone,
            'location': this.config.personalInfo.location,
        };

        return fieldMap[fieldName.toLowerCase()] || null;
    }

    async clickNext() {
        try {
            const nextButton = await this.page.$('button[aria-label="Continue to next step"]');
            if (nextButton) {
                await nextButton.click();
                await this.simulateHumanDelay();
            }
        } catch (error) {
            this.logger.error('Error clicking next button', { error: error.message });
            throw error;
        }
    }

    async processJobCard(jobCard) {
        const jobTitle = await jobCard.$eval('h3', el => el.textContent.trim());
        const company = await jobCard.$eval('.job-card-container__company-name', el => el.textContent.trim());

        // Check blacklist
        if (this.isBlacklisted(jobTitle, company)) {
            this.logger.info('Skipping blacklisted job', { jobTitle, company });
            return;
        }

        await jobCard.click();
        await this.simulateHumanDelay();

        const easyApplyButton = await this.page.$('.jobs-apply-button');
        if (easyApplyButton) {
            await this.submitApplication(easyApplyButton);
        }
    }

    async submitApplication(applyButton) {
        await applyButton.click();
        await this.simulateHumanDelay();

        // Handle multi-step application
        while (await this.isApplicationIncomplete()) {
            await this.fillCurrentStep();
            await this.simulateHumanDelay();
            await this.clickNext();
        }

        // Submit final application
        const submitButton = await this.page.$('button[aria-label="Submit application"]');
        if (submitButton) {
            await submitButton.click();
            this.logger.info('Application submitted successfully');
        }
    }

    async simulateHumanDelay() {
        const delay = Math.floor(Math.random() * (3000 - 1000) + 1000);
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    stop() {
        this.isRunning = false;
        this.logger.info('Bot stopped by user');
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

module.exports = LinkedInAutomation;