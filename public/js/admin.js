document.addEventListener('DOMContentLoaded', () => {
    const startBotBtn = document.getElementById('startBot');
    const stopBotBtn = document.getElementById('stopBot');
    const botStatus = document.getElementById('botStatus');
    const chromeProfile = document.getElementById('chromeProfile');
    let botInstance = null;

    // Load Chrome profiles
    async function loadChromeProfiles() {
        try {
            const response = await fetch('/api/chrome-profiles');
            const profiles = await response.json();
            
            profiles.forEach(profile => {
                const option = document.createElement('option');
                option.value = profile.path;
                option.textContent = profile.name;
                chromeProfile.appendChild(option);
            });
        } catch (error) {
            console.error('Failed to load Chrome profiles:', error);
            alert('Failed to load Chrome profiles');
        }
    }

    // Start bot
    startBotBtn.addEventListener('click', async () => {
        if (!chromeProfile.value) {
            alert('Please select a Chrome profile');
            return;
        }

        try {
            const response = await fetch('/api/bot/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chromeProfile: chromeProfile.value
                })
            });

            if (response.ok) {
                botStatus.textContent = 'Running';
                botStatus.className = 'status-running';
                startBotBtn.disabled = true;
                stopBotBtn.disabled = false;
                initializeLogStream();
            } else {
                throw new Error('Failed to start bot');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to start bot');
        }
    });

    // Stop bot
    stopBotBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/bot/stop', {
                method: 'POST'
            });

            if (response.ok) {
                botStatus.textContent = 'Stopped';
                botStatus.className = 'status-stopped';
                startBotBtn.disabled = false;
                stopBotBtn.disabled = true;
            } else {
                throw new Error('Failed to stop bot');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to stop bot');
        }
    });

    // Real-time log streaming
    function initializeLogStream() {
        const logContainer = document.getElementById('logContainer');
        const eventSource = new EventSource('/api/bot/logs');

        eventSource.onmessage = (event) => {
            const log = JSON.parse(event.data);
            const logEntry = document.createElement('div');
            logEntry.className = `log-entry log-${log.level}`;
            logEntry.textContent = `[${new Date(log.timestamp).toLocaleTimeString()}] ${log.message}`;
            logContainer.appendChild(logEntry);
            logContainer.scrollTop = logContainer.scrollHeight;
        };

        eventSource.onerror = () => {
            eventSource.close();
        };
    }

    // Initialize
    loadChromeProfiles();
    stopBotBtn.disabled = true;
});